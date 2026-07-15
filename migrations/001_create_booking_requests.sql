CREATE TABLE IF NOT EXISTS booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_reference varchar(13) NOT NULL UNIQUE CHECK (public_reference ~ '^BR_[A-Z0-9]{10}$'),
  idempotency_key varchar(128) NOT NULL UNIQUE CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{10,128}$'),
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  response_summary jsonb NOT NULL CHECK (
    jsonb_typeof(response_summary) = 'object'
    AND response_summary ?& ARRAY['customerName', 'serviceName', 'fulfillmentLabel', 'vehicle', 'quoteRequired']
    AND jsonb_typeof(response_summary->'customerName') = 'string'
    AND jsonb_typeof(response_summary->'serviceName') = 'string'
    AND jsonb_typeof(response_summary->'fulfillmentLabel') = 'string'
    AND jsonb_typeof(response_summary->'vehicle') = 'string'
    AND jsonb_typeof(response_summary->'quoteRequired') = 'boolean'
  ),
  status varchar(32) NOT NULL CHECK (status = 'new'),
  customer jsonb NOT NULL CHECK (
    jsonb_typeof(customer) = 'object'
    AND customer ?& ARRAY['name', 'email', 'phone']
    AND jsonb_typeof(customer->'name') = 'string' AND length(trim(customer->>'name')) > 0
    AND (customer->'email' = 'null'::jsonb OR jsonb_typeof(customer->'email') = 'string')
    AND (customer->'phone' = 'null'::jsonb OR jsonb_typeof(customer->'phone') = 'string')
    AND (coalesce(customer->>'email', '') <> '' OR coalesce(customer->>'phone', '') ~ '^\+[1-9][0-9]{7,14}$')
  ),
  consented_at timestamptz NOT NULL,
  consent_source varchar(64) NOT NULL CHECK (consent_source = 'booking_request_form'),
  market_id varchar(64) NOT NULL CHECK (market_id = 'chicago'),
  service jsonb NOT NULL CHECK (jsonb_typeof(service) = 'object' AND service ?& ARRAY['id', 'name'] AND jsonb_typeof(service->'id') = 'string' AND jsonb_typeof(service->'name') = 'string'),
  fulfillment jsonb NOT NULL CHECK (jsonb_typeof(fulfillment) = 'object' AND fulfillment ?& ARRAY['id', 'label'] AND jsonb_typeof(fulfillment->'id') = 'string' AND jsonb_typeof(fulfillment->'label') = 'string'),
  provider_preference jsonb CHECK (provider_preference IS NULL OR (jsonb_typeof(provider_preference) = 'object' AND provider_preference ?& ARRAY['id', 'name'] AND jsonb_typeof(provider_preference->'id') = 'string' AND jsonb_typeof(provider_preference->'name') = 'string')),
  oil_option jsonb CHECK (oil_option IS NULL OR (jsonb_typeof(oil_option) = 'object' AND oil_option ?& ARRAY['id', 'name'] AND jsonb_typeof(oil_option->'id') = 'string' AND jsonb_typeof(oil_option->'name') = 'string')),
  vehicle jsonb NOT NULL CHECK (
    jsonb_typeof(vehicle) = 'object' AND jsonb_typeof(vehicle->'year') = 'number'
    AND vehicle ?& ARRAY['year', 'make', 'model', 'vinSuffix']
    AND jsonb_typeof(vehicle->'make') = 'string' AND jsonb_typeof(vehicle->'model') = 'string'
    AND (vehicle->'vinSuffix' = 'null'::jsonb OR (jsonb_typeof(vehicle->'vinSuffix') = 'string' AND vehicle->>'vinSuffix' ~ '^[A-HJ-NPR-Z0-9]{4,6}$'))
    AND NOT vehicle ? 'vin'
  ),
  schedule_preference varchar(200) NOT NULL CHECK (length(trim(schedule_preference)) > 0),
  location jsonb NOT NULL CHECK (
    jsonb_typeof(location) = 'object' AND jsonb_typeof(location->'type') = 'string'
    AND location ?& ARRAY['type', 'address', 'notes']
    AND jsonb_typeof(location->'address') = 'string' AND length(trim(location->>'address')) > 0
    AND (location->'notes' = 'null'::jsonb OR jsonb_typeof(location->'notes') = 'string')
  ),
  estimate_snapshot jsonb,
  quote_required boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_request_quote_semantics CHECK (
    (quote_required AND estimate_snapshot IS NULL AND response_summary->'quoteRequired' = 'true'::jsonb)
    OR
    (NOT quote_required AND response_summary->'quoteRequired' = 'false'::jsonb
      AND jsonb_typeof(estimate_snapshot) = 'object'
      AND estimate_snapshot ?& ARRAY['source', 'currency', 'total']
      AND estimate_snapshot->>'source' = 'server_catalog'
      AND estimate_snapshot->>'currency' = 'USD'
      AND jsonb_typeof(estimate_snapshot->'total') = 'number'
      AND (estimate_snapshot->>'total')::numeric >= 0)
  )
);

CREATE TABLE IF NOT EXISTS booking_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id uuid NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  event_type varchar(64) NOT NULL CHECK (length(trim(event_type)) > 0),
  actor_type varchar(32) NOT NULL CHECK (actor_type = 'system'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_request_events_request_created_idx ON booking_request_events (booking_request_id, created_at);

COMMENT ON TABLE booking_requests IS 'Contains booking contact/location PII. Product Privacy owns retention and anonymization policy; Operations owns execution after policy approval. No destructive cleanup is authorized until durations, legal holds, and anonymization fields are approved.';
COMMENT ON TABLE booking_request_events IS 'Audit-oriented event history; application permissions do not currently enforce append-only behavior. Event metadata must not contain contact, location, VIN, payload, or database error data.';
