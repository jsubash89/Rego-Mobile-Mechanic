-- Fail closed if any legacy row violates the postal constraint introduced by 002.
-- ALTER ... VALIDATE raises and rolls back this migration; no partial/unvalidated
-- launch state is accepted.
ALTER TABLE booking_requests
  VALIDATE CONSTRAINT booking_requests_location_chicago_postal_code;

ALTER TABLE booking_requests
  ADD CONSTRAINT booking_requests_location_explicit_chicago_il CHECK (
    jsonb_typeof(location->'address') = 'string'
    AND location->>'address' !~ E'[\r\n]'
    AND location->>'address' !~* '\m(detroit|michigan)\M'
    AND location->>'address' ~* '(,|^)\s*chicago\s*,\s*(il|illinois)(\s+606[0-9]{2})?(\s*,\s*(usa|united states))?\s*$'
  ) NOT VALID;
ALTER TABLE booking_requests
  VALIDATE CONSTRAINT booking_requests_location_explicit_chicago_il;

ALTER TABLE booking_requests
  ADD CONSTRAINT booking_requests_vehicle_vin_suffix_exact CHECK (
    vehicle ? 'vinSuffix'
    AND (
      vehicle->'vinSuffix' = 'null'::jsonb
      OR (
        jsonb_typeof(vehicle->'vinSuffix') = 'string'
        AND vehicle->>'vinSuffix' ~ '^[A-Za-z0-9]{6}$'
      )
    )
    AND NOT vehicle ? 'vin'
  ) NOT VALID;
ALTER TABLE booking_requests
  VALIDATE CONSTRAINT booking_requests_vehicle_vin_suffix_exact;

CREATE TABLE booking_rate_limit_windows (
  identity_hash char(64) NOT NULL CHECK (identity_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  expires_at timestamptz NOT NULL CHECK (expires_at > window_start),
  PRIMARY KEY (identity_hash, window_start)
);
CREATE INDEX booking_rate_limit_windows_expires_at_idx
  ON booking_rate_limit_windows (expires_at);

COMMENT ON TABLE booking_rate_limit_windows IS
  'Short-lived distributed abuse-control counters. identity_hash is HMAC-SHA256; raw client IPs must never be stored.';
COMMENT ON TABLE booking_requests IS
  'Contains customer-entered booking contact/location and optional VIN suffix PII. Purge requests and cascaded events after the configured 90-day pilot retention period regardless of status.';
