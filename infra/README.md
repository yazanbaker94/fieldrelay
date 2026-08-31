# FieldRelay VPS operations

Everything in this directory is path-relative so the complete `FieldRelay for Wiq`
folder can be moved as one unit.

The production-shaped stack contains:

- an internal Caddy gateway for request routing;
- the Vinext web runtime;
- the Fastify API;
- PostgreSQL 17.

The deployment target uses a shared host-level Caddy service on ports 80 and 443.
FieldRelay therefore publishes only `127.0.0.1:18042`; the reviewed
`/etc/caddy/sites/fieldrelay.caddy` drop-in sends only
`fieldrelay.swoop.video` to that origin. FieldRelay never replaces the host
Caddyfile or unrelated services.

Every Compose invocation forces project name `fieldrelay`. All four containers
have conservative CPU, memory, and PID ceilings plus bounded `json-file` logs,
preserving meaningful headroom for other host services.
`/health` remains process liveness; `/ready` is the PostgreSQL-backed deployment
readiness check.

There is no separate worker container. The current API package exposes delivery
attempt and replay operations inside the API process; adding an idle worker would
misrepresent the implemented runtime.

See `docs/deployment/` for the public architecture and release model. Do not commit
`infra/.env`, database backups, host addresses, credentials, or fingerprints. AWS
is not required and no cloud credentials are assumed.

`infra/scripts/preflight-vps.sh` is read-only. The authorized local operator must
run it before the mutating deployment script and deploy only a clean commit with
green CI. The VPS identity key remains on that operator machine; it is
never stored in GitHub Actions.
