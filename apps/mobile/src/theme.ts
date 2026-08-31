import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  paper: '#F7F5F0',
  surface: '#FFFFFF',
  ink: '#101417',
  muted: '#5D646B',
  rule: '#D7D9D8',
  dark: '#07121B',
  blue: '#1557B7',
  blueSoft: '#EAF1FB',
  orange: '#F26A18',
  orangeSoft: '#FFF4EB',
  red: '#D52B20',
  redSoft: '#FFF1EF',
  green: '#16753A',
  greenSoft: '#E9F5ED',
  violet: '#7250D8',
  violetSoft: '#F0ECFC',
} as const;

export const fonts = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemiBold: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const touchTarget = 48;

export const ledgerCard: ViewStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.rule,
  borderWidth: 1,
  borderRadius: 5,
};

export const labelText: TextStyle = {
  color: colors.muted,
  fontFamily: fonts.sansMedium,
  fontSize: 12,
  letterSpacing: 0.7,
  textTransform: 'uppercase',
};

