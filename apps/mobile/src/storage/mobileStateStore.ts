import LegacyAsyncStorage from '@react-native-async-storage/async-storage';
import SQLiteStorage from 'expo-sqlite/kv-store';
import { cloneInitialState } from './offlineQueue';
import {
  LEGACY_ASYNC_STORAGE_KEY,
  migrateV1State,
  parseV2State,
  serializeState,
  SQLITE_STATE_KEY,
} from './stateSchema';
import type { PersistedMobileState } from '../types';

export async function loadMobileState(): Promise<PersistedMobileState> {
  const current = parseV2State(await SQLiteStorage.getItem(SQLITE_STATE_KEY));
  if (current) return current;

  // One-way migration from the pre-SQLite prototype. The legacy value remains as
  // a recovery copy; all future writes go to the SQLite-backed store.
  const migrated = migrateV1State(await LegacyAsyncStorage.getItem(LEGACY_ASYNC_STORAGE_KEY));
  if (migrated) {
    await persistMobileState(migrated);
    return migrated;
  }

  const initial = cloneInitialState();
  await persistMobileState(initial);
  return initial;
}

export async function persistMobileState(state: PersistedMobileState): Promise<void> {
  await SQLiteStorage.setItem(SQLITE_STATE_KEY, serializeState(state));
}
