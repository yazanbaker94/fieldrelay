import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '../theme';

export type TextVariant =
  | 'body'
  | 'bodyMedium'
  | 'caption'
  | 'label'
  | 'heading'
  | 'title'
  | 'mono'
  | 'monoMedium'
  | 'monoHeading';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function AppText({
  children,
  variant = 'body',
  color = colors.ink,
  style,
  ...props
}: PropsWithChildren<AppTextProps>) {
  return (
    <Text {...props} style={[styles.base, styles[variant], { color }, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fonts.sans,
    fontVariant: ['tabular-nums'],
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 23,
  },
  bodyMedium: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    lineHeight: 23,
  },
  caption: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 26,
    lineHeight: 32,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 34,
    lineHeight: 40,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 14,
    lineHeight: 20,
  },
  monoMedium: {
    fontFamily: fonts.monoMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  monoHeading: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
});
