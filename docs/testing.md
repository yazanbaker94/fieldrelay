# Verification matrix

| Boundary | Required evidence |
| --- | --- |
| Web compile | Production Vinext build lists every public, console, handoff, docs, and dynamic detail route |
| Responsive web | Signature screens visually inspected at 1440 px and 1024 px; mobile fallbacks at 360–412 px |
| Discrepancy | `>100 L AND >1%`, exact `−240 L / −2.93%`, boundary tests included |
| Audit | Append-only rows, chained hashes, verification endpoint |
| Idempotency | Lost response returns original result; changed payload under same key rejected |
| Conflict | No silent overwrite; review, separate draft, or server version outcomes |
| Resolution | Immutable reports + separate accepted quantity + transactionally created outbox |
| Delivery | Three retryable failures, DLQ, stable-key manual replay, `200 OK` without duplicate destination write |
| Android | TypeScript, domain/queue tests, Expo Doctor, native prebuild, local APK assembly |
| Infrastructure | YAML parse, shell syntax, secret scan; full Compose runtime deferred to a Docker-equipped host |
