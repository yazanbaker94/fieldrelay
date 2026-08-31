# FieldRelay VPS runbook

This runbook deploys the web/API/database demo at
`https://fieldrelay.swoop.video` without disturbing AudioFetcher or Rook workloads
on the same VPS.

The reviewed boundary is:

- application root: `/opt/fieldrelay`;
- Compose project: `fieldrelay`;
- private origin: `127.0.0.1:18042`;
- only host integration: `/etc/caddy/sites/fieldrelay.caddy`;
- shared secrets and backups: `/opt/fieldrelay/shared/`.

Do not reuse AudioFetcher's `/opt/ytmp3`, API ports 8080/8081, Rook's ports
3100/4100/8100, its Compose project, or the host Caddyfile.

## 1. Prerequisites and read-only preflight

The reviewed host has enough capacity for this small demo. It must retain:

- at least 2 vCPU, 2 GiB RAM, and 5 GiB free under `/opt`;
- Docker Engine and Docker Compose v2 with `docker compose up --wait` support;
- the existing host Caddy active on public ports 80/443 and importing
  `/etc/caddy/sites/*.caddy`;
- OpenSSL, curl, tar, flock, and standard POSIX utilities;
- SSH on the already-pinned host key.

For public launch later, an `A` record for `fieldrelay.swoop.video` must point at
the VPS. Add `AAAA` only if functional IPv6 is independently verified. The
existing host Caddy obtains and renews TLS after DNS is correct. This deployment
does not touch Cloudflare.

Run the preflight before any mutation:

```sh
FIELDRELAY_DEPLOY_ROOT=/opt/fieldrelay \
FIELDRELAY_ORIGIN_PORT=18042 \
sh infra/scripts/preflight-vps.sh
```

The script is read-only. It verifies capacity, Docker/Caddy, the host Caddy import,
path ownership, and the loopback-port boundary. It refuses an existing unmarked
`/opt/fieldrelay`, an unmarked FieldRelay Caddy drop-in, a non-loopback listener,
or a listener not owned by the labelled FieldRelay Caddy service on port 18042. A
pristine first install also refuses stopped/running containers, networks, or
volumes already labelled or named for Compose project `fieldrelay`. On updates,
`current` must resolve to a root-owned direct child of the managed releases tree.

## 2. Reviewed deployment from the authorized Windows machine

Do not store the unrestricted AudioFetcher VPS root key in GitHub Actions. Run the
rollout interactively from the authorized operator machine, where the existing key
and pinned `known_hosts` entry already live outside this repository. The root
account is used only because the reviewed script must install the isolated Caddy
drop-in and reload Caddy. Unattended deployment requires a separate, constrained
deploy account or forced-command wrapper before it is enabled.

First push a clean release commit, wait for its `api`, `web`, `mobile`, and
`containers` checks to pass, and wait for `.github/workflows/release.yml` to publish
both images. Obtain the exact linux/amd64 image digests from that release run or
GHCR; a tag such as `latest` or `v0.1.0` is not a deployable image reference.

Open PowerShell in the repository root and set the local-only values below. Replace
the angle-bracket placeholders; do not paste the identity key or an access token
into this file or any prompt.

```powershell
$FieldRelayHost = "<current AudioFetcher VPS hostname or IP>"
$FieldRelayPort = 22
$FieldRelayUser = "root"
$FieldRelayKey = Join-Path $env:USERPROFILE ".ssh\ytomp3_hetzner"
$FieldRelayKnownHosts = Join-Path $env:USERPROFILE ".ssh\known_hosts"
$FieldRelayIdentityFingerprint = "SHA256:Um6p64p1h42+kcLqFNq2+VLouuMgNtkxQYuNOL3X+BU"
$FieldRelayHostFingerprint = "SHA256:zkg7KgmOJBzpmn4xEXrzF9CZ+Fe31c71IIluvWnNv6c"

$FieldRelayReleaseId = "v0.1.0-<12-character-commit-prefix>"
$FieldRelayApiImage = "ghcr.io/yazanbaker94/fieldrelay-api@sha256:<64-lowercase-hex>"
$FieldRelayWebImage = "ghcr.io/yazanbaker94/fieldrelay-web@sha256:<64-lowercase-hex>"
```

Verify that the path, clean commit, digest syntax, and both independently recorded
fingerprints match before opening an SSH session:

```powershell
if (-not (Test-Path -LiteralPath $FieldRelayKey -PathType Leaf)) { throw "Missing FieldRelay identity key." }
if (-not (Test-Path -LiteralPath $FieldRelayKnownHosts -PathType Leaf)) { throw "Missing pinned known_hosts file." }
if (git status --porcelain) { throw "Deploy only from a clean release checkout." }

$FieldRelayCommit = (git rev-parse HEAD).Trim()
if ($FieldRelayReleaseId -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+-[0-9a-f]{12}$') { throw "Invalid release id." }
if (-not $FieldRelayReleaseId.EndsWith($FieldRelayCommit.Substring(0, 12))) { throw "Release id does not match HEAD." }
if ($FieldRelayApiImage -notmatch '^ghcr\.io/yazanbaker94/fieldrelay-api@sha256:[0-9a-f]{64}$') { throw "Invalid API digest reference." }
if ($FieldRelayWebImage -notmatch '^ghcr\.io/yazanbaker94/fieldrelay-web@sha256:[0-9a-f]{64}$') { throw "Invalid web digest reference." }

$FieldRelayIdentityOutput = (& ssh-keygen.exe -lf $FieldRelayKey -E sha256) -join "`n"
if ($LASTEXITCODE -ne 0 -or -not $FieldRelayIdentityOutput.Contains($FieldRelayIdentityFingerprint)) {
  throw "FieldRelay identity-key fingerprint mismatch."
}

$FieldRelayKnownHostEntries = @(& ssh-keygen.exe -F $FieldRelayHost -f $FieldRelayKnownHosts)
if ($LASTEXITCODE -ne 0) { throw "AudioFetcher VPS has no pinned known_hosts entry." }
$FieldRelayHostOutput = ($FieldRelayKnownHostEntries |
  Where-Object { -not $_.StartsWith('#') } |
  & ssh-keygen.exe -lf - -E sha256) -join "`n"
if ($LASTEXITCODE -ne 0 -or -not $FieldRelayHostOutput.Contains($FieldRelayHostFingerprint)) {
  throw "AudioFetcher VPS host-key fingerprint mismatch."
}
```

These checks stop if either fingerprint differs or if the host has no pinned entry.
Do not repair a mismatch with `ssh-keyscan` alone and never use
`StrictHostKeyChecking=no`.

Build the relocatable bundle from that exact checkout, then upload it with strict
host-key checking. Keep the target variables as separate array elements so paths
are not assembled into an unreviewed shell command:

```powershell
$FieldRelayArchive = Join-Path $env:TEMP "fieldrelay-operations-$FieldRelayCommit.tgz"
$FieldRelayRemoteArchive = "/tmp/fieldrelay-operations-$FieldRelayCommit.tgz"
$FieldRelayRemoteDockerConfig = "/tmp/fieldrelay-docker-$FieldRelayCommit"
$FieldRelayTarget = "$FieldRelayUser@$FieldRelayHost"
$FieldRelaySshOptions = @(
  "-i", $FieldRelayKey,
  "-p", "$FieldRelayPort",
  "-o", "BatchMode=yes",
  "-o", "IdentitiesOnly=yes",
  "-o", "HostKeyAlgorithms=ssh-ed25519",
  "-o", "StrictHostKeyChecking=yes",
  "-o", "UserKnownHostsFile=$FieldRelayKnownHosts"
)
$FieldRelayScpOptions = @(
  "-i", $FieldRelayKey,
  "-P", "$FieldRelayPort",
  "-o", "BatchMode=yes",
  "-o", "IdentitiesOnly=yes",
  "-o", "HostKeyAlgorithms=ssh-ed25519",
  "-o", "StrictHostKeyChecking=yes",
  "-o", "UserKnownHostsFile=$FieldRelayKnownHosts"
)

tar.exe -czf $FieldRelayArchive infra docs/deployment
if ($LASTEXITCODE -ne 0) { throw "Could not create the operations bundle." }
tar.exe -tzf $FieldRelayArchive
if ($LASTEXITCODE -ne 0) { throw "Could not read back the operations bundle." }

& scp.exe @FieldRelayScpOptions $FieldRelayArchive "${FieldRelayTarget}:$FieldRelayRemoteArchive"
if ($LASTEXITCODE -ne 0) { throw "Could not upload the operations bundle." }
```

Run the preflight extracted from the uploaded bundle. This preflight is read-only
with respect to FieldRelay, Caddy, Docker, AudioFetcher, and Rook:

```powershell
$FieldRelayPreflight = @'
set -eu
script=$(mktemp /tmp/fieldrelay-preflight.XXXXXX)
trap 'rm -f -- "$script"' EXIT HUP INT TERM
tar -xOzf '{0}' infra/scripts/preflight-vps.sh > "$script"
FIELDRELAY_DEPLOY_ROOT=/opt/fieldrelay FIELDRELAY_ORIGIN_PORT=18042 sh "$script"
'@ -f $FieldRelayRemoteArchive
& ssh.exe @FieldRelaySshOptions $FieldRelayTarget $FieldRelayPreflight
if ($LASTEXITCODE -ne 0) { throw "VPS preflight failed; nothing was deployed." }
```

If GHCR packages are private, authenticate into a release-specific temporary
Docker configuration. The currently authorized GitHub CLI token is piped directly
over the pinned SSH transport and is never printed or placed on the SSH command
line. Prefer a dedicated package-read token when one is available. Public packages
need no login, so skip this command:

```powershell
$FieldRelayGhcrLogin = "set -eu; install -d -m 0700 '$FieldRelayRemoteDockerConfig'; DOCKER_CONFIG='$FieldRelayRemoteDockerConfig' docker login ghcr.io --username yazanbaker94 --password-stdin"
& gh.exe auth token | & ssh.exe @FieldRelaySshOptions $FieldRelayTarget $FieldRelayGhcrLogin
if ($LASTEXITCODE -ne 0) { throw "Temporary GHCR login failed." }
```

Do not use root's default Docker configuration for this login; it could be shared
by an unrelated workload.

Invoke the reviewed deployment script directly from the same bundle:

```powershell
$FieldRelayDeploy = @'
set -eu
script=$(mktemp /tmp/fieldrelay-deploy.XXXXXX)
trap 'rm -f -- "$script"' EXIT HUP INT TERM
tar -xOzf '{0}' infra/scripts/deploy-release.sh > "$script"
install -d -m 0700 '{4}'
export DOCKER_CONFIG='{4}'
FIELDRELAY_DEPLOY_ROOT=/opt/fieldrelay FIELDRELAY_ORIGIN_PORT=18042 \
  sh "$script" '{0}' '{1}' '{2}' '{3}'
'@ -f $FieldRelayRemoteArchive, $FieldRelayReleaseId, $FieldRelayApiImage, $FieldRelayWebImage, $FieldRelayRemoteDockerConfig
try {
  & ssh.exe @FieldRelaySshOptions $FieldRelayTarget $FieldRelayDeploy
  if ($LASTEXITCODE -ne 0) { throw "FieldRelay deployment failed." }
} finally {
  & ssh.exe @FieldRelaySshOptions $FieldRelayTarget "rm -f -- '$FieldRelayRemoteArchive'; rm -rf -- '$FieldRelayRemoteDockerConfig'"
}
```

The deploy script creates `/opt/fieldrelay/shared/fieldrelay.env` with mode 0600 on
first use, requires a running database and successful backup before every update,
changes only Compose project `fieldrelay`, waits up to 180 seconds for bounded
service readiness, validates and reloads the existing host Caddy without replacing
its main configuration, and verifies the loopback origin before changing the
`current` release symlink. A failed, unactivated attempt removes only its exact
release directory, allowing a corrected retry with the same release id.

After the command succeeds, run the routine-operation checks in section 4 and
confirm the previously recorded AudioFetcher/Rook containers and listeners are
unchanged. Remove the exact local temporary archive:

```powershell
Remove-Item -LiteralPath $FieldRelayArchive
```

Cloudflare and DNS remain separate. Before DNS/TLS browser verification, report a
successful deployment as **origin ready**, not publicly live.

## 3. Source-mode configuration for an isolated test host

Source mode is useful for local or disposable testing. Do not use it to replace the
reviewed local-operator rollout on the shared AudioFetcher host.

```sh
cp infra/.env.example infra/.env
chmod 600 infra/.env
```

Edit `infra/.env`:

1. Keep `FIELDRELAY_DOMAIN=fieldrelay.swoop.video`.
2. Keep `FIELDRELAY_ORIGIN_PORT=18042` on the reviewed host.
3. Replace `POSTGRES_PASSWORD` with a long random URL-safe value.
4. Put the same password in `DATABASE_URL`. `openssl rand -hex 32` avoids
   URL-encoding ambiguity.
5. Keep the local delivery simulator unless an authorized destination contract is
   available.

Never commit `infra/.env`.

Validate interpolation and the internal proxy:

```sh
docker compose -p fieldrelay --env-file infra/.env -f infra/compose.yaml config --quiet
docker run --rm \
  -v "$PWD/infra/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2.11.4-alpine caddy validate --config /etc/caddy/Caddyfile
```

Start and verify source mode:

```sh
docker compose -p fieldrelay --env-file infra/.env -f infra/compose.yaml up -d --build
sh infra/scripts/healthcheck.sh
curl -fsS http://127.0.0.1:18042/health
curl -fsS http://127.0.0.1:18042/ready
curl -fsS -o /dev/null http://127.0.0.1:18042/
timeout 3 curl -fsSN http://127.0.0.1:18042/api/v1/events || true
```

The expected API health payload names `fieldrelay-api`, reports `postgres`, and has
status `ok`.

## 4. Routine operations

On the reviewed VPS, always address the current immutable release and shared env:

```sh
cd /opt/fieldrelay/current
docker compose -p fieldrelay --env-file /opt/fieldrelay/shared/fieldrelay.env \
  -f infra/compose.yaml ps
docker compose -p fieldrelay --env-file /opt/fieldrelay/shared/fieldrelay.env \
  -f infra/compose.yaml logs --tail=200 api web caddy db
FIELDRELAY_ENV_FILE=/opt/fieldrelay/shared/fieldrelay.env \
  sh infra/scripts/healthcheck.sh
```

Create a private PostgreSQL custom-format backup:

```sh
cd /opt/fieldrelay/current
FIELDRELAY_ENV_FILE=/opt/fieldrelay/shared/fieldrelay.env \
  sh infra/scripts/backup-postgres.sh
```

VPS backups persist under `/opt/fieldrelay/shared/backups/`. Source mode defaults
to `infra/backups/`. `BACKUP_RETENTION_DAYS` controls pruning. Copy encrypted
backups to another controlled location as an operational follow-up; no AWS/object
storage is configured.

A daily cron entry may run the same relocatable script:

```cron
15 2 * * * cd /opt/fieldrelay/current && FIELDRELAY_ENV_FILE=/opt/fieldrelay/shared/fieldrelay.env /bin/sh infra/scripts/backup-postgres.sh >> /opt/fieldrelay/shared/backups/backup.log 2>&1
```

## 5. Rollback

The deployment script snapshots the previous environment, requires a successful
database backup, and does not move `/opt/fieldrelay/current` until the new origin and host Caddy
configuration validate. On failure it restores prior image references and restarts
only the FieldRelay Compose project. It never restores a database automatically.

For a deliberate application rollback:

1. identify the exact previous directory under `/opt/fieldrelay/releases/`;
2. restore its immutable API/web digest values in the shared env;
3. run `docker compose -p fieldrelay ... up -d --no-build` using that release's compose file;
4. run the FieldRelay health checks;
5. repoint `/opt/fieldrelay/current` only after validation.

Restore a database only when the data itself must be rolled back. Application
rollback alone must not discard newer records.

## 6. Demo reset and disaster restore

The reset script is destructive only inside the FieldRelay database. It first
backs up the current database, drops the application schema, reapplies migrations,
and restores the deterministic demo seed:

```sh
cd /opt/fieldrelay/current
FIELDRELAY_ENV_FILE=/opt/fieldrelay/shared/fieldrelay.env \
  sh infra/scripts/reset-demo.sh --yes
```

Use `--no-backup` only when deliberate FieldRelay data loss is acceptable.

Restore a selected backup only after confirming its exact path:

```sh
cd /opt/fieldrelay/current
FIELDRELAY_ENV_FILE=/opt/fieldrelay/shared/fieldrelay.env \
  sh infra/scripts/restore-postgres.sh \
    /opt/fieldrelay/shared/backups/fieldrelay-YYYYMMDDTHHMMSSZ-XXXXXX.dump --yes
```

Restore inputs are restricted to the configured backup directory beneath the
FieldRelay deployment root.

## 7. Public launch follow-up

After an authorized operator creates DNS, verify separately:

```sh
curl -fsS https://fieldrelay.swoop.video/health
curl -fsS https://fieldrelay.swoop.video/ready
curl -fsS -o /dev/null https://fieldrelay.swoop.video/
timeout 3 curl -fsSN https://fieldrelay.swoop.video/api/v1/events || true
```

Then verify the certificate, redirects, browser console, API-backed demo, and
Android HTTPS connectivity. Do not claim public readiness from origin checks alone.

## 8. Security and maintenance checklist

- Keep Docker, the host kernel, Caddy, Node images, and PostgreSQL patched.
- Never publish ports 3000, 4100, 5432, or 18042 beyond loopback/private networks.
- Keep SSH keys and environment files out of the repository and backups.
- Never overwrite `/etc/caddy/Caddyfile`; manage only the FieldRelay drop-in.
- Never stop, restart, delete, or prune AudioFetcher, Rook, or unrelated resources.
- Review FieldRelay-only logs and disk use after each release.
- Periodically test a database restore rather than assuming dumps are usable.
- Rotate the database password during a maintenance window and update both password
  fields together.
- The public demo uses synthetic data and illustrative rules. It is not affiliated
  with WiQ and is not for production or regulatory use.
