import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';
import { normalizeBaseUrl } from '../api/client';
import { DarkHeader } from '../components/DarkHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { TechnicalDetails, TechnicalRow } from '../components/TechnicalDetails';
import { DEMO_SHIPMENT } from '../data';
import {
  calculateDiscrepancy,
  formatSignedLitres,
  formatSignedPercent,
} from '../domain/discrepancy';
import { useFieldRelay } from '../state/FieldRelayProvider';
import { colors, fonts, ledgerCard, spacing } from '../theme';

export function DiscrepancyScreen() {
  const { goBack } = useFieldRelay();
  const result = calculateDiscrepancy(8_180, 7_940);
  const operationsUrl = `${normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL)}/app/exceptions`;

  return (
    <ScreenFrame testID="receiver-discrepancy-screen" bottomNav={false}>
      <DarkHeader
        title="FR-2026-0842"
        eyebrow="RECEIVER RECORD"
        onBack={goBack}
        actionIcon="ellipsis-vertical"
        onAction={() => undefined}
      />
      <View style={styles.body}>
        <View style={styles.discrepancyCard}>
          <View style={styles.cardHeading}>
            <AppText variant="monoMedium" color={colors.orange}>
              DISCREPANCY
            </AppText>
            <Ionicons name="warning-outline" size={28} color={colors.orange} />
          </View>
          <AppText style={styles.delta}>
            {formatSignedLitres(result.differenceLitres)} /{' '}
            {formatSignedPercent(result.differencePercent)}
          </AppText>
          <View style={styles.threshold}>
            <AppText variant="caption" color={colors.orange}>
              Threshold
            </AppText>
            <AppText variant="bodyMedium">Exceeded 100 L and 1%</AppText>
          </View>
          <View style={styles.explanation}>
            <Ionicons name="information-circle-outline" size={22} color={colors.orange} />
            <AppText style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>
              Difference exceeds both 100 L and 1%. Receipt can be recorded, but the shipment will
              remain under Operations review.
            </AppText>
          </View>
        </View>

        <View>
          <AppText variant="label" style={styles.sectionLabel}>
            Reported quantities
          </AppText>
          <View style={styles.evidence}>
            {DEMO_SHIPMENT.events.map((event) => {
              const received = event.label === 'Received';
              return (
                <View key={event.id} style={styles.evidenceRow}>
                  <View style={[styles.node, received && styles.receivedNode]}>
                    <AppText variant="monoMedium" color={received ? colors.orange : colors.ink}>
                      {String(event.step).padStart(2, '0')}
                    </AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyMedium" color={received ? colors.orange : colors.ink}>
                      {event.label}
                    </AppText>
                    <AppText variant="caption" color={colors.muted}>
                      {event.actor} · {event.time}
                    </AppText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <AppText style={[styles.quantity, received && { color: colors.orange }]}>
                      {event.quantityLitres.toLocaleString('en-CA')} L
                    </AppText>
                    <AppText variant="mono" color={colors.muted} style={{ fontSize: 11 }}>
                      {event.id}
                    </AppText>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.readOnlyField}>
          <AppText variant="label" color={colors.muted}>
            Receiver reason
          </AppText>
          <AppText>Short delivery / line loss</AppText>
        </View>
        <View style={styles.readOnlyField}>
          <AppText variant="label" color={colors.muted}>
            Receiver note
          </AppText>
          <AppText>Valve restriction during pump out.</AppText>
        </View>

        <View style={styles.immutableNote}>
          <Ionicons name="lock-closed-outline" size={22} color={colors.blue} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyMedium">Receiver evidence is immutable.</AppText>
            <AppText variant="caption" color={colors.muted}>
              This device cannot alter reported quantities or resolve the Operations exception.
            </AppText>
          </View>
        </View>

        <TechnicalDetails>
          <TechnicalRow label="Shipment" value="FR / 2026 / 0842" />
          <TechnicalRow label="Exception" value="EX / 0037" />
          <TechnicalRow label="Receipt event" value="EV / 0309" />
          <TechnicalRow label="Lifecycle" value="RECEIVED" />
          <TechnicalRow label="Exception status" value="DISCREPANCY_OPEN" />
          <TechnicalRow label="External delivery" value="NOT_STARTED" />
          <TechnicalRow label="Rule" value="abs(delta) > 100 L AND abs(delta) / pickup > 1%" />
        </TechnicalDetails>

        <PrimaryButton
          label="VIEW ON WEB"
          tone="dark"
          icon="open-outline"
          onPress={() => void Linking.openURL(operationsUrl)}
        />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.md,
    paddingBottom: 34,
    gap: spacing.lg,
  },
  discrepancyCard: {
    ...ledgerCard,
    padding: 16,
    borderColor: '#F2B99B',
    backgroundColor: colors.orangeSoft,
    gap: 14,
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  delta: {
    color: colors.orange,
    fontFamily: fonts.monoSemiBold,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -1,
  },
  threshold: {
    paddingTop: 12,
    borderTopColor: '#EFB697',
    borderTopWidth: 1,
    gap: 2,
  },
  explanation: {
    padding: 12,
    borderColor: '#F0C1A7',
    borderWidth: 1,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  sectionLabel: {
    marginBottom: 10,
  },
  evidence: {
    ...ledgerCard,
    overflow: 'hidden',
  },
  evidenceRow: {
    minHeight: 88,
    paddingHorizontal: 12,
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  node: {
    width: 43,
    height: 43,
    borderRadius: 22,
    borderColor: colors.muted,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receivedNode: {
    borderColor: colors.orange,
    borderWidth: 2,
  },
  quantity: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 18,
  },
  readOnlyField: {
    ...ledgerCard,
    minHeight: 70,
    padding: 13,
    gap: 6,
    backgroundColor: '#F1F1EE',
  },
  immutableNote: {
    borderLeftColor: colors.blue,
    borderLeftWidth: 3,
    paddingLeft: 12,
    flexDirection: 'row',
    gap: 11,
  },
});
