import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';
import { DarkHeader } from '../components/DarkHeader';
import { DemoControl } from '../components/DemoControl';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { TechnicalDetails, TechnicalRow } from '../components/TechnicalDetails';
import { useFieldRelay } from '../state/FieldRelayProvider';
import { groupQueue } from '../storage/offlineQueue';
import { colors, fonts, ledgerCard, spacing } from '../theme';
import type { SyncOperation } from '../types';

const operationNames: Record<SyncOperation['kind'], string> = {
  CREATE_SHIPMENT: 'Create shipment',
  RECORD_PICKUP: 'Confirm pickup',
  RECORD_RECEIPT: 'Record receiver quantity',
  RESOLVE_EXCEPTION: 'Resolve discrepancy',
};

function savedTime(iso: string) {
  return iso.slice(11, 16);
}

function OperationRow({ operation }: { operation: SyncOperation }) {
  const { resolveOperationConflict } = useFieldRelay();
  const needsReview = operation.status === 'NEEDS_REVIEW';
  const checking = operation.status === 'CHECKING_RESULT';
  const syncing = operation.status === 'SYNCING';
  const synced = operation.status === 'SYNCED';
  const accent = needsReview
    ? colors.orange
    : synced
      ? colors.green
      : syncing || checking
        ? colors.blue
        : colors.orange;
  const statusText = needsReview
    ? 'Needs review'
    : synced
      ? 'Synced'
      : syncing
        ? 'Synchronizing'
        : checking
          ? 'Checking sync result'
          : 'Waiting for connection';

  return (
    <View style={styles.operationRow}>
      <View style={[styles.operationMarker, { borderColor: accent }]}>
        <Ionicons
          name={
            needsReview
              ? 'alert'
              : synced
                ? 'checkmark'
                : syncing || checking
                  ? 'sync'
                  : 'cloud-upload-outline'
          }
          size={15}
          color={accent}
        />
      </View>
      <View style={styles.operationBody}>
        <View style={styles.operationHeading}>
          <View style={{ flex: 1 }}>
            <AppText variant="monoMedium" style={{ fontSize: 15 }}>
              {operation.shipmentId}
            </AppText>
            <AppText variant="bodyMedium" style={{ fontSize: 15 }}>
              {operationNames[operation.kind]}
            </AppText>
          </View>
          <AppText variant="caption" color={accent} style={{ textAlign: 'right' }}>
            {statusText}
          </AppText>
        </View>
        <AppText variant="caption" color={colors.muted}>
          Saved {savedTime(operation.deviceCreatedAt)} ·{' '}
          {needsReview
            ? 'Choose a safe outcome; the server will not be overwritten.'
            : checking
              ? 'FieldRelay is querying the original key, not sending a second mutation.'
              : synced
                ? 'The server confirmed the original operation.'
                : 'The same operation will be sent when online.'}
        </AppText>

        {needsReview ? (
          <View style={styles.conflictBox}>
            <AppText variant="caption" color={colors.muted}>
              Server version 2 is newer than local base version {operation.baseVersion}.
            </AppText>
            <PrimaryButton
              label="SEND LOCAL ENTRY FOR REVIEW"
              compact
              onPress={() => resolveOperationConflict(operation.localOperationId, 'SEND_FOR_REVIEW')}
            />
            <PrimaryButton
              label="KEEP AS SEPARATE DRAFT"
              compact
              tone="outline"
              onPress={() => resolveOperationConflict(operation.localOperationId, 'KEEP_DRAFT')}
            />
            <PrimaryButton
              label="USE SERVER VERSION"
              compact
              tone="outline"
              onPress={() => resolveOperationConflict(operation.localOperationId, 'USE_SERVER')}
            />
          </View>
        ) : null}

        <TechnicalDetails>
          <TechnicalRow label="Local operation" value={operation.localOperationId} />
          <TechnicalRow label="Idempotency key" value={operation.idempotencyKey} />
          <TechnicalRow label="Base version" value={String(operation.baseVersion)} />
          <TechnicalRow label="Device timestamp" value={operation.deviceCreatedAt} />
          <TechnicalRow label="Attempts" value={String(operation.attempts)} />
          {operation.serverOperationId ? (
            <TechnicalRow label="Server result" value={operation.serverOperationId} />
          ) : null}
          {operation.lastError ? <TechnicalRow label="Diagnostic" value={operation.lastError} /> : null}
        </TechnicalDetails>
      </View>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupTitle}>
        <AppText variant="label" color={colors.muted}>
          {title}
        </AppText>
      </View>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

function EmptyGroup({ copy }: { copy: string }) {
  return (
    <View style={styles.emptyGroup}>
      <Ionicons name="remove" size={18} color={colors.muted} />
      <AppText variant="caption" color={colors.muted}>
        {copy}
      </AppText>
    </View>
  );
}

export function SyncScreen() {
  const {
    demoOnline,
    pendingCount,
    resetDemo,
    runSync,
    state,
  } = useFieldRelay();
  const groups = groupQueue(state.queue);

  return (
    <ScreenFrame testID="sync-center-screen">
      <DarkHeader title="SYNC CENTER" eyebrow="DEVICE / 7A3F" actionIcon="settings-outline" onAction={() => undefined} />
      <DemoControl />
      <View style={styles.body}>
        <View style={styles.statusCard}>
          <Ionicons name="cloud-upload-outline" size={42} color={colors.blue} />
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color={colors.muted}>
              Status
            </AppText>
            <AppText variant="heading" style={{ fontSize: 24 }}>
              {pendingCount} actions pending
            </AppText>
            <AppText color={colors.muted}>
              Your data is safe. We’ll sync everything when you’re online.
            </AppText>
          </View>
        </View>

        <View style={styles.lastSync}>
          <View>
            <AppText variant="caption" color={colors.muted}>
              Last sync
            </AppText>
            <AppText variant="monoMedium">07 MAY 2026 / 13:57</AppText>
          </View>
          <AppText variant="caption" color={colors.green}>
            Last confirmed batch complete
          </AppText>
        </View>

        <Group title={`Needs attention / ${groups.needsAttention.length}`}>
          {groups.needsAttention.length ? (
            groups.needsAttention.map((operation) => (
              <OperationRow key={operation.localOperationId} operation={operation} />
            ))
          ) : (
            <EmptyGroup copy="No conflicts require a decision." />
          )}
        </Group>

        <Group title={`Waiting for connection / ${groups.waiting.length}`}>
          {groups.waiting.length ? (
            groups.waiting.map((operation) => (
              <OperationRow key={operation.localOperationId} operation={operation} />
            ))
          ) : (
            <EmptyGroup copy="No operations are waiting." />
          )}
        </Group>

        <Group title={`Synchronizing / ${groups.synchronizing.length}`}>
          {groups.synchronizing.length ? (
            groups.synchronizing.map((operation) => (
              <OperationRow key={operation.localOperationId} operation={operation} />
            ))
          ) : (
            <EmptyGroup copy="No operations are in flight." />
          )}
        </Group>

        <Group title="Recently synced">
          {groups.synced.map((operation) => (
            <OperationRow key={operation.localOperationId} operation={operation} />
          ))}
          <View style={styles.recentRow}>
            <Ionicons name="checkmark" size={21} color={colors.green} />
            <View style={{ flex: 1 }}>
              <AppText variant="monoMedium">FR-2026-0841</AppText>
              <AppText variant="caption" color={colors.muted}>
                Confirm pickup · Saved 12:41
              </AppText>
            </View>
            <AppText variant="caption" color={colors.green}>
              Synced 12:41
            </AppText>
          </View>
          <View style={styles.recentRow}>
            <Ionicons name="checkmark" size={21} color={colors.green} />
            <View style={{ flex: 1 }}>
              <AppText variant="monoMedium">FR-2026-0840</AppText>
              <AppText variant="caption" color={colors.muted}>
                Complete shipment · Saved 11:29
              </AppText>
            </View>
            <AppText variant="caption" color={colors.green}>
              Synced 11:29
            </AppText>
          </View>
        </Group>

        <PrimaryButton
          label={demoOnline ? 'SYNC NOW' : 'WAITING FOR CONNECTION'}
          tone="dark"
          icon={demoOnline ? 'sync' : 'cloud-offline-outline'}
          disabled={!demoOnline || pendingCount === 0}
          onPress={() => void runSync()}
        />

        <View style={styles.safetyNote}>
          <Ionicons name="lock-closed-outline" size={23} color={colors.muted} />
          <AppText variant="caption" color={colors.muted} style={{ flex: 1 }}>
            Offline is not an error, so there is no retry button. Operations remain on this device
            and use their original idempotency keys.
          </AppText>
        </View>

        <TechnicalDetails title="Demo controls and diagnostics">
          <TechnicalRow label="Persistence" value="AsyncStorage / schema v1" />
          <TechnicalRow label="Queue record count" value={String(state.queue.length)} />
          <TechnicalRow label="Conflict policy" value="No overwrite / explicit safe outcome" />
          <View style={{ paddingVertical: 12 }}>
            <PrimaryButton label="RESET DEMO DATA" tone="violet" compact onPress={() => void resetDemo()} />
          </View>
        </TechnicalDetails>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.md,
    paddingBottom: 30,
    gap: spacing.lg,
  },
  statusCard: {
    ...ledgerCard,
    padding: 18,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  lastSync: {
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    paddingBottom: 14,
    gap: 5,
  },
  group: {
    gap: 0,
  },
  groupTitle: {
    minHeight: 40,
    justifyContent: 'center',
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
  },
  groupBody: {
    ...ledgerCard,
    borderTopWidth: 0,
    overflow: 'hidden',
  },
  operationRow: {
    padding: 13,
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  operationMarker: {
    width: 28,
    height: 28,
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operationBody: {
    flex: 1,
    gap: 9,
  },
  operationHeading: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  conflictBox: {
    padding: 10,
    borderLeftColor: colors.orange,
    borderLeftWidth: 3,
    backgroundColor: colors.orangeSoft,
    gap: 8,
  },
  emptyGroup: {
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recentRow: {
    minHeight: 70,
    paddingHorizontal: 14,
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  safetyNote: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
  },
});

