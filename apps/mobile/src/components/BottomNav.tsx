import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFieldRelay } from '../state/FieldRelayProvider';
import { colors, fonts, touchTarget } from '../theme';
import type { BottomTab } from '../types';
import { AppText } from './AppText';

const tabs: Array<{
  id: BottomTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'HOME', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { id: 'CREATE', label: 'Create', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  { id: 'SHIPMENTS', label: 'Shipments', icon: 'document-text-outline', activeIcon: 'document-text' },
  { id: 'SYNC', label: 'Sync', icon: 'sync-outline', activeIcon: 'sync' },
];

export function BottomNav() {
  const insets = useSafeAreaInsets();
  const { activeTab, selectTab, pendingCount } = useFieldRelay();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const selected = activeTab === tab.id;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${tab.label}${tab.id === 'SYNC' && pendingCount ? `, ${pendingCount} pending` : ''}`}
            key={tab.id}
            onPress={() => selectTab(tab.id)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View>
              <Ionicons
                name={selected ? tab.activeIcon : tab.icon}
                size={24}
                color={selected ? colors.blue : colors.muted}
              />
              {tab.id === 'SYNC' && pendingCount > 0 ? (
                <View style={styles.count}>
                  <AppText style={styles.countText}>{pendingCount}</AppText>
                </View>
              ) : null}
            </View>
            <AppText
              style={{
                color: selected ? colors.blue : colors.muted,
                fontFamily: selected ? fonts.sansSemiBold : fonts.sans,
                fontSize: 12,
              }}
            >
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingTop: 6,
  },
  item: {
    minHeight: 58,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  pressed: {
    backgroundColor: colors.blueSoft,
  },
  count: {
    position: 'absolute',
    right: -11,
    top: -5,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.orange,
    borderColor: colors.surface,
    borderWidth: 2,
  },
  countText: {
    color: colors.surface,
    fontFamily: fonts.monoSemiBold,
    fontSize: 9,
    lineHeight: 11,
  },
});

