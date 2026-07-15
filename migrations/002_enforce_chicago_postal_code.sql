ALTER TABLE booking_requests
  ADD CONSTRAINT booking_requests_location_chicago_postal_code CHECK (
    location ?& ARRAY['type', 'address', 'postalCode', 'notes']
    AND jsonb_typeof(location->'postalCode') = 'string'
    AND location->>'postalCode' ~ '^606[0-9]{2}$'
    AND (location->>'postalCode')::integer BETWEEN 60601 AND 60661
  ) NOT VALID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM booking_requests
    WHERE NOT (
      location ? 'postalCode'
      AND jsonb_typeof(location->'postalCode') = 'string'
      AND location->>'postalCode' ~ '^606[0-9]{2}$'
      AND (location->>'postalCode')::integer BETWEEN 60601 AND 60661
    )
  ) THEN
    ALTER TABLE booking_requests VALIDATE CONSTRAINT booking_requests_location_chicago_postal_code;
  END IF;
END $$;

COMMENT ON CONSTRAINT booking_requests_location_chicago_postal_code ON booking_requests IS
  'Chicago pilot accepts five-digit ZIP codes in the explicit 60601 through 60661 range. Address text is not coverage authority.';
