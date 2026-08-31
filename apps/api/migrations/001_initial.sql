BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipments (
  id text PRIMARY KEY,
  lifecycle_status text NOT NULL CHECK (lifecycle_status IN ('DRAFT','OFFERED','ACCEPTED','PICKED_UP','IN_TRANSIT','RECEIVED','COMPLETED')),
  sync_status text NOT NULL CHECK (sync_status IN ('SAVED_ON_DEVICE','WAITING','SYNCING','SYNCED','NEEDS_REVIEW')),
  exception_status text NOT NULL CHECK (exception_status IN ('NONE','DISCREPANCY_OPEN','RESOLVED')),
  delivery_status text NOT NULL CHECK (delivery_status IN ('NOT_STARTED','PENDING','RETRYING','FAILED','DLQ','DELIVERED')),
  offered_quantity_liters numeric(14,3),
  pickup_quantity_liters numeric(14,3),
  received_quantity_liters numeric(14,3),
  accepted_final_quantity_liters numeric(14,3),
  version integer NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK (offered_quantity_liters IS NULL OR offered_quantity_liters > 0),
  CHECK (pickup_quantity_liters IS NULL OR pickup_quantity_liters > 0),
  CHECK (received_quantity_liters IS NULL OR received_quantity_liters >= 0),
  CHECK (accepted_final_quantity_liters IS NULL OR accepted_final_quantity_liters >= 0)
);

CREATE OR REPLACE FUNCTION protect_reported_quantities() RETURNS trigger AS $$
BEGIN
  IF OLD.offered_quantity_liters IS NOT NULL AND NEW.offered_quantity_liters IS DISTINCT FROM OLD.offered_quantity_liters THEN
    RAISE EXCEPTION 'offered quantity is immutable';
  END IF;
  IF OLD.pickup_quantity_liters IS NOT NULL AND NEW.pickup_quantity_liters IS DISTINCT FROM OLD.pickup_quantity_liters THEN
    RAISE EXCEPTION 'pickup quantity is immutable';
  END IF;
  IF OLD.received_quantity_liters IS NOT NULL AND NEW.received_quantity_liters IS DISTINCT FROM OLD.received_quantity_liters THEN
    RAISE EXCEPTION 'received quantity is immutable';
  END IF;
  IF OLD.accepted_final_quantity_liters IS NOT NULL AND NEW.accepted_final_quantity_liters IS DISTINCT FROM OLD.accepted_final_quantity_liters THEN
    RAISE EXCEPTION 'accepted final quantity is immutable once recorded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shipments_quantities_immutable ON shipments;
CREATE TRIGGER shipments_quantities_immutable
BEFORE UPDATE ON shipments
FOR EACH ROW EXECUTE FUNCTION protect_reported_quantities();

CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  shipment_id text NOT NULL REFERENCES shipments(id),
  sequence integer NOT NULL CHECK (sequence > 0),
  event_type text NOT NULL,
  actor jsonb NOT NULL,
  source text NOT NULL CHECK (source IN ('MOBILE','WEB','SYSTEM')),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  previous_hash text,
  event_hash text NOT NULL,
  UNIQUE (shipment_id, sequence)
);

CREATE OR REPLACE FUNCTION reject_append_only_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is forbidden', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events;
CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();

CREATE TABLE IF NOT EXISTS shipment_exceptions (
  id text PRIMARY KEY,
  shipment_id text NOT NULL UNIQUE REFERENCES shipments(id),
  status text NOT NULL CHECK (status IN ('DISCREPANCY_OPEN','RESOLVED')),
  pickup_quantity_liters numeric(14,3) NOT NULL,
  received_quantity_liters numeric(14,3) NOT NULL,
  variance_liters numeric(14,3) NOT NULL,
  variance_percentage numeric(14,8) NOT NULL,
  threshold jsonb NOT NULL,
  category text,
  accepted_final_quantity_liters numeric(14,3),
  reason text,
  note text,
  opened_at timestamptz NOT NULL,
  resolved_by jsonb,
  resolved_at timestamptz,
  version integer NOT NULL CHECK (version > 0),
  CHECK (
    (status = 'DISCREPANCY_OPEN' AND resolved_at IS NULL) OR
    (status = 'RESOLVED' AND resolved_at IS NOT NULL AND category IS NOT NULL AND reason IS NOT NULL AND note IS NOT NULL AND accepted_final_quantity_liters IS NOT NULL)
  )
);

CREATE OR REPLACE FUNCTION protect_exception_evidence() RETURNS trigger AS $$
BEGIN
  IF NEW.pickup_quantity_liters IS DISTINCT FROM OLD.pickup_quantity_liters OR
     NEW.received_quantity_liters IS DISTINCT FROM OLD.received_quantity_liters OR
     NEW.variance_liters IS DISTINCT FROM OLD.variance_liters OR
     NEW.variance_percentage IS DISTINCT FROM OLD.variance_percentage OR
     NEW.threshold IS DISTINCT FROM OLD.threshold OR
     NEW.opened_at IS DISTINCT FROM OLD.opened_at THEN
    RAISE EXCEPTION 'original discrepancy evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shipment_exception_evidence_immutable ON shipment_exceptions;
CREATE TRIGGER shipment_exception_evidence_immutable
BEFORE UPDATE ON shipment_exceptions
FOR EACH ROW EXECUTE FUNCTION protect_exception_evidence();

CREATE TABLE IF NOT EXISTS outbox_records (
  id text PRIMARY KEY,
  shipment_id text NOT NULL REFERENCES shipments(id),
  event_type text NOT NULL CHECK (event_type = 'SHIPMENT_COMPLETED'),
  payload jsonb NOT NULL,
  destination_type text NOT NULL CHECK (destination_type IN ('GENERIC_WEBHOOK','ODATA_EXAMPLE')),
  status text NOT NULL CHECK (status IN ('PENDING','DELIVERED','DLQ','FAILED')),
  stable_idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL,
  delivered_at timestamptz
);

CREATE TABLE IF NOT EXISTS delivery_jobs (
  id text PRIMARY KEY,
  shipment_id text NOT NULL REFERENCES shipments(id),
  outbox_id text NOT NULL UNIQUE REFERENCES outbox_records(id),
  destination_type text NOT NULL CHECK (destination_type IN ('GENERIC_WEBHOOK','ODATA_EXAMPLE')),
  destination_name text NOT NULL,
  destination_url text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING','RETRYING','FAILED','DLQ','DELIVERED')),
  stable_idempotency_key text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  correlation_id text NOT NULL UNIQUE,
  last_http_status integer,
  last_error text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  delivered_at timestamptz
);

CREATE TABLE IF NOT EXISTS delivery_attempts (
  id text PRIMARY KEY,
  delivery_id text NOT NULL REFERENCES delivery_jobs(id),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  kind text NOT NULL CHECK (kind IN ('AUTOMATIC','MANUAL_REPLAY')),
  request jsonb NOT NULL,
  response jsonb NOT NULL,
  http_status integer NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('SUCCEEDED','RETRYABLE_FAILURE','PERMANENT_FAILURE')),
  occurred_at timestamptz NOT NULL,
  UNIQUE (delivery_id, attempt_number)
);

DROP TRIGGER IF EXISTS delivery_attempts_append_only ON delivery_attempts;
CREATE TRIGGER delivery_attempts_append_only
BEFORE UPDATE OR DELETE ON delivery_attempts
FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();

CREATE TABLE IF NOT EXISTS idempotency_results (
  key text PRIMARY KEY,
  request_hash text NOT NULL,
  operation_type text NOT NULL,
  shipment_id text,
  status_code integer NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id text PRIMARY KEY,
  shipment_id text NOT NULL REFERENCES shipments(id),
  idempotency_key text NOT NULL,
  operation_type text NOT NULL,
  base_version integer NOT NULL,
  server_version integer NOT NULL,
  local_payload jsonb NOT NULL,
  options jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_events_shipment_timeline_idx ON audit_events (shipment_id, sequence);
CREATE INDEX IF NOT EXISTS shipments_operational_status_idx ON shipments (lifecycle_status, exception_status, delivery_status);
CREATE INDEX IF NOT EXISTS delivery_jobs_status_idx ON delivery_jobs (status, updated_at);
CREATE INDEX IF NOT EXISTS sync_conflicts_shipment_idx ON sync_conflicts (shipment_id, created_at DESC);

INSERT INTO schema_migrations(version) VALUES ('001_initial') ON CONFLICT (version) DO NOTHING;

COMMIT;
