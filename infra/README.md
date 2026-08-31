# FieldRelay VPS operations

Everything in this directory is path-relative so the complete `FieldRelay for Wiq`
folder can be moved as one unit.

The production-shaped stack contains:

- Caddy for HTTPS and request routing;
- the Vinext web runtime;
- the Fastify API;
- PostgreSQL 17.

There is no separate worker container. The current API package exposes delivery
attempt and replay operations inside the API process; adding an idle worker would
misrepresent the implemented runtime.

Start with `docs/deployment/vps-runbook.md`. Do not commit `infra/.env` or database
backups. AWS is not required and no cloud credentials are assumed.
