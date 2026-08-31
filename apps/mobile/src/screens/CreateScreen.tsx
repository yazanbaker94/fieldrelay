import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '../components/AppText';
import { DarkHeader } from '../components/DarkHeader';
import { DemoControl } from '../components/DemoControl';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { useFieldRelay } from '../state/FieldRelayProvider';
import { colors, fonts, ledgerCard, spacing, touchTarget } from '../theme';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'numeric';
  suffix?: string;
}

function Field({ label, value, onChangeText, keyboardType = 'default', suffix }: FieldProps) {
  return (
    <View style={styles.field}>
      <AppText variant="label" color={colors.muted}>
        {label}
      </AppText>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          selectionColor={colors.blue}
          style={styles.input}
        />
        {suffix ? <AppText variant="monoMedium">{suffix}</AppText> : null}
      </View>
    </View>
  );
}

export function CreateScreen() {
  const { draft, navigate, updateDraft } = useFieldRelay();
  const [quantity, setQuantity] = useState(draft.offeredQuantityLiters.toLocaleString('en-CA'));

  return (
    <ScreenFrame
      testID="create-screen"
      footer={<PrimaryButton label="REVIEW SHIPMENT" onPress={() => navigate('REVIEW')} />}
    >
      <DarkHeader title="CREATE SHIPMENT" eyebrow="FR / NEW RECORD" />
      <DemoControl />
      <View style={styles.body}>
        <View style={styles.intro}>
          <AppText variant="label" color={colors.blue}>
            Field record
          </AppText>
          <AppText variant="heading">Create once. Save anywhere.</AppText>
          <AppText color={colors.muted}>
            Every entry is stored on this device first. Connectivity is not required to continue.
          </AppText>
        </View>

        <View style={styles.form}>
          <View style={styles.groupHeader}>
            <AppText variant="monoMedium">01 / ORIGIN</AppText>
            <AppText variant="caption" color={colors.muted}>
              Step 1 of 3
            </AppText>
          </View>
          <Field
            label="Generator"
            value={draft.generator}
            onChangeText={(generator) => updateDraft({ generator })}
          />
          <Field label="Site" value={draft.site} onChangeText={(site) => updateDraft({ site })} />
          <Field
            label="Offer quantity"
            value={quantity}
            onChangeText={(value) => {
              setQuantity(value);
              const parsed = Number(value.replace(/[^0-9.]/g, ''));
              if (Number.isFinite(parsed)) updateDraft({ offeredQuantityLiters: parsed });
            }}
            keyboardType="numeric"
            suffix="L"
          />

          <View style={styles.groupHeader}>
            <AppText variant="monoMedium">02 / TRANSPORT</AppText>
            <AppText variant="caption" color={colors.muted}>
              Step 2 of 3
            </AppText>
          </View>
          <Field
            label="Driver"
            value={draft.driver}
            onChangeText={(driver) => updateDraft({ driver })}
          />
          <Field label="Unit" value={draft.unit} onChangeText={(unit) => updateDraft({ unit })} />

          <View style={styles.summaryStrip}>
            <View>
              <AppText variant="label" color={colors.muted}>
                Material
              </AppText>
              <AppText variant="bodyMedium">{draft.product}</AppText>
            </View>
            <View>
              <AppText variant="label" color={colors.muted}>
                Unit type
              </AppText>
              <AppText variant="bodyMedium">{draft.unitType}</AppText>
            </View>
          </View>
        </View>

        <View style={styles.localNote}>
          <AppText variant="mono" color={colors.blue}>
            LOCAL-FIRST / BASE VERSION 0
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            Review creates an idempotent operation with a device timestamp. Saving twice cannot
            duplicate the server mutation.
          </AppText>
        </View>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.md,
    paddingBottom: 24,
    gap: spacing.lg,
  },
  intro: {
    gap: 7,
  },
  form: {
    ...ledgerCard,
    overflow: 'hidden',
  },
  groupHeader: {
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: '#F0F1EF',
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  field: {
    minHeight: 82,
    paddingHorizontal: 14,
    paddingTop: 11,
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputRow: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    minHeight: touchTarget,
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.sansMedium,
    fontSize: 17,
    paddingVertical: 8,
  },
  summaryStrip: {
    padding: 14,
    minHeight: 76,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.blueSoft,
  },
  localNote: {
    borderLeftColor: colors.blue,
    borderLeftWidth: 3,
    paddingLeft: 12,
    gap: 5,
  },
});
