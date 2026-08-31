import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fonts, touchTarget } from '../theme';
import { AppText } from './AppText';
import { RelayMark } from './RelayMark';

interface DarkHeaderProps {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
}

export function DarkHeader({
  title,
  eyebrow,
  onBack,
  actionIcon,
  onAction,
}: DarkHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.topLine}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            style={styles.iconButton}
          >
            <Ionicons name="arrow-back" size={25} color={colors.surface} />
          </Pressable>
        ) : (
          <View style={styles.markBox}>
            <AppText style={styles.markText}>F/R</AppText>
          </View>
        )}
        <View style={styles.titleBlock}>
          {eyebrow ? (
            <AppText variant="label" color="#91A5B5">
              {eyebrow}
            </AppText>
          ) : null}
          <AppText style={styles.title}>{title}</AppText>
        </View>
        {actionIcon && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More options"
            onPress={onAction}
            style={styles.iconButton}
          >
            <Ionicons name={actionIcon} size={23} color={colors.surface} />
          </Pressable>
        ) : (
          <View style={styles.iconButton} />
        )}
      </View>
      <View style={styles.trace}>
        <RelayMark width={126} activeStep={4} color="#5C95E5" />
        <AppText variant="mono" color="#91A5B5" style={{ fontSize: 11 }}>
          FIELD → HANDOFF → EVIDENCE
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.dark,
    paddingVertical: 9,
  },
  topLine: {
    minHeight: 56,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markBox: {
    width: 36,
    height: 36,
    marginHorizontal: 6,
    borderColor: '#70808C',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    color: colors.surface,
    fontFamily: fonts.monoSemiBold,
    fontSize: 12,
  },
  titleBlock: {
    flex: 1,
    paddingHorizontal: 9,
  },
  title: {
    color: colors.surface,
    fontFamily: fonts.monoMedium,
    fontSize: 18,
    letterSpacing: 0.3,
  },
  trace: {
    paddingHorizontal: 18,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

