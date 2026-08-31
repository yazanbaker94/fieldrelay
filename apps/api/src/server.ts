import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createStore } from "./store/factory.js";

const config = loadConfig();
const store = await createStore(config);
const app = await buildApp({ store, config, logger: true });

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: config.port, host: config.host });
