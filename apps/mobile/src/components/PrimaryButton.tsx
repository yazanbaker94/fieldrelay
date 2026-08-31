import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fonts, touchTarget } from '../theme';
import { AppText } from './AppText';

type ButtonTone = 'blue' | 'dark' | 'outline' | 'violet' | 'danger';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
}

const toneStyles = {
  blue: { backgroundColor: colors.blue, borderColor: colors.blue, foreground: colors.surface },
  dark: { backgroundColor: colors.dark, borderColor: colors.dark, foreground: colors.surface },
  outline: { backgroundColor: 'transparent', borderColor: colors.ink, foreground: colors.ink },
  violet: { backgroundColor: colors.violet, borderColor: colors.violet, foreground: colors.surface },
  danger: { backgroundColor: colors.red, borderColor: colors.red, foreground: colors.surface },
} as const;

export function PrimaryButton({
  label,
  onPress,
  tone = 'blue',
  icon,
  disabled = false,
  compact = false,
  accessibilityHint,
}: PrimaryButtonProps) {
  const toneStyle = toneStyles[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
          opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {icon ? <Ionicons name={icon} size={21} color={toneStyle.foreground} /> : null}
        <AppText
          style={{ color: toneStyle.foreground, fontFamily: fonts.sansSemiBold, letterSpacing: 0.5 }}
        >
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    minHeight: touchTarget,
    paddingHorizontal: 14,
  },
  content: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});

