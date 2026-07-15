-- Pilot operator queue statuses, concurrency guard, append-only audit actors, and distributed auth throttling.
ALTER TABLE booking_requests DROP CONSTRAINT booking_requests_status_check;
UPDATE booking_requests SET status = 'pending_review' WHERE status = 'new';
ALTER TABLE booking_requests
  ADD CONSTRAINT booking_requests_status_check CHECK (status IN ('pending_review', 'contacted', 'accepted', 'rejected', 'cancelled'));
ALTER TABLE booking_requests ADD COLUMN version integer NOT NULL DEFAULT 0 CHECK (version >= 0);

ALTER TABLE booking_request_events DROP CONSTRAINT booking_request_events_actor_type_check;
ALTER TABLE booking_request_events
  ADD CONSTRAINT booking_request_events_actor_type_check CHECK (actor_type IN ('system', 'operator'));

CREATE INDEX booking_requests_queue_created_idx ON booking_requests (created_at DESC, id DESC);
CREATE INDEX booking_requests_queue_status_created_idx ON booking_requests (status, created_at DESC, id DESC);
CREATE INDEX booking_requests_queue_service_created_idx ON booking_requests ((service->>'id'), created_at DESC, id DESC);
CREATE INDEX booking_requests_queue_fulfillment_created_idx ON booking_requests ((fulfillment->>'id'), created_at DESC, id DESC);

CREATE TABLE operator_login_rate_limit_windows (
  identity_hash char(64) NOT NULL CHECK (identity_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz NOT NULL,
  failed_count integer NOT NULL CHECK (failed_count > 0),
  expires_at timestamptz NOT NULL CHECK (expires_at > window_start),
  PRIMARY KEY (identity_hash, window_start)
);
CREATE INDEX operator_login_rate_limit_expires_idx ON operator_login_rate_limit_windows (expires_at);
COMMENT ON TABLE operator_login_rate_limit_windows IS
  'Distributed failed-login counters keyed only by HMAC-SHA256 IP identity; raw IP addresses must never be stored.';
