import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { DEMO_SHIPMENTS } from '../data';
import { useFieldRelay } from '../state/FieldRelayProvider';
import { colors, fonts, ledgerCard, spacing, touchTarget } from '../theme';
import type { Shipment } from '../types';
import { AppText } from '../components/AppText';
import { DemoControl } from '../components/DemoControl';
import { PrimaryButton } from '../components/PrimaryButton';
import { RelayMark } from '../components/RelayMark';
import { ScreenFrame } from '../components/ScreenFrame';

function ShipmentRow({ shipment, onPress }: { shipment: Shipment; onPress: () => void }) {
  const discrepancy = shipment.exception === 'DISCREPANCY_OPEN';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${shipment.id}, ${shipment.lifecycle.toLowerCase().replace('_', ' ')}, ${
        discrepancy ? 'discrepancy open' : shipment.sync.toLowerCase()
      }`}
      onPress={onPress}
      style={({ pressed }) => [styles.shipmentRow, pressed && styles.rowPressed]}
    >
      <View style={styles.rowMain}>
        <AppText variant="monoHeading" style={{ fontSize: 17 }}>
          {shipment.id}
        </AppText>
        <AppText color={colors.muted} style={{ fontSize: 15 }}>
          {shipment.lifecycle.replaceAll('_', ' ').toLowerCase().replace(/^./, (v) => v.toUpperCase())}
        </AppText>
      </View>
      <View style={styles.rowStatus}>
        <View style={styles.statusCopy}>
          <Ionicons
            name={discrepancy ? 'alert-circle' : 'checkmark-circle'}
            size={18}
            color={discrepancy ? colors.orange : colors.green}
          />
          <AppText
            variant="caption"
            color={discrepancy ? colors.orange : colors.green}
            style={{ fontFamily: fonts.sansMedium }}
          >
            {discrepancy ? 'Discrepancy open' : 'Synced'}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={21} color={colors.muted} />
      </View>
    </Pressable>
  );
}

export function HomeScreen() {
  const { demoOnline, navigate, pendingCount } = useFieldRelay();

  return (
    <ScreenFrame testID="home-screen">
      <View style={styles.utilityHeader}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <AppText style={styles.brandMarkText}>F/R</AppText>
          </View>
          <View>
            <AppText variant="monoMedium" color={colors.surface}>
              FIELDRELAY
            </AppText>
            <AppText variant="caption" color="#9AAAB6">
              DISPATCH LEDGER
            </AppText>
          </View>
        </View>
        <RelayMark width={104} activeStep={demoOnline ? 6 : 2} color="#5C95E5" />
      </View>
      <DemoControl />

      <View style={styles.body}>
        <View style={styles.pageHeading}>
          <View>
            <AppText variant="label" color={colors.blue}>
              Home
            </AppText>
            <AppText variant="title">{demoOnline ? 'Connected' : 'Offline'}</AppText>
          </View>
          <Ionicons
            name={demoOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
            size={35}
            color={demoOnline ? colors.green : colors.muted}
          />
        </View>

        <View
          accessibilityRole="alert"
          style={[styles.offlinePanel, demoOnline && styles.onlinePanel]}
        >
          <View style={[styles.panelRule, demoOnline && { backgroundColor: colors.green }]} />
          <Ionicons
            name={demoOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
            size={30}
            color={demoOnline ? colors.green : colors.orange}
          />
          <View style={styles.panelCopy}>
            <AppText
              variant="bodyMedium"
              color={demoOnline ? colors.green : colors.orange}
              style={{ fontSize: 18 }}
            >
              {demoOnline ? 'Ready to synchronize' : 'Offline'}
            </AppText>
            <AppText style={{ fontSize: 17 }}>{pendingCount} actions saved on this device</AppText>
            <AppText color={colors.muted} style={{ fontSize: 15 }}>
              {demoOnline
                ? 'Open Sync Center to follow synchronization'
                : 'Switch Demo network online to sync now'}
            </AppText>
          </View>
        </View>

        <PrimaryButton
          label="CREATE SHIPMENT"
          icon="add"
          onPress={() => navigate('CREATE')}
          accessibilityHint="Starts a shipment that can be saved without connectivity"
        />

        <View style={styles.sectionHeader}>
          <AppText variant="label" color={colors.muted}>
            Today's shipments
          </AppText>
          <AppText variant="mono" color={colors.muted}>
            03 records
          </AppText>
        </View>
        <View style={styles.shipmentList}>
          {DEMO_SHIPMENTS.map((shipment) => (
            <ShipmentRow
              key={shipment.id}
              shipment={shipment}
              onPress={() => navigate(shipment.id === 'FR-2026-0842' ? 'DISCREPANCY' : 'SHIPMENTS')}
            />
          ))}
        </View>

        <View style={styles.recordFooter}>
          <AppText variant="mono" color={colors.muted}>
            DEVICE / 7A3F
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            Local operations persist through restart.
          </AppText>
        </View>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  utilityHeader: {
    minHeight: 78,
    paddingHorizontal: 16,
    backgroundColor: colors.dark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderColor: '#70808C',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: colors.surface,
    fontFamily: fonts.monoSemiBold,
    fontSize: 12,
  },
  body: {
    padding: spacing.md,
    paddingBottom: 30,
    gap: spacing.lg,
  },
  pageHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  offlinePanel: {
    ...ledgerCard,
    minHeight: 138,
    position: 'relative',
    overflow: 'hidden',
    padding: 18,
    paddingLeft: 22,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    backgroundColor: colors.orangeSoft,
    borderColor: '#F3C6A8',
  },
  onlinePanel: {
    backgroundColor: colors.greenSoft,
    borderColor: '#B7D9C1',
  },
  panelRule: {
    position: 'absolute',
    width: 5,
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.orange,
  },
  panelCopy: {
    flex: 1,
    gap: 8,
  },
  sectionHeader: {
    marginBottom: -12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shipmentList: {
    ...ledgerCard,
    overflow: 'hidden',
  },
  shipmentRow: {
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowPressed: {
    backgroundColor: colors.blueSoft,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowStatus: {
    maxWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  recordFooter: {
    borderTopColor: colors.rule,
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 3,
  },
});
