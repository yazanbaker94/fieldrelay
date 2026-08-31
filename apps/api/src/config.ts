import "dotenv/config";
import { z } from "zod";
import type { DeliveryDestinationConfig } from "./domain/types.js";

function parseCorsOrigins(value: string): string[] | undefined {
  if (value === "*") return undefined;
  const origins = value.split(",").map((origin) => origin.trim());
  if (origins.length === 0 || origins.length > 20 || origins.some((origin) => !origin)) return undefined;
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== origin) return undefined;
    } catch {
      return undefined;
    }
  }
  return [...new Set(origins)];
}

const corsOriginSchema = z.string().trim().max(2_048).refine(
  (value) => value === "*" || parseCorsOrigins(value) !== undefined,
  "CORS_ORIGIN must be * or a comma-separated list of exact http(s) origins"
);

const destinationUrlSchema = z.string().trim().max(2_048).superRefine((value, context) => {
  if (value === "local://delivery-simulator") return;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      context.addIssue({ code: "custom", message: "Destination URL must use http(s) or the local simulator" });
    }
    if (url.username || url.password || url.search || url.hash) {
      context.addIssue({
        code: "custom",
        message: "Destination URL must not contain credentials, query parameters, or fragments"
      });
    }
  } catch {
    context.addIssue({ code: "custom", message: "Destination URL is invalid" });
  }
});

const envSchema = z.object({
  DATABASE_URL: z.string().trim().max(4_096).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  HOST: z.string().trim().min(1).max(255).default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGIN: corsOriginSchema.default("http://localhost:3000"),
  ALLOW_CANONICAL_MUTATIONS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  PUBLIC_WRITE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(10_000).default(120),
  MAX_DEMO_RUNS: z.coerce.number().int().min(1).max(10_000).default(500),
  MAX_SSE_CONNECTIONS_PER_CLIENT: z.coerce.number().int().min(1).max(100).default(3),
  MAX_SSE_CONNECTIONS_GLOBAL: z.coerce.number().int().min(1).max(1_000).default(100),
  DELIVERY_DESTINATION_TYPE: z.enum(["GENERIC_WEBHOOK", "ODATA_EXAMPLE"]).default("GENERIC_WEBHOOK"),
  DELIVERY_DESTINATION_NAME: z.string().trim().min(1).max(120).default("ERP Demo / Generic Webhook"),
  DELIVERY_DESTINATION_URL: destinationUrlSchema.default("local://delivery-simulator")
});

export interface FieldRelayConfig {
  databaseUrl?: string;
  port: number;
  host: string;
  logLevel: string;
  corsOrigin: string;
  corsOrigins?: readonly string[];
  /**
   * Optional so focused tests and embedders that construct a config object by hand
   * retain the original unrestricted behavior. loadConfig() defaults this to false
   * for the internet-facing public simulator.
   */
  allowCanonicalMutations?: boolean;
  publicWriteLimitPerHour?: number;
  maxDemoRuns?: number;
  maxSseConnectionsPerClient?: number;
  maxSseConnectionsGlobal?: number;
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
    ...(parsed.CORS_ORIGIN === "*" ? {} : { corsOrigins: parseCorsOrigins(parsed.CORS_ORIGIN) ?? [] }),
    allowCanonicalMutations: parsed.ALLOW_CANONICAL_MUTATIONS,
    publicWriteLimitPerHour: parsed.PUBLIC_WRITE_LIMIT_PER_HOUR,
    maxDemoRuns: parsed.MAX_DEMO_RUNS,
    maxSseConnectionsPerClient: parsed.MAX_SSE_CONNECTIONS_PER_CLIENT,
    maxSseConnectionsGlobal: parsed.MAX_SSE_CONNECTIONS_GLOBAL,
    destination: {
      type: parsed.DELIVERY_DESTINATION_TYPE,
      name: parsed.DELIVERY_DESTINATION_NAME,
      url: parsed.DELIVERY_DESTINATION_URL
    }
  };
}
