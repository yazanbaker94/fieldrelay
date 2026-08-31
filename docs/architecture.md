# FieldRelay architecture

## Reliability boundaries

```text
Android / SQLite queue
        │ operationId + idempotencyKey + baseVersion + deviceTimestamp
        ▼
Fastify domain API
        │ exact rule evaluation + optimistic version check
        ▼
PostgreSQL transaction
        │ shipment mutation + append-only audit + transactional outbox
        ▼
Delivery relay
        │ backoff + visible attempts + DLQ + stable destination key
        ▼
Generic webhook / illustrative OData adapter
```

The same `correlationId` is written at each boundary. A failure never erases the prior evidence or changes the identity of the destination operation.

## Shipment and exception invariant

The receiver report is accepted as an immutable event. When:

```text
abs(received - pickup) > 100 L
AND
abs(received - pickup) / pickup > 1%
```

the shipment remains `RECEIVED`, the exception becomes `DISCREPANCY_OPEN`, and delivery remains `NOT_STARTED`. Operations records a distinct `acceptedFinalQuantity`; only resolution may complete the shipment and create its outbox record.

## Idempotency invariant

An operation key maps to one stored result. If a network response is lost, the client checks or retries using that same key. The service returns the original result and does not apply the domain mutation again. A reused key with different content is rejected.

## Audit invariant

Each event includes the previous event hash. PostgreSQL guards prevent update/delete of audit rows, and the verification endpoint can recompute the chain. The hash is demonstration evidence, not a substitute for production key management or tamper-resistant external storage.

## Delivery invariant

Resolution and outbox insertion share one transaction. Automatic attempts and manual replay record distinct action keys but retain `dest_fr0842_completed_v1` as the destination idempotency key. This prevents a successful destination write from being repeated after an uncertain local outcome.
