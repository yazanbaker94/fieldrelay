import "dotenv/config";
import { z } from "zod";
import type { DeliveryDestinationConfig } from "./domain/types.js";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.string().default("info"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DELIVERY_DESTINATION_TYPE: z.enum(["GENERIC_WEBHOOK", "ODATA_EXAMPLE"]).default("GENERIC_WEBHOOK"),
  DELIVERY_DESTINATION_NAME: z.string().default("ERP Demo / Generic Webhook"),
  DELIVERY_DESTINATION_URL: z.string().default("local://delivery-simulator")
});

export interface FieldRelayConfig {
  databaseUrl?: string;
  port: number;
  host: string;
  logLevel: string;
  corsOrigin: string;
  destination: DeliveryDestinationConfig;
}

export function loadConfig(input: NodeJS.ProcessEnv = process.env): FieldRelayConfig {
  const parsed = envSchema.parse(input);
  return {
    ...(parsed.DATABASE_URL?.trim() ? { databaseUrl: parsed.DATABASE_URL.trim() } : {}),
    port: parsed.PORT,
    host: parsed.HOST,
    logLevel: parsed.LOG_LEVEL,
    corsOrigin: parsed.CORS_ORIGIN,
    destination: {
      type: parsed.DELIVERY_DESTINATION_TYPE,
      name: parsed.DELIVERY_DESTINATION_NAME,
      url: parsed.DELIVERY_DESTINATION_URL
    }
  };
}
