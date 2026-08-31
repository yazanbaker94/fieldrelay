import { Ionicons } from '@expo/vector-icons';
import { type PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, touchTarget } from '../theme';
import { AppText } from './AppText';

interface TechnicalDetailsProps {
  title?: string;
}

export function TechnicalDetails({
  title = 'Technical details',
  children,
}: PropsWithChildren<TechnicalDetailsProps>) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.header, pressed && { backgroundColor: colors.blueSoft }]}
      >
        <AppText variant="monoMedium">{title}</AppText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.ink} />
      </Pressable>
      {open ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

export function TechnicalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" color={colors.muted}>
        {label}
      </AppText>
      <AppText variant="mono" style={styles.value} selectable>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderColor: colors.rule,
    borderWidth: 1,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  header: {
    minHeight: touchTarget,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    borderTopColor: colors.rule,
    borderTopWidth: 1,
    paddingHorizontal: 14,
  },
  row: {
    paddingVertical: 10,
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  value: {
    fontSize: 12,
    lineHeight: 17,
  },
});

