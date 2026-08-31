# FieldRelay VPS operations

Everything in this directory is path-relative so the complete `FieldRelay for Wiq`
folder can be moved as one unit.

The production-shaped stack contains:

- an internal Caddy gateway for request routing;
- the Vinext web runtime;
- the Fastify API;
- PostgreSQL 17.

The existing AudioFetcher VPS already has a host-level Caddy service on ports 80
and 443. FieldRelay therefore publishes only `127.0.0.1:18042`; the reviewed
`/etc/caddy/sites/fieldrelay.caddy` drop-in sends only
`fieldrelay.swoop.video` to that origin. FieldRelay never replaces the host
Caddyfile or the AudioFetcher/Rook services.

Every Compose invocation forces project name `fieldrelay`. All four containers
have conservative CPU, memory, and PID ceilings plus bounded `json-file` logs. The
CPU ceilings total 1.30 vCPU on the reviewed 2-vCPU host, preserving meaningful
headroom for AudioFetcher, Rook, and the host services.
`/health` remains process liveness; `/ready` is the PostgreSQL-backed deployment
readiness check.

There is no separate worker container. The current API package exposes delivery
attempt and replay operations inside the API process; adding an idle worker would
misrepresent the implemented runtime.

Start with `docs/deployment/vps-runbook.md`. Do not commit `infra/.env` or database
backups. AWS is not required and no cloud credentials are assumed.

`infra/scripts/preflight-vps.sh` is read-only. The authorized local operator must
run it before the mutating deployment script and deploy only a clean commit with
green CI. The existing VPS identity key remains on that operator machine; it is
never stored in GitHub Actions.
