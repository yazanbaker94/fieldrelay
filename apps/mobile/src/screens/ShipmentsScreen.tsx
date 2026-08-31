import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '../components/AppText';
import { DarkHeader } from '../components/DarkHeader';
import { DemoControl } from '../components/DemoControl';
import { PrimaryButton } from '../components/PrimaryButton';
import { RelayMark } from '../components/RelayMark';
import { ScreenFrame } from '../components/ScreenFrame';
import { DEMO_SHIPMENTS } from '../data';
import { useFieldRelay } from '../state/FieldRelayProvider';
import { colors, fonts, ledgerCard, spacing, touchTarget } from '../theme';

export function ShipmentsScreen() {
  const { demoOnline, navigate, state } = useFieldRelay();
  const [handoffCode, setHandoffCode] = useState('');
  const [handoffMessage, setHandoffMessage] = useState<string | null>(null);

  const loadHandoff = () => {
    if (!demoOnline) {
      setHandoffMessage('Connection required. This handoff has not been loaded on this device.');
      return;
    }
    setHandoffMessage('Handoff loaded and now available for offline continuation.');
  };

  return (
    <ScreenFrame testID="shipments-screen">
      <DarkHeader title="SHIPMENTS" eyebrow="FR / FIELD RECORDS" />
      <DemoControl />
      <View style={styles.body}>
        <View style={styles.headingRow}>
          <View>
            <AppText variant="label" color={colors.blue}>
              Chain of custody
            </AppText>
            <AppText variant="heading">All shipments</AppText>
          </View>
          <AppText variant="mono" color={colors.muted}>
            03 / ACTIVE
          </AppText>
        </View>

        <View style={styles.list}>
          {DEMO_SHIPMENTS.map((shipment, index) => {
            const discrepancy = shipment.exception === 'DISCREPANCY_OPEN';
            return (
              <Pressable
                key={shipment.id}
                accessibilityRole="button"
                onPress={() => shipment.id === 'FR-2026-0842' && navigate('DISCREPANCY')}
                style={({ pressed }) => [styles.shipment, pressed && { backgroundColor: colors.blueSoft }]}
              >
                <View style={styles.sequence}>
                  <AppText variant="monoMedium" color={discrepancy ? colors.orange : colors.muted}>
                    {String(index + 1).padStart(2, '0')}
                  </AppText>
                  <View style={[styles.sequenceRule, discrepancy && { backgroundColor: colors.orange }]} />
                </View>
                <View style={styles.shipmentCopy}>
                  <AppText variant="monoHeading" style={{ fontSize: 17 }}>
                    {shipment.id}
                  </AppText>
                  <AppText color={colors.muted} style={{ fontSize: 14 }}>
                    {shipment.generator} · {shipment.site}
                  </AppText>
                  <View style={styles.traceRow}>
                    <RelayMark width={106} activeStep={shipment.lifecycle === 'COMPLETED' ? 6 : shipment.lifecycle === 'IN_TRANSIT' ? 3 : 4} />
                    <AppText variant="caption" color={discrepancy ? colors.orange : colors.green}>
                      {discrepancy ? 'Discrepancy open' : shipment.lifecycle.replaceAll('_', ' ')}
                    </AppText>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={21} color={colors.muted} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.loadedCard}>
          <View style={styles.cardTitle}>
            <Ionicons name="checkmark-circle" size={22} color={colors.green} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyMedium">Previously loaded handoff</AppText>
              <AppText variant="mono" color={colors.green}>
                FR-2026-0842 / CACHED
              </AppText>
            </View>
          </View>
          <AppText variant="caption" color={colors.muted}>
            This scoped record and its handoff token are on the device, so work may continue offline.
          </AppText>
        </View>

        <View style={styles.handoffCard}>
          <View style={styles.cardTitle}>
            <Ionicons name="qr-code-outline" size={22} color={colors.blue} />
            <AppText variant="monoMedium">OPEN NEW HANDOFF</AppText>
          </View>
          <AppText variant="caption" color={colors.muted}>
            First-time links and QR codes must be validated online before they can be cached safely.
          </AppText>
          <TextInput
            accessibilityLabel="Handoff code"
            autoCapitalize="characters"
            placeholder="Enter handoff code"
            placeholderTextColor="#848B91"
            value={handoffCode}
            onChangeText={(value) => {
              setHandoffCode(value);
              setHandoffMessage(null);
            }}
            style={styles.handoffInput}
          />
          <PrimaryButton label="LOAD HANDOFF CODE" tone="outline" compact onPress={loadHandoff} />
          {handoffMessage ? (
            <View
              accessibilityRole="alert"
              style={[styles.message, demoOnline ? styles.successMessage : styles.errorMessage]}
            >
              <Ionicons
                name={demoOnline ? 'checkmark-circle-outline' : 'cloud-offline-outline'}
                size={20}
                color={demoOnline ? colors.green : colors.orange}
              />
              <AppText variant="caption" style={{ flex: 1 }}>
                {handoffMessage}
              </AppText>
            </View>
          ) : null}
        </View>

        <AppText variant="caption" color={colors.muted}>
          Cached handoffs on this device: {state.cachedHandoffIds.length}. FieldRelay never claims a
          new handoff can open offline.
        </AppText>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.md,
    paddingBottom: 28,
    gap: spacing.lg,
  },
  headingRow: {
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  list: {
    ...ledgerCard,
    overflow: 'hidden',
  },
  shipment: {
    minHeight: 112,
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  sequence: {
    width: 48,
    paddingTop: 16,
    alignItems: 'center',
  },
  sequenceRule: {
    flex: 1,
    width: 1,
    marginTop: 7,
    backgroundColor: colors.rule,
  },
  shipmentCopy: {
    flex: 1,
    paddingVertical: 14,
    gap: 3,
  },
  traceRow: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loadedCard: {
    ...ledgerCard,
    borderLeftColor: colors.green,
    borderLeftWidth: 4,
    padding: 14,
    gap: 10,
    backgroundColor: colors.greenSoft,
  },
  handoffCard: {
    ...ledgerCard,
    padding: 14,
    gap: 12,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  handoffInput: {
    minHeight: touchTarget,
    paddingHorizontal: 12,
    borderColor: colors.rule,
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: fonts.monoMedium,
    fontSize: 15,
  },
  message: {
    padding: 10,
    borderLeftWidth: 3,
    flexDirection: 'row',
    gap: 8,
  },
  errorMessage: {
    backgroundColor: colors.orangeSoft,
    borderLeftColor: colors.orange,
  },
  successMessage: {
    backgroundColor: colors.greenSoft,
    borderLeftColor: colors.green,
  },
});

