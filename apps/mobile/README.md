# FieldRelay Android client

Native Expo/React Native field client for the FieldRelay reliability prototype. It preserves the five locked Android signature screens while exercising the same Fastify sync contract as the web experience.

## Reliability behavior

- Every offline action is durable in an Expo SQLite-backed key/value ledger before the UI says it was saved.
- A new local shipment keeps its device identity and a separate stable registration key. When online, that key idempotently creates or recovers an isolated public-demo run.
- Registration preserves the draft's bounded offered quantity and returns the exact server-scoped create operation; device-only form context is not sent as an arbitrary public mutation.
- An operation interrupted in `SYNCING` restarts as `CHECKING_RESULT`.
- Both registration and the issued create operation query `GET /api/v1/sync/results/:idempotencyKey` before another POST. Lost responses and app restarts therefore reuse the same two keys instead of creating a second run or shipment.
- The local-to-server shipment mapping is persisted and shown in Sync Center. Other operation types retain their original operation key and no-overwrite conflict behavior.
- Version conflicts become `NEEDS_REVIEW`. The server record is never silently overwritten.
- “Offline” means saved on this device—not submitted or synced.

The violet network switch is an explicit demo gate. Physical connectivity and the API health check remain separate, visible diagnostics.

## API configuration

The public base URL is compiled into the client from `EXPO_PUBLIC_API_URL`. This value is public and must never contain a credential.

```powershell
Copy-Item .env.example .env.local
npm start
```

For the Android emulator and a local API, use `EXPO_PUBLIC_API_URL=http://10.0.2.2:4100` in `.env.local`. Debug builds permit cleartext localhost traffic; the portfolio deployment uses HTTPS.

## Checks

```powershell
npm ci
npm run typecheck
npm test
npx expo-doctor
```

The unit suite covers discrepancy boundaries, durable-state migration/restart recovery, the isolated-run registration contract, exact server-issued payloads, version conflicts, and lost responses at both registration and mutation boundaries.

## Signed arm64 release APK

```powershell
npm run build:android:release
```

This is a clean-clone build: after `npm ci`, the script generates `android/` from the checked-in Expo config, reapplies the deterministic native release configuration, and then builds. The native folders and signing material are intentionally not committed.

On first use, a dedicated FieldRelay portfolio keystore and its randomly generated credentials are created under `%USERPROFILE%\.fieldrelay-release\`. They stay outside the repository, are restricted to the current Windows user, and are never printed. Back up that directory securely if future APK updates must retain the same signing identity.

The release pipeline:

1. embeds the configured public API URL;
2. asks Gradle/Expo to embed the production JavaScript bundle;
3. restricts native libraries to `arm64-v8a`;
4. strips debug-only overlay and legacy external-storage permissions;
5. verifies the embedded endpoint, package `video.swoop.fieldrelay`, API 24 minimum, ABI contents, non-debuggable manifest, permission profile, alignment, and dedicated signing certificate;
6. writes `artifacts/fieldrelay-android.apk` and `artifacts/fieldrelay-android.apk.sha256` after final verification. Versioning belongs in GitHub release/tag metadata so the stable web download URL does not change.

Pass `-InstallIfDeviceAvailable` directly to the PowerShell script to install and launch it when a connected device supports `arm64-v8a`.

## Local debug fallback

```powershell
npm run build:android:debug
```

This also regenerates `android/` when absent and produces `artifacts/fieldrelay-demo-arm64-debug.apk`. It embeds JavaScript so it can launch without Metro, but it retains the standard Android debug certificate and debug tooling. Use the signed release artifact for GitHub and portfolio delivery.
