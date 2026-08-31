import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { useFieldRelay } from '../state/FieldRelayProvider';
import { colors, fonts, ledgerCard, spacing, touchTarget } from '../theme';

function ManifestRow({
  label,
  value,
  detail,
  onEdit,
  mono = false,
}: {
  label: string;
  value: string;
  detail?: string;
  onEdit: () => void;
  mono?: boolean;
}) {
  return (
    <View style={styles.manifestRow}>
      <View style={styles.rowCopy}>
        <AppText variant="caption" color={colors.muted}>
          {label}
        </AppText>
        <AppText variant={mono ? 'monoHeading' : 'bodyMedium'}>{value}</AppText>
        {detail ? (
          <AppText variant="caption" color={colors.muted}>
            {detail}
          </AppText>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${label}`}
        onPress={onEdit}
        style={({ pressed }) => [styles.editButton, pressed && { backgroundColor: colors.blueSoft }]}
      >
        <Ionicons name="pencil-outline" size={18} color={colors.blue} />
        <AppText variant="monoMedium" color={colors.blue}>
          EDIT
        </AppText>
      </Pressable>
    </View>
  );
}

export function ReviewScreen() {
  const { draft, goBack, navigate, saveDemoShipment, storageDiagnostic } = useFieldRelay();
  const [unitOpen, setUnitOpen] = useState(true);

  return (
    <ScreenFrame
      testID="review-before-save-screen"
      bottomNav={false}
      footer={
        <PrimaryButton
          label="SAVE ON THIS DEVICE"
          onPress={() => void saveDemoShipment()}
          accessibilityHint="Stores this shipment locally and adds one idempotent sync operation"
        />
      }
    >
      <View style={styles.lightHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.back}>
          <Ionicons name="arrow-back" size={26} color={colors.ink} />
        </Pressable>
        <View style={styles.headerRecord}>
          <AppText variant="mono" color={colors.muted}>
            {draft.shipmentId.replaceAll('-', ' / ')}
          </AppText>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.headingBlock}>
          <AppText variant="monoHeading">REVIEW BEFORE SAVE</AppText>
          <AppText color={colors.muted}>Step 4 of 4</AppText>
        </View>

        <View style={styles.manifest}>
          <ManifestRow label="Generator" value={draft.generator} onEdit={() => navigate('CREATE')} />
          <ManifestRow label="Site" value={draft.site} onEdit={() => navigate('CREATE')} />
          <ManifestRow
            label="Offer"
            value={`${draft.offeredQuantityLiters.toLocaleString('en-CA')} L`}
            detail="Saved with the device timestamp"
            mono
            onEdit={() => navigate('CREATE')}
          />
          <ManifestRow label="Driver" value={draft.driver} onEdit={() => navigate('CREATE')} />
          <ManifestRow label="Unit" value={draft.unit} mono onEdit={() => navigate('CREATE')} />
        </View>

        <View style={styles.unitCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: unitOpen }}
            onPress={() => setUnitOpen((open) => !open)}
            style={styles.unitHeader}
          >
            <View style={styles.unitHeaderCopy}>
              <Ionicons name="bus-outline" size={21} color={colors.ink} />
              <AppText variant="monoMedium">UNIT INFO</AppText>
            </View>
            <Ionicons name={unitOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.ink} />
          </Pressable>
          {unitOpen ? (
            <View style={styles.unitTable}>
              {[
                ['Unit type', draft.unitType],
                ['Capacity', `${draft.capacityLiters.toLocaleString('en-CA')} L`],
                ['Compartment', '1'],
                ['Product', draft.product],
                ['Hazmat', 'No'],
                ['Notes', '—'],
              ].map(([label, value]) => (
                <View key={label} style={styles.unitRow}>
                  <AppText variant="caption" color={colors.muted}>
                    {label}
                  </AppText>
                  <AppText variant="caption">{value}</AppText>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.saveNote}>
          <Ionicons name="phone-portrait-outline" size={22} color={colors.blue} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyMedium">This is a device save, not a submission.</AppText>
            <AppText variant="caption" color={colors.muted}>
              FieldRelay will synchronize the same operation when connectivity returns.
            </AppText>
          </View>
        </View>
        {storageDiagnostic ? (
          <View accessibilityRole="alert" style={styles.storageError}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.red} />
            <AppText variant="caption" color={colors.red} style={{ flex: 1 }}>
              Device save failed: {storageDiagnostic}. FieldRelay has not claimed this record was saved.
            </AppText>
          </View>
        ) : null}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  lightHeader: {
    minHeight: 64,
    paddingHorizontal: 8,
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    width: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRecord: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 10,
  },
  body: {
    padding: spacing.md,
    paddingBottom: 28,
    gap: spacing.lg,
  },
  headingBlock: {
    gap: 4,
    paddingTop: 8,
  },
  manifest: {
    ...ledgerCard,
    overflow: 'hidden',
  },
  manifestRow: {
    minHeight: 86,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 9,
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  editButton: {
    minWidth: 86,
    minHeight: touchTarget,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  unitCard: {
    ...ledgerCard,
    overflow: 'hidden',
  },
  unitHeader: {
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitHeaderCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  unitTable: {
    paddingHorizontal: 14,
    borderTopColor: colors.rule,
    borderTopWidth: 1,
  },
  unitRow: {
    minHeight: 42,
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveNote: {
    borderLeftColor: colors.blue,
    borderLeftWidth: 3,
    paddingLeft: 12,
    flexDirection: 'row',
    gap: 12,
  },
  storageError: {
    borderLeftColor: colors.red,
    borderLeftWidth: 3,
    paddingLeft: 12,
    flexDirection: 'row',
    gap: 12,
  },
});
