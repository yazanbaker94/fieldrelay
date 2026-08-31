import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFieldRelay } from '../state/FieldRelayProvider';
import { colors, fonts, touchTarget } from '../theme';
import { AppText } from './AppText';

export function DemoControl() {
  const { demoOnline, physicalOnline, toggleDemoConnectivity } = useFieldRelay();
  const deviceSignal =
    physicalOnline === null ? 'checking' : physicalOnline ? 'available' : 'unavailable';

  return (
    <View style={styles.wrapper}>
      <View style={styles.copy}>
        <AppText variant="label" color={colors.violet}>
          Demo network
        </AppText>
        <AppText variant="caption" color={colors.muted}>
          Simulation only · Device signal: {deviceSignal}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: demoOnline }}
        accessibilityLabel="Demo network"
        accessibilityValue={{ text: demoOnline ? 'Online' : 'Offline' }}
        accessibilityHint="Changes only the demo connection. Device connectivity is unchanged."
        android_ripple={{ color: '#D9CEF7', foreground: true }}
        onPress={() => void toggleDemoConnectivity()}
        style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
        testID="demo-network-toggle"
      >
        <View style={[styles.option, !demoOnline && styles.activeOption]}>
          <Ionicons
            name="cloud-offline-outline"
            size={19}
            color={demoOnline ? colors.muted : colors.surface}
          />
          <AppText style={[styles.controlText, !demoOnline && styles.activeControlText]}>
            OFFLINE
          </AppText>
          {!demoOnline ? (
            <Ionicons name="checkmark-circle" size={16} color={colors.surface} />
          ) : null}
        </View>
        <View style={[styles.option, demoOnline && styles.activeOption]}>
          <Ionicons
            name="cloud-done-outline"
            size={19}
            color={demoOnline ? colors.surface : colors.muted}
          />
          <AppText style={[styles.controlText, demoOnline && styles.activeControlText]}>
            ONLINE
          </AppText>
          {demoOnline ? (
            <Ionicons name="checkmark-circle" size={16} color={colors.surface} />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minHeight: 116,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#D9CEF7',
    borderBottomWidth: 1,
    backgroundColor: colors.violetSoft,
    gap: 10,
  },
  copy: {
    gap: 1,
  },
  control: {
    minHeight: touchTarget,
    borderColor: colors.violet,
    borderWidth: 1,
    borderRadius: 5,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  controlPressed: {
    opacity: 0.8,
  },
  option: {
    minHeight: touchTarget,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activeOption: {
    backgroundColor: colors.violet,
  },
  controlText: {
    color: colors.muted,
    fontFamily: fonts.monoSemiBold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  activeControlText: {
    color: colors.surface,
  },
});
