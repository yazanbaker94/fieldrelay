# CI and release notes

## Continuous integration

`.github/workflows/ci.yml` checks the package-local contracts that exist today:

- API typecheck, tests, and TypeScript build;
- web lint and Vinext build;
- mobile TypeScript and Vitest via its pinned local binaries;
- Compose, Caddy, shell-script, and Docker image validation.

The workflow is self-contained and does not need deployment credentials.

## Container release

`.github/workflows/release.yml` runs for `v*` tags or manual dispatch. It publishes
linux/amd64 API and web images to GitHub Container Registry with SHA/tag metadata,
SBOMs, and provenance. It also uploads a relocatable tarball containing `infra/` and
`docs/deployment/`.

Before using the workflow in a public or organization repository:

1. Enable workflow package write access.
2. Choose whether GHCR packages should be public or private.
3. For private packages, authenticate the VPS with a least-privilege read token.
4. Pin the resulting image references in `infra/.env`; do not deploy `latest` when a
   reproducible digest is available.

## Operator-controlled VPS rollout

Production deployment is deliberately run from the authorized Windows operator
machine, not from GitHub Actions. The existing AudioFetcher VPS identity key stays
in the operator's local `.ssh` directory and is never copied into GitHub secrets,
an Actions runner, the repository, or a release artifact.

The operator must deploy a clean commit whose `api`, `web`, `mobile`, and
`containers` checks are green. GitHub Actions still builds the API/web images, but
the local rollout addresses each image by its immutable GHCR digest. The operator
then:

1. verifies the local identity-key fingerprint and the already-pinned host key;
2. creates an `infra/` plus `docs/deployment/` bundle from the exact release commit;
3. uploads that bundle over strict host-key-checked SSH;
4. runs the read-only VPS preflight;
5. invokes `infra/scripts/deploy-release.sh` as the existing approved VPS account;
6. verifies liveness, PostgreSQL-backed readiness, and the web origin on
   `127.0.0.1:18042`;
7. removes the release-specific temporary Docker-auth directory and exact archive.

The deployment script requires the existing database to be running and completes a
backup before an update, deploys only below `/opt/fieldrelay` with Compose project
name `fieldrelay`, applies
per-service resource and log ceilings, and manages only
`/etc/caddy/sites/fieldrelay.caddy`. It does not stop or reconfigure AudioFetcher,
Rook, or the host Caddyfile. See `vps-runbook.md` for the reviewed PowerShell
sequence and recorded fingerprints.

Each rollout uses bounded Compose health waiting. If an unactivated release fails,
the script removes only the exact release directory created by that attempt, so the
same immutable release id can be retried after the cause is corrected.

The current VPS script requires the existing root account because it installs the
isolated Caddy drop-in and reloads Caddy. That broad key is accepted only on the
authorized local operator machine. A future unattended deployment must first use a
dedicated deploy account with a reviewed forced-command or equivalent narrowly
scoped privilege boundary; do not upload the current root key to CI.

The rollout does not access Cloudflare or alter DNS. Until the DNS record exists and
public TLS/browser checks pass, describe a successful deployment as **origin ready**,
not publicly live.

Android packaging is separate from the VPS image release. `npm --prefix apps/mobile
run build:android:release` creates the reviewer APK, verifies its embedded
JavaScript/API endpoint, package ID, minimum API, arm64 ABI, non-debuggable
manifest, permission profile, alignment, and dedicated Android signature, then
writes `fieldrelay-android.apk` and its SHA-256 sidecar below
`apps/mobile/artifacts/`. The local signing material remains outside the repository
under the authorized operator profile and must be backed up securely; it is never
included in deployment files or CI secrets. Publish both files on an immutable
GitHub release; the website and repository documentation resolve the newest pair
through `releases/latest/download/fieldrelay-android.apk` and
`releases/latest/download/fieldrelay-android.apk.sha256`.
