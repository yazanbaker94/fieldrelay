import { MemoryFieldRelayStore } from "./memoryStore.js";
import { PostgresFieldRelayStore } from "./postgresStore.js";
import type { FieldRelayStore } from "./store.js";
import type { FieldRelayConfig } from "../config.js";
import { createDemoSnapshot, ensureDemoSeed } from "../seed/demoSeed.js";
import { runMigrations } from "../cli/migrate.js";

export async function createStore(config: FieldRelayConfig): Promise<FieldRelayStore> {
  if (!config.databaseUrl) {
    return new MemoryFieldRelayStore(createDemoSnapshot());
  }
  await runMigrations(config.databaseUrl);
  const store = new PostgresFieldRelayStore(config.databaseUrl);
  await ensureDemoSeed(store);
  return store;
}
