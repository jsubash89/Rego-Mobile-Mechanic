-- Migration 003's explicit-Chicago constraint predates ZIP+4 support. Replace it
-- in this new migration rather than changing the applied migration.
ALTER TABLE booking_requests
  DROP CONSTRAINT booking_requests_location_explicit_chicago_il;
ALTER TABLE booking_requests
  ADD CONSTRAINT booking_requests_location_explicit_chicago_il CHECK (
    jsonb_typeof(location->'address') = 'string'
    AND location->>'address' !~ E'[\r\n]'
    AND location->>'address' !~* '\m(detroit|michigan)\M'
    AND location->>'address' ~* '(,|^)\s*chicago\s*,\s*(il|illinois)(\s+606[0-9]{2}(-[0-9]{4})?)?(\s*,\s*(usa|united states))?\s*$'
  ) NOT VALID;
ALTER TABLE booking_requests
  VALIDATE CONSTRAINT booking_requests_location_explicit_chicago_il;

-- Enforce consistency between every ZIP/ZIP+4 token in the customer-entered
-- address and the separately structured pilot postal code. Existing mismatches
-- fail validation so the migration cannot silently bless inconsistent PII.
ALTER TABLE booking_requests
  ADD CONSTRAINT booking_requests_location_postal_code_consistent CHECK (
    regexp_replace(
      location->>'address',
      '\m' || (location->>'postalCode') || '(-[0-9]{4})?\M',
      '',
      'g'
    ) !~ '\m[0-9]{5}(-[0-9]{4})?\M'
  ) NOT VALID;
ALTER TABLE booking_requests
  VALIDATE CONSTRAINT booking_requests_location_postal_code_consistent;

-- Supports deterministic retention scans ordered by created_at then id.
CREATE INDEX booking_requests_created_at_id_idx
  ON booking_requests (created_at, id);
