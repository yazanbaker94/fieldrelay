# Deployment architecture

## Runtime path

```text
Internet
   |
   | TCP 80 / 443, UDP 443
   v
Caddy
   |-- /api/*, /health, /api/v1/events --> Fastify API :4100
   `-- every other path -----------------> Vinext web :3000
                                                |
Fastify API ------------------------------------+
   |
   `-- private Compose network --> PostgreSQL :5432
```

Only Caddy publishes host ports. PostgreSQL is isolated on an internal Compose
network; the API and web ports are container-only. Server-sent events receive an
explicit no-buffer proxy path. Every service has a liveness check and Caddy waits
for both application services to become healthy.

The API applies `apps/api/migrations` and runs the idempotent `FR-2026-0842` seed
before listening. It owns delivery attempt/replay processing today, so the Compose
file intentionally has no speculative worker service.

The web build emits a Workers-compatible Vinext bundle. On the VPS, Wrangler runs
that bundle locally inside its container. This does not deploy to Cloudflare and
does not require a Cloudflare account. Caddy remains the public server and TLS
terminator.

## Persistence and trust boundaries

- `postgres_data` contains application state.
- `caddy_data` contains ACME certificates and account state.
- `caddy_config` contains Caddy runtime state.
- `infra/backups/` is created under the movable project directory by the backup script.
- `infra/.env` contains deployment secrets and must never be committed.

The production profile uses the local deterministic delivery simulator by default.
The OData implementation remains an illustrative adapter, not a claim about WiQ's
systems. AWS is an optional future adapter only; this release has no AWS service,
bucket, key, or credential dependency.
