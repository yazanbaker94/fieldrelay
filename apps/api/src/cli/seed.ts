import "dotenv/config";
import { PostgresFieldRelayStore } from "../store/postgresStore.js";
import { ensureDemoSeed } from "../seed/demoSeed.js";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL seeding");

const store = new PostgresFieldRelayStore(connectionString);
try {
  const inserted = await ensureDemoSeed(store);
  process.stdout.write(inserted ? "Seeded FR-2026-0842\n" : "FR-2026-0842 already exists; no changes made\n");
} finally {
  await store.close();
}
