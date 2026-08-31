import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FieldRelayApiClient } from '../api/client';
import { INITIAL_SHIPMENT_DRAFT } from '../data';
import {
  cloneInitialState,
  createLocalOperation,
  enqueueIdempotently,
  nextDraftShipmentId,
  pendingOperationCount,
  resolveConflict,
  updateOperationStatus,
} from '../storage/offlineQueue';
import { loadMobileState, persistMobileState } from '../storage/mobileStateStore';
import {
  createSerializedStateWriter,
  type StateTransition,
} from '../storage/serializedStateWriter';
import { synchronizeOperation } from '../sync/syncOperation';
import type {
  BottomTab,
  ConflictChoice,
  PersistedMobileState,
  RootScreen,
  ShipmentDraft,
  SyncOperation,
} from '../types';

type ApiConnectionStatus = 'IDLE' | 'CHECKING' | 'AVAILABLE' | 'UNAVAILABLE';

interface FieldRelayContextValue {
  hydrated: boolean;
  screen: RootScreen;
  activeTab: BottomTab;
  state: PersistedMobileState;
  draft: ShipmentDraft;
  pendingCount: number;
  demoOnline: boolean;
  physicalOnline: boolean | null;
  apiBaseUrl: string;
  apiConnectionStatus: ApiConnectionStatus;
  apiDiagnostic?: string;
  storageDiagnostic?: string;
  navigate: (screen: RootScreen) => void;
  selectTab: (tab: BottomTab) => void;
  goBack: () => void;
  updateDraft: (patch: Partial<ShipmentDraft>) => void;
  toggleDemoConnectivity: () => Promise<void>;
  saveDemoShipment: () => Promise<void>;
  runSync: (force?: boolean) => Promise<void>;
  resolveOperationConflict: (operationId: string, choice: ConflictChoice) => Promise<void>;
  resetDemo: () => Promise<void>;
}

const FieldRelayContext = createContext<FieldRelayContextValue | null>(null);

const tabScreens: Record<BottomTab, RootScreen> = {
  HOME: 'HOME',
  CREATE: 'CREATE',
  SHIPMENTS: 'SHIPMENTS',
  SYNC: 'SYNC',
};

function healthError(status: number): string {
  return `API health check returned HTTP ${status}. Queued operations remain on this device.`;
}

export function FieldRelayProvider({ children }: PropsWithChildren) {
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<RootScreen>('HOME');
  const [activeTab, setActiveTab] = useState<BottomTab>('HOME');
  const [state, setState] = useState<PersistedMobileState>(cloneInitialState);
  const [draft, setDraft] = useState<ShipmentDraft>({ ...INITIAL_SHIPMENT_DRAFT });
  const [physicalOnline, setPhysicalOnline] = useState<boolean | null>(null);
  const [apiConnectionStatus, setApiConnectionStatus] = useState<ApiConnectionStatus>('IDLE');
  const [apiDiagnostic, setApiDiagnostic] = useState<string>();
  const [storageDiagnostic, setStorageDiagnostic] = useState<string>();
  const stateRef = useRef(state);
  const saveOperationRef = useRef<SyncOperation | null>(null);
  const syncLockRef = useRef(false);
  const apiClientRef = useRef(new FieldRelayApiClient());
  const stateWriterRef = useRef<ReturnType<typeof createSerializedStateWriter<PersistedMobileState>> | null>(
    null,
  );

  if (!stateWriterRef.current) {
    stateWriterRef.current = createSerializedStateWriter<PersistedMobileState>({
      read: () => stateRef.current,
      persist: persistMobileState,
      publish: (next) => {
        stateRef.current = next;
        setState(next);
      },
    });
  }

  const commitState = useCallback(async (transition: StateTransition<PersistedMobileState>) => {
    try {
      // Durability comes before success UI. A screen never says “saved” until
      // the SQLite-backed store has accepted the state. The updater itself runs
      // inside the writer queue, after every earlier write has completed.
      const next = await stateWriterRef.current!.transition(transition);
      setStorageDiagnostic(undefined);
      return next;
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : 'Device storage write failed';
      setStorageDiagnostic(diagnostic);
      throw error;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadMobileState()
      .then((loaded) => {
        if (!cancelled) {
          stateRef.current = loaded;
          setState(loaded);
          setDraft({ ...INITIAL_SHIPMENT_DRAFT, shipmentId: nextDraftShipmentId(loaded.queue) });
          setHydrated(true);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const fallback = cloneInitialState();
          stateRef.current = fallback;
          setState(fallback);
          setStorageDiagnostic(
            error instanceof Error ? error.message : 'Could not open the device ledger',
          );
          setHydrated(true);
        }
      });

    const unsubscribe = NetInfo.addEventListener((networkState) => {
      setPhysicalOnline(Boolean(networkState.isConnected && networkState.isInternetReachable !== false));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const navigate = useCallback((nextScreen: RootScreen) => {
    setScreen(nextScreen);
    if (nextScreen === 'HOME') setActiveTab('HOME');
    if (['CREATE', 'REVIEW', 'SAVED'].includes(nextScreen)) setActiveTab('CREATE');
    if (['SHIPMENTS', 'DISCREPANCY'].includes(nextScreen)) setActiveTab('SHIPMENTS');
    if (nextScreen === 'SYNC') setActiveTab('SYNC');
  }, []);

  const selectTab = useCallback((tab: BottomTab) => {
    setActiveTab(tab);
    setScreen(tabScreens[tab]);
  }, []);

  const goBack = useCallback(() => {
    setScreen((current) => {
      if (current === 'REVIEW') return 'CREATE';
      if (current === 'SAVED') return 'HOME';
      if (current === 'DISCREPANCY') return 'SHIPMENTS';
      return 'HOME';
    });
  }, []);

  const updateDraft = useCallback((patch: Partial<ShipmentDraft>) => {
    saveOperationRef.current = null;
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const toggleDemoConnectivity = useCallback(async () => {
    await commitState((current) => ({
      ...current,
      demoConnectivity: current.demoConnectivity === 'OFFLINE' ? 'ONLINE' : 'OFFLINE',
    }));
    Haptics.selectionAsync().catch(() => undefined);
  }, [commitState]);

  const saveDemoShipment = useCallback(async () => {
    if (!saveOperationRef.current) {
      saveOperationRef.current = createLocalOperation({
        shipmentId: draft.shipmentId,
        type: 'CREATE_SHIPMENT',
        baseVersion: 0,
        actor: { id: 'maya', name: 'Maya Chen', role: 'GENERATOR' },
        payload: {
          generator: draft.generator,
          site: draft.site,
          offeredQuantityLiters: draft.offeredQuantityLiters,
          driver: draft.driver,
          unit: draft.unit,
          unitType: draft.unitType,
          capacityLiters: draft.capacityLiters,
          product: draft.product,
        },
      });
    }

    const operation = saveOperationRef.current;
    await commitState((current) => ({
      ...current,
      queue: enqueueIdempotently(current.queue, operation),
      cachedHandoffIds: Array.from(new Set([...current.cachedHandoffIds, draft.shipmentId])),
      lastSavedShipmentId: draft.shipmentId,
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    navigate('SAVED');
  }, [commitState, draft, navigate]);

  const runSync = useCallback(async (force = false) => {
    const startState = stateRef.current;
    if (startState.demoConnectivity !== 'ONLINE' || syncLockRef.current) return;
    if (physicalOnline === false) {
      setApiConnectionStatus('UNAVAILABLE');
      setApiDiagnostic('The device has no network route. Nothing was sent.');
      return;
    }

    syncLockRef.current = true;
    setApiConnectionStatus('CHECKING');
    setApiDiagnostic(undefined);

    try {
      const health = await apiClientRef.current.health();
      if (health.status !== 200 || !('status' in health.body) || health.body.status !== 'ok') {
        setApiConnectionStatus('UNAVAILABLE');
        setApiDiagnostic(healthError(health.status));
        return;
      }
      setApiConnectionStatus('AVAILABLE');

      const now = Date.now();
      const candidates = stateRef.current.queue.filter(
        (operation) =>
          ['WAITING', 'CHECKING_RESULT', 'SYNCING'].includes(operation.status) &&
          (force || !operation.nextAttemptAt || Date.parse(operation.nextAttemptAt) <= now),
      );

      for (const candidate of candidates) {
        let currentOperation: SyncOperation | undefined;
        const startedAt = new Date().toISOString();
        await commitState((current) => {
          const operation = current.queue.find(
            (item) => item.operationId === candidate.operationId,
          );
          if (!operation || !['WAITING', 'CHECKING_RESULT', 'SYNCING'].includes(operation.status)) {
            return current;
          }
          currentOperation = operation;
          return {
            ...current,
            queue: updateOperationStatus(current.queue, candidate.operationId, 'SYNCING', {
              attempts: operation.attempts + 1,
              lastAttemptAt: startedAt,
              nextAttemptAt: undefined,
              lastError: undefined,
            }),
          };
        });
        if (!currentOperation) continue;
        const expectedAttempt = currentOperation.attempts + 1;

        // Use the pre-transition status so interrupted work checks the original
        // result before deciding whether a POST is necessary.
        const outcome = await synchronizeOperation(currentOperation, apiClientRef.current);
        const serverScope = {
          ...(outcome.registrationIdempotencyKey
            ? { registrationIdempotencyKey: outcome.registrationIdempotencyKey }
            : {}),
          ...(outcome.serverRunId ? { serverRunId: outcome.serverRunId } : {}),
          ...(outcome.serverShipmentId ? { serverShipmentId: outcome.serverShipmentId } : {}),
          ...(outcome.serverOperationId ? { serverOperationId: outcome.serverOperationId } : {}),
          ...(outcome.serverIdempotencyKey
            ? { serverIdempotencyKey: outcome.serverIdempotencyKey }
            : {}),
        };
        await commitState((current) => {
          const inFlight = current.queue.find(
            (operation) => operation.operationId === candidate.operationId,
          );
          // Reset or another explicit transition may have replaced this queue
          // while the network request was in flight. Apply the result only to
          // the exact attempt that was durably marked above.
          if (
            !inFlight ||
            inFlight.status !== 'SYNCING' ||
            inFlight.attempts !== expectedAttempt
          ) {
            return current;
          }
          const queue =
            outcome.status === 'SYNCED'
              ? updateOperationStatus(current.queue, candidate.operationId, 'SYNCED', {
                  ...serverScope,
                  serverVersion: outcome.serverVersion,
                  serverResultRecovered: outcome.recovered,
                  nextAttemptAt: undefined,
                  lastError: outcome.message,
                })
              : outcome.status === 'NEEDS_REVIEW'
                ? updateOperationStatus(current.queue, candidate.operationId, 'NEEDS_REVIEW', {
                    ...serverScope,
                    ...(outcome.serverVersion !== undefined
                      ? { serverVersion: outcome.serverVersion }
                      : {}),
                    nextAttemptAt: undefined,
                    lastError: outcome.message,
                  })
                : updateOperationStatus(current.queue, candidate.operationId, 'CHECKING_RESULT', {
                    ...serverScope,
                    nextAttemptAt: new Date(Date.now() + 15_000).toISOString(),
                    lastError: outcome.message,
                  });
          return {
            ...current,
            queue,
            ...(outcome.status === 'SYNCED' ? { lastSyncAt: new Date().toISOString() } : {}),
          };
        });
      }

      if (candidates.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
    } catch (error) {
      const diagnostic =
        error instanceof Error
          ? `${error.message}. Queued operations remain on this device.`
          : 'API connection failed. Queued operations remain on this device.';
      await commitState((current) => {
        const recoveredQueue = current.queue.map((operation) =>
          operation.status === 'SYNCING'
            ? {
                ...operation,
                status: 'CHECKING_RESULT' as const,
                nextAttemptAt: new Date(Date.now() + 15_000).toISOString(),
                lastError: `${diagnostic} The next pass will check the original idempotency key first.`,
              }
            : operation,
        );
        return recoveredQueue.some((operation, index) => operation !== current.queue[index])
          ? { ...current, queue: recoveredQueue }
          : current;
      }).catch(() => undefined);
      setApiConnectionStatus('UNAVAILABLE');
      setApiDiagnostic(diagnostic);
    } finally {
      syncLockRef.current = false;
    }
  }, [commitState, physicalOnline]);

  useEffect(() => {
    if (
      !hydrated ||
      state.demoConnectivity !== 'ONLINE' ||
      physicalOnline === false ||
      pendingOperationCount(state.queue) === 0
    ) {
      return;
    }

    const nextAttempt = state.queue
      .filter((operation) =>
        ['WAITING', 'CHECKING_RESULT', 'SYNCING'].includes(operation.status),
      )
      .map((operation) => (operation.nextAttemptAt ? Date.parse(operation.nextAttemptAt) : Date.now()))
      .sort((left, right) => left - right)[0];
    const delay = Math.max(1_200, (nextAttempt ?? Date.now()) - Date.now());
    const timer = setTimeout(() => void runSync(false), delay);
    return () => clearTimeout(timer);
  }, [hydrated, physicalOnline, runSync, state.demoConnectivity, state.queue]);

  const resolveOperationConflict = useCallback(
    async (operationId: string, choice: ConflictChoice) => {
      await commitState((current) => ({
        ...current,
        queue: resolveConflict(current.queue, operationId, choice),
      }));
      Haptics.selectionAsync().catch(() => undefined);
    },
    [commitState],
  );

  const resetDemo = useCallback(async () => {
    saveOperationRef.current = null;
    const fresh = cloneInitialState();
    await commitState(() => fresh);
    setDraft({ ...INITIAL_SHIPMENT_DRAFT });
    setApiConnectionStatus('IDLE');
    setApiDiagnostic(undefined);
    setScreen('HOME');
    setActiveTab('HOME');
  }, [commitState]);

  const value = useMemo<FieldRelayContextValue>(
    () => ({
      hydrated,
      screen,
      activeTab,
      state,
      draft,
      pendingCount: pendingOperationCount(state.queue),
      demoOnline: state.demoConnectivity === 'ONLINE',
      physicalOnline,
      apiBaseUrl: apiClientRef.current.baseUrl,
      apiConnectionStatus,
      apiDiagnostic,
      storageDiagnostic,
      navigate,
      selectTab,
      goBack,
      updateDraft,
      toggleDemoConnectivity,
      saveDemoShipment,
      runSync,
      resolveOperationConflict,
      resetDemo,
    }),
    [
      activeTab,
      apiConnectionStatus,
      apiDiagnostic,
      draft,
      goBack,
      hydrated,
      navigate,
      physicalOnline,
      resetDemo,
      resolveOperationConflict,
      runSync,
      saveDemoShipment,
      screen,
      selectTab,
      state,
      storageDiagnostic,
      toggleDemoConnectivity,
      updateDraft,
    ],
  );

  return <FieldRelayContext.Provider value={value}>{children}</FieldRelayContext.Provider>;
}

export function useFieldRelay(): FieldRelayContextValue {
  const context = useContext(FieldRelayContext);
  if (!context) throw new Error('useFieldRelay must be used within FieldRelayProvider');
  return context;
}
