import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Pool } from "pg";

export async function runMigrations(connectionString: string): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsDirectory = join(here, "..", "..", "migrations");
  const filenames = (await readdir(migrationsDirectory)).filter((name) => name.endsWith(".sql")).sort();
  const pool = new Pool({ connectionString });
  try {
    for (const filename of filenames) {
      const sql = await readFile(join(migrationsDirectory, filename), "utf8");
      await pool.query(sql);
      process.stdout.write(`Applied ${filename}\n`);
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is required for migrations");
  await runMigrations(connectionString);
}
