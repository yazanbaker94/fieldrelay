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
import { DEMO_SHIPMENT } from '../data';
import {
  cloneInitialState,
  createLocalOperation,
  enqueueIdempotently,
  loadMobileState,
  pendingOperationCount,
  persistMobileState,
  resolveConflict,
  updateOperationStatus,
} from '../storage/offlineQueue';
import type {
  BottomTab,
  ConflictChoice,
  PersistedMobileState,
  RootScreen,
  SyncOperation,
} from '../types';

interface FieldRelayContextValue {
  hydrated: boolean;
  screen: RootScreen;
  activeTab: BottomTab;
  state: PersistedMobileState;
  pendingCount: number;
  demoOnline: boolean;
  physicalOnline: boolean | null;
  navigate: (screen: RootScreen) => void;
  selectTab: (tab: BottomTab) => void;
  goBack: () => void;
  toggleDemoConnectivity: () => void;
  saveDemoShipment: () => void;
  runSync: () => Promise<void>;
  resolveOperationConflict: (localOperationId: string, choice: ConflictChoice) => void;
  resetDemo: () => Promise<void>;
}

const FieldRelayContext = createContext<FieldRelayContextValue | null>(null);

const tabScreens: Record<BottomTab, RootScreen> = {
  HOME: 'HOME',
  CREATE: 'CREATE',
  SHIPMENTS: 'SHIPMENTS',
  SYNC: 'SYNC',
};

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function FieldRelayProvider({ children }: PropsWithChildren) {
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<RootScreen>('HOME');
  const [activeTab, setActiveTab] = useState<BottomTab>('HOME');
  const [state, setState] = useState<PersistedMobileState>(cloneInitialState);
  const [physicalOnline, setPhysicalOnline] = useState<boolean | null>(null);
  const saveOperationRef = useRef<SyncOperation | null>(null);
  const syncLockRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadMobileState()
      .then((loaded) => {
        if (!cancelled) {
          setState(loaded);
          setHydrated(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState(cloneInitialState());
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

  useEffect(() => {
    if (hydrated) {
      persistMobileState(state).catch(() => {
        // The data remains in memory. A later state update will retry persistence.
      });
    }
  }, [hydrated, state]);

  const navigate = useCallback((nextScreen: RootScreen) => {
    setScreen(nextScreen);
    if (nextScreen === 'HOME') setActiveTab('HOME');
    if (['CREATE', 'REVIEW', 'SAVED'].includes(nextScreen)) setActiveTab('CREATE');
    if (['SHIPMENTS', 'DISCREPANCY'].includes(nextScreen)) setActiveTab('SHIPMENTS');
    if (nextScreen === 'SYNC') setActiveTab('SYNC');
  }, []);

  const selectTab = useCallback(
    (tab: BottomTab) => {
      setActiveTab(tab);
      setScreen(tabScreens[tab]);
    },
    [],
  );

  const goBack = useCallback(() => {
    setScreen((current) => {
      if (current === 'REVIEW') return 'CREATE';
      if (current === 'SAVED') return 'HOME';
      if (current === 'DISCREPANCY') return 'SHIPMENTS';
      return 'HOME';
    });
  }, []);

  const toggleDemoConnectivity = useCallback(() => {
    setState((current) => ({
      ...current,
      demoConnectivity: current.demoConnectivity === 'OFFLINE' ? 'ONLINE' : 'OFFLINE',
    }));
    Haptics.selectionAsync().catch(() => undefined);
  }, []);

  const saveDemoShipment = useCallback(() => {
    if (!saveOperationRef.current) {
      saveOperationRef.current = createLocalOperation({
        shipmentId: DEMO_SHIPMENT.id,
        kind: 'CREATE_SHIPMENT',
        baseVersion: 0,
        payload: {
          generator: DEMO_SHIPMENT.generator,
          site: DEMO_SHIPMENT.site,
          offeredQuantityLitres: 8_200,
          driver: DEMO_SHIPMENT.driver,
          unit: DEMO_SHIPMENT.unit,
        },
      });
    }

    setState((current) => ({
      ...current,
      queue: enqueueIdempotently(current.queue, saveOperationRef.current as SyncOperation),
      cachedHandoffIds: Array.from(new Set([...current.cachedHandoffIds, DEMO_SHIPMENT.id])),
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    navigate('SAVED');
  }, [navigate]);

  const runSync = useCallback(async () => {
    if (state.demoConnectivity !== 'ONLINE' || syncLockRef.current) {
      return;
    }

    syncLockRef.current = true;
    const candidates = state.queue.filter((operation) =>
      ['WAITING', 'CHECKING_RESULT'].includes(operation.status),
    );

    try {
      for (const operation of candidates) {
        setState((current) => ({
          ...current,
          queue: updateOperationStatus(current.queue, operation.localOperationId, 'SYNCING', {
            attempts: operation.attempts + 1,
            lastError: undefined,
          }),
        }));
        await delay(550);
        setState((current) => ({
          ...current,
          queue: updateOperationStatus(current.queue, operation.localOperationId, 'SYNCED', {
            serverOperationId: `SVR-${operation.localOperationId.slice(-8)}`,
          }),
          lastSyncAt: new Date().toISOString(),
        }));
        await delay(220);
      }

      if (candidates.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
    } finally {
      syncLockRef.current = false;
    }
  }, [state.demoConnectivity, state.queue]);

  useEffect(() => {
    if (
      !hydrated ||
      state.demoConnectivity !== 'ONLINE' ||
      pendingOperationCount(state.queue) === 0
    ) {
      return;
    }

    const timer = setTimeout(() => {
      void runSync();
    }, 1_200);
    return () => clearTimeout(timer);
  }, [hydrated, runSync, state.demoConnectivity, state.queue]);

  const resolveOperationConflict = useCallback(
    (localOperationId: string, choice: ConflictChoice) => {
      setState((current) => ({
        ...current,
        queue: resolveConflict(current.queue, localOperationId, choice),
      }));
      Haptics.selectionAsync().catch(() => undefined);
    },
    [],
  );

  const resetDemo = useCallback(async () => {
    saveOperationRef.current = null;
    const fresh = cloneInitialState();
    setState(fresh);
    setScreen('HOME');
    setActiveTab('HOME');
    await persistMobileState(fresh);
  }, []);

  const value = useMemo<FieldRelayContextValue>(
    () => ({
      hydrated,
      screen,
      activeTab,
      state,
      pendingCount: pendingOperationCount(state.queue),
      demoOnline: state.demoConnectivity === 'ONLINE',
      physicalOnline,
      navigate,
      selectTab,
      goBack,
      toggleDemoConnectivity,
      saveDemoShipment,
      runSync,
      resolveOperationConflict,
      resetDemo,
    }),
    [
      activeTab,
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
      toggleDemoConnectivity,
    ],
  );

  return <FieldRelayContext.Provider value={value}>{children}</FieldRelayContext.Provider>;
}

export function useFieldRelay(): FieldRelayContextValue {
  const context = useContext(FieldRelayContext);
  if (!context) {
    throw new Error('useFieldRelay must be used within FieldRelayProvider');
  }
  return context;
}
