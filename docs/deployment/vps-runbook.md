# FieldRelay VPS runbook

This runbook deploys the complete web/API/database demo at
`https://fieldrelay.swoop.video`. Commands assume a Linux VPS and are run from the
root of the movable `FieldRelay for Wiq` folder.

## 1. Prerequisites

- A supported Linux VPS with at least 2 vCPU, 4 GB RAM, and adequate disk space for
  image builds and PostgreSQL backups.
- Docker Engine and the Docker Compose v2 plugin.
- An `A` record for `fieldrelay.swoop.video` pointing at the VPS. Add `AAAA` only if
  IPv6 reaches the same host correctly.
- Inbound TCP 22, 80, and 443 plus UDP 443. Restrict SSH to trusted addresses when
  practical.

Caddy obtains and renews TLS certificates automatically after DNS and ports 80/443
are correct.

## 2. Create deployment configuration

```sh
cp infra/.env.example infra/.env
chmod 600 infra/.env
```

Edit `infra/.env` before starting anything:

1. Keep `FIELDRELAY_DOMAIN=fieldrelay.swoop.video`.
2. Replace `POSTGRES_PASSWORD` with a long random value.
3. Put the same password, URL-encoded if necessary, in `DATABASE_URL`. A hex secret
   from `openssl rand -hex 32` avoids URL-encoding ambiguity.
4. Keep the local delivery simulator unless a real, authorized destination contract
   is available.

Never commit `infra/.env`. The example file contains no usable secret.

Validate interpolation and the proxy configuration:

```sh
docker compose --env-file infra/.env -f infra/compose.yaml config --quiet
docker run --rm \
  -e FIELDRELAY_DOMAIN=fieldrelay.swoop.video \
  -v "$PWD/infra/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```

## 3. First deployment

```sh
docker compose --env-file infra/.env -f infra/compose.yaml up -d --build
docker compose --env-file infra/.env -f infra/compose.yaml ps
```

The API waits for PostgreSQL, applies migrations, and seeds the synthetic demo
record. Those startup steps are idempotent.

Verify locally and publicly:

```sh
sh infra/scripts/healthcheck.sh
curl -fsS https://fieldrelay.swoop.video/health
curl -fsS -o /dev/null https://fieldrelay.swoop.video/
timeout 3 curl -fsSN https://fieldrelay.swoop.video/api/v1/events || true
```

The expected API health payload names `fieldrelay-api`, reports `postgres`, and has
status `ok`.

## 4. Routine operations

Inspect status and recent logs:

```sh
docker compose --env-file infra/.env -f infra/compose.yaml ps
docker compose --env-file infra/.env -f infra/compose.yaml logs --tail=200 api web caddy db
```

Create a private PostgreSQL custom-format backup:

```sh
sh infra/scripts/backup-postgres.sh
```

The default destination is `infra/backups/` inside this project folder. Files are mode
restricted, and `BACKUP_RETENTION_DAYS` controls local pruning. Copy encrypted
backups to a separately controlled location as an operational follow-up; no AWS or
other object-storage destination is configured here.

A daily cron entry can run the same relocatable script:

```cron
15 2 * * * cd /opt/fieldrelay && /bin/sh infra/scripts/backup-postgres.sh >> /opt/fieldrelay/infra/backups/backup.log 2>&1
```

Adjust `/opt/fieldrelay` to the actual folder location.

## 5. Update and rollback

For a source-based update:

```sh
sh infra/scripts/backup-postgres.sh
docker compose --env-file infra/.env -f infra/compose.yaml up -d --build
sh infra/scripts/healthcheck.sh
```

For a GHCR release, set `FIELDRELAY_API_IMAGE` and `FIELDRELAY_WEB_IMAGE` in
`infra/.env` to immutable tag or SHA references, authenticate with `docker login
ghcr.io`, then run:

```sh
sh infra/scripts/backup-postgres.sh
docker compose --env-file infra/.env -f infra/compose.yaml pull api web
docker compose --env-file infra/.env -f infra/compose.yaml up -d --no-build
sh infra/scripts/healthcheck.sh
```

Rollback by restoring the previous immutable image references and repeating `up -d
--no-build`. Restore a database dump only when the database itself must be rolled
back; application rollback alone should not discard newer data.

## 6. Demo reset and disaster restore

The reset script is destructive. It first backs up the current database, drops the
application schema, reapplies migrations, and restores only the deterministic demo
seed:

```sh
sh infra/scripts/reset-demo.sh --yes
```

Use `--no-backup` only when deliberate data loss is acceptable.

Restore a selected backup only after confirming its exact path:

```sh
sh infra/scripts/restore-postgres.sh infra/backups/fieldrelay-YYYYMMDDTHHMMSSZ-XXXXXX.dump --yes
```

Restore inputs are intentionally restricted to the project's `infra/backups/` directory.

## 7. Security and maintenance checklist

- Keep Docker, the host kernel, Caddy, Node base images, and PostgreSQL patched.
- Do not publish ports 3000, 4100, or 5432 at the host firewall.
- Keep SSH keys and `infra/.env` out of the repository and backups.
- Review `docker compose logs` and disk use after each release.
- Test a database restore periodically rather than assuming backups are usable.
- Rotate the database password during a scheduled maintenance window and update both
  password fields together.
- The public demo uses synthetic data and illustrative rules. It is not affiliated
  with WiQ and is not for production or regulatory use.
