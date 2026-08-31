import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFieldRelay } from '../state/FieldRelayProvider';
import { colors, fonts, touchTarget } from '../theme';
import { AppText } from './AppText';

export function DemoControl() {
  const { demoOnline, physicalOnline, toggleDemoConnectivity } = useFieldRelay();

  return (
    <View style={styles.wrapper}>
      <View style={styles.copy}>
        <AppText variant="label" color={colors.violet}>
          Demo network
        </AppText>
        <AppText variant="caption" color={colors.muted}>
          Device signal: {physicalOnline === null ? 'checking' : physicalOnline ? 'available' : 'unavailable'}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: demoOnline }}
        accessibilityLabel="Toggle simulated network"
        onPress={toggleDemoConnectivity}
        style={({ pressed }) => [styles.control, pressed && { opacity: 0.72 }]}
      >
        <Ionicons
          name={demoOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
          size={18}
          color={colors.violet}
        />
        <AppText style={styles.controlText}>{demoOnline ? 'ONLINE' : 'OFFLINE'}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minHeight: 58,
    paddingLeft: 16,
    paddingRight: 8,
    borderBottomColor: '#D9CEF7',
    borderBottomWidth: 1,
    backgroundColor: colors.violetSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
  },
  control: {
    minHeight: touchTarget,
    minWidth: 112,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
  },
  controlText: {
    color: colors.violet,
    fontFamily: fonts.monoSemiBold,
    fontSize: 12,
  },
});

