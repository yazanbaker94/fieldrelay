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
   reproducible SHA is available.

No workflow connects to the VPS yet. That boundary is deliberate: host, username,
SSH key, deployment path, and an explicit deployment policy are not available. Image
publication and host rollout therefore remain separate, auditable steps.

Android packaging is also separate from the VPS image release. The mobile package
does not currently define a signed-release script, and signing material must not be
invented or stored in these deployment files.
