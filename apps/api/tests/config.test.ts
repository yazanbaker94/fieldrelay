import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("configuration validation", () => {
  it("accepts the deterministic local adapter without any external account", () => {
    expect(loadConfig({})).toMatchObject({
      port: 4100,
      corsOrigin: "http://localhost:3000",
      allowCanonicalMutations: false,
      publicWriteLimitPerHour: 120,
      maxDemoRuns: 500,
      maxSseConnectionsPerClient: 3,
      maxSseConnectionsGlobal: 100,
      destination: { type: "GENERIC_WEBHOOK", url: "local://delivery-simulator" }
    });
  });

  it("rejects destination credentials and query-string secrets before they can enter forensic records", () => {
    expect(() =>
      loadConfig({ DELIVERY_DESTINATION_URL: "https://user:password@example.test/deliver" })
    ).toThrow();
    expect(() =>
      loadConfig({ DELIVERY_DESTINATION_URL: "https://example.test/deliver?api_key=secret" })
    ).toThrow();
  });

  it("accepts an explicit CORS allow-list for the public site and private preview", () => {
    expect(loadConfig({ CORS_ORIGIN: "https://one.test,https://two.test" }).corsOrigins).toEqual([
      "https://one.test",
      "https://two.test"
    ]);
    expect(() => loadConfig({ CORS_ORIGIN: "https://one.test,not-an-origin" })).toThrow();
    expect(loadConfig({ CORS_ORIGIN: "*" }).corsOrigin).toBe("*");
  });

  it("validates bounded public-simulator controls", () => {
    expect(
      loadConfig({
        ALLOW_CANONICAL_MUTATIONS: "true",
        PUBLIC_WRITE_LIMIT_PER_HOUR: "10",
        MAX_DEMO_RUNS: "25",
        MAX_SSE_CONNECTIONS_PER_CLIENT: "2",
        MAX_SSE_CONNECTIONS_GLOBAL: "20"
      })
    ).toMatchObject({
      allowCanonicalMutations: true,
      publicWriteLimitPerHour: 10,
      maxDemoRuns: 25,
      maxSseConnectionsPerClient: 2,
      maxSseConnectionsGlobal: 20
    });
    expect(() => loadConfig({ PUBLIC_WRITE_LIMIT_PER_HOUR: "0" })).toThrow();
    expect(() => loadConfig({ MAX_DEMO_RUNS: "10001" })).toThrow();
  });
});
