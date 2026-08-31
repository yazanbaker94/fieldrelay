# Deployment architecture

## Runtime path

```text
Internet
   |
   | TCP 80 / 443, UDP 443
   v
Existing host Caddy (also serves AudioFetcher and Rook)
   |
   | fieldrelay.swoop.video only
   v
127.0.0.1:18042
   |
FieldRelay internal Caddy gateway
   |-- /api/*, /health, /ready, /api/v1/events --> Fastify API :4100
   `-- every other path -----------------> Vinext web :3000
                                                |
Fastify API ------------------------------------+
   |
   `-- private Compose network --> PostgreSQL :5432
```

The existing host Caddy is the only public listener. FieldRelay's Compose gateway
binds only to VPS loopback on port 18042; PostgreSQL remains on an internal network,
and the API and web ports remain container-only. Server-sent events receive an
explicit no-buffer proxy path. Every service has a liveness check and the internal
gateway waits for both application services to become healthy.

Every operational Compose command forces project name `fieldrelay`, so an env-file
override cannot select a neighbouring stack. The four CPU ceilings total 1.30 vCPU
on the reviewed 2-vCPU host; per-service memory and PID limits plus bounded
`json-file` logs preserve capacity for existing workloads. API liveness
remains `/health`; deployment readiness uses `/ready`, which verifies the seeded
PostgreSQL-backed store before the gateway or rollout is considered ready.

The root-owned `FIELDRELAY_DEPLOYMENT_V1` marker proves the managed tree, and an
update is accepted only when `current` resolves to a root-owned direct child of
`/opt/fieldrelay/releases/` with the required regular operation files. A pristine
first install also refuses any stopped or running container, network, or volume
already labelled or named for Compose project `fieldrelay`.

The host integration is one isolated file:
`/etc/caddy/sites/fieldrelay.caddy`. The existing `/etc/caddy/Caddyfile` already
imports that directory and is never overwritten. AudioFetcher systemd units,
Rook's Compose project, firewall rules, and every other Caddy site are outside the
FieldRelay deployment boundary. The preflight refuses an existing drop-in without
the FieldRelay ownership marker and, on updates, verifies the origin listener is
both loopback-only and owned by the labelled `fieldrelay` Caddy service.

The API applies `apps/api/migrations` and runs the idempotent `FR-2026-0842` seed
before listening. It owns delivery attempt/replay processing today, so the Compose
file intentionally has no speculative worker service.

The web build emits a Workers-compatible Vinext bundle. On the VPS, Wrangler runs
that bundle locally inside its container. This does not deploy to Cloudflare and
does not require a Cloudflare account. Caddy remains the public server and TLS
terminator.

## Persistence and trust boundaries

- `postgres_data` contains application state.
- FieldRelay's internal `caddy_data` and `caddy_config` volumes contain only its
  loopback gateway runtime state; they do not own public certificates.
- the host Caddy retains ACME certificate and account state outside this Compose project;
- local/source-mode backups default to `infra/backups/`;
- VPS backups live at `/opt/fieldrelay/shared/backups/` across immutable releases;
- VPS deployment secrets live at `/opt/fieldrelay/shared/fieldrelay.env` with mode 0600;
- `infra/.env` is a local symlink to that shared file on the VPS and must never be committed.

The production profile uses the local deterministic delivery simulator by default.
The OData implementation remains an illustrative adapter, not a claim about WiQ's
systems. AWS is an optional future adapter only; this release has no AWS service,
bucket, key, or credential dependency.
