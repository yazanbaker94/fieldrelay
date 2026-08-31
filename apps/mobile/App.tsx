import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from './src/components/AppText';
import { CreateScreen } from './src/screens/CreateScreen';
import { DiscrepancyScreen } from './src/screens/DiscrepancyScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { SavedScreen } from './src/screens/SavedScreen';
import { ShipmentsScreen } from './src/screens/ShipmentsScreen';
import { SyncScreen } from './src/screens/SyncScreen';
import { FieldRelayProvider, useFieldRelay } from './src/state/FieldRelayProvider';
import { colors } from './src/theme';
import type { RootScreen } from './src/types';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const screenComponents: Record<RootScreen, () => React.JSX.Element> = {
  HOME: HomeScreen,
  CREATE: CreateScreen,
  REVIEW: ReviewScreen,
  SAVED: SavedScreen,
  SHIPMENTS: ShipmentsScreen,
  SYNC: SyncScreen,
  DISCREPANCY: DiscrepancyScreen,
};

function AppShell() {
  const { hydrated, screen } = useFieldRelay();
  const darkTop = !['REVIEW', 'SAVED'].includes(screen);
  const Screen = screenComponents[screen];

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: darkTop ? colors.dark : colors.paper }]}
    >
      <StatusBar
        style={darkTop ? 'light' : 'dark'}
      />
      {hydrated ? (
        <Screen />
      ) : (
        <View style={styles.loading}>
          <View style={styles.loadingMark}>
            <AppText variant="monoMedium" color={colors.surface}>
              F/R
            </AppText>
          </View>
          <ActivityIndicator color={colors.blue} />
          <AppText variant="mono" color={colors.muted}>
            RESTORING DEVICE LEDGER
          </AppText>
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <FieldRelayProvider>
        <AppShell />
      </FieldRelayProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  loadingMark: {
    width: 56,
    height: 56,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
