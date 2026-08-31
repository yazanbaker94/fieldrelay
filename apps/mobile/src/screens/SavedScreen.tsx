import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { useFieldRelay } from '../state/FieldRelayProvider';
import { colors, fonts, spacing } from '../theme';

export function SavedScreen() {
  const { navigate, state } = useFieldRelay();
  const shipmentId = state.lastSavedShipmentId ?? 'FR-2026-0844';
  const operation = [...state.queue].reverse().find((item) => item.shipmentId === shipmentId);

  return (
    <ScreenFrame testID="saved-on-device-screen" bottomNav={false}>
      <View style={styles.recordTop}>
        <AppText variant="mono" color={colors.muted}>
          LOCAL RECEIPT / {operation?.operationId ?? 'DEVICE LEDGER'}
        </AppText>
        <AppText variant="label" color={colors.blue}>
          FieldRelay
        </AppText>
      </View>
      <View style={styles.body}>
        <View style={styles.deviceMark}>
          <Ionicons name="phone-portrait-outline" size={52} color={colors.surface} />
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={22} color={colors.surface} />
          </View>
        </View>

        <View style={styles.copy}>
          <AppText variant="heading" style={{ textAlign: 'center', fontSize: 30 }}>
            Saved on this device
          </AppText>
          <AppText style={styles.message}>
            Shipment <AppText style={styles.inlineId}>{shipmentId}</AppText> is safe on this phone.
          </AppText>
          <AppText style={styles.message}>
            FieldRelay will synchronize automatically when connectivity returns.
          </AppText>
        </View>

        <View style={styles.receipt}>
          <View>
            <AppText variant="label" color={colors.muted}>
              Stored
            </AppText>
            <AppText variant="monoMedium">
              ON DEVICE / {operation?.deviceTimestamp.slice(11, 16) ?? 'NOW'}
            </AppText>
          </View>
          <View style={styles.receiptRule} />
          <View>
            <AppText variant="label" color={colors.muted}>
              Next
            </AppText>
            <AppText variant="monoMedium">WAITING FOR CONNECTION</AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="VIEW SHIPMENTS" onPress={() => navigate('SHIPMENTS')} />
          <PrimaryButton label="VIEW SYNC STATUS" tone="outline" onPress={() => navigate('SYNC')} />
        </View>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  recordTop: {
    minHeight: 62,
    paddingHorizontal: 16,
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: {
    flex: 1,
    minHeight: 660,
    paddingHorizontal: spacing.lg,
    paddingVertical: 42,
    alignItems: 'center',
  },
  deviceMark: {
    width: 112,
    height: 112,
    marginBottom: 32,
    borderRadius: 56,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    right: 4,
    bottom: 5,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.dark,
    borderColor: colors.paper,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: 22,
    alignItems: 'center',
  },
  message: {
    maxWidth: 330,
    fontSize: 19,
    lineHeight: 29,
    textAlign: 'center',
  },
  inlineId: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 18,
  },
  receipt: {
    width: '100%',
    marginTop: 36,
    paddingVertical: 13,
    borderTopColor: colors.rule,
    borderBottomColor: colors.rule,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptRule: {
    width: 1,
    backgroundColor: colors.rule,
  },
  actions: {
    width: '100%',
    marginTop: 'auto',
    paddingTop: 40,
    gap: 12,
  },
});
