# Booking request API and PostgreSQL foundation

Status: JS-889 backend foundation. Customer UI, operator queue, and notification delivery are out of scope.

## Endpoint and trust boundary

`POST /api/booking-requests` accepts only `application/json`, with a 32 KiB streamed-body limit, and requires an `Idempotency-Key` of 10–128 ASCII letters, numbers, `.`, `_`, `:`, or `-`. Exact allowlists apply at the top level and within `customer`, `consent`, `vehicle`, and `location`. The top-level canonical `marketId` is required; the pilot accepts only `chicago` and never infers a market from free-form address text. Unknown keys and server-owned status, pricing, actor, timestamp, estimate, and reference fields are rejected at every supported nesting level. Full VIN (`vehicle.vin`) is prohibited; only an optional 4–6-character suffix is accepted.

Customer input requires a name and email or complete phone. Phones are normalized to an E.164-compatible `+` and 8–15 digits representation. Consent must be exactly `{ accepted: true, source: "booking_request_form" }`. Catalog IDs are resolved server-side. Before persistence, matching must find a currently available provider supporting the canonical service, fulfillment mode, and market; a provider preference is nonbinding but must itself be eligible. Unsupported combinations fail closed. In particular, brake service is currently shop-only in Chicago, and Car Tow (`tow`) remains partner-only and cannot create a booking request. Fixed estimates are computed and snapshotted from the trusted server catalog; quote-required requests have no estimate total.

Success is `201` with a PII-minimized response. An identical retry returns the fully equivalent stored response. Reusing a key for a different canonical payload returns typed `409`. Validation, media, size, throttling, and availability responses use `400`, `415`, `413`, `429`, and `503` respectively.

## Persistence, migrations, and idempotency

Set `DATABASE_URL` explicitly and run `npm run db:migrate`. Production must use the provider's pooled PostgreSQL connection URL suitable for transactions and session advisory locks; do not use a direct high-connection URL in serverless request handlers. Pool size is restricted to 1–20 and defaults to 5, with connection, query, statement, idle-client, and idle-transaction timeouts.

The migration runner uses a PostgreSQL advisory lock to serialize runners and stores each migration's SHA-256 checksum in a `NOT NULL` column. Startup fails closed if an applied migration was edited or any legacy applied row has a NULL/blank checksum; it never assigns the current file checksum to unverifiable history. Never edit an applied migration in a deployed environment; add a new numbered migration.

`booking_requests` stores a canonical-client-intent fingerprint and safe response source fields. The fingerprint covers only structurally normalized, allowlisted wire fields and excludes catalog labels, computed prices, provider availability, and timestamps. Structural validation and fingerprint lookup happen before mutable catalog resolution, so an identical retry replays after catalog/pricing/availability changes; unknown fields, full VIN, and server-owned fields are still rejected before lookup. Request and initial event are inserted in one transaction. Unique idempotency plus fingerprint comparison prevents duplicate request/event rows and detects key reuse with another request. SQL is parameterized; only repository-owned static migration/statement text is executed.

Integration tests require an explicit `TEST_DATABASE_URL`; there is no development-database fallback. Every test creates and drops a unique schema and runs migrations fresh. Local PostgreSQL 16 workflow:

```bash
createdb rego_test # once; ignore the already-exists error
npm run test:rego
```

CI provisions PostgreSQL 16 and exports `TEST_DATABASE_URL`, so ordinary `npm test` exercises unit and real-PostgreSQL tests.

## Abuse controls and deployment requirement

The route rejects unsupported media before reading a body, reads the stream with a strict byte cap, and has a bounded per-instance fixed-window limiter. On Vercel (`VERCEL=1`), the per-client key uses only the Vercel-controlled `X-Vercel-Forwarded-For` contract: exactly one syntactically valid IPv4 or IPv6 address, normalized to lowercase; missing, list-valued, or malformed values collapse to a safe malformed-ingress key. Client-controlled `X-Forwarded-For` is never trusted. Outside verified Vercel ingress, the process uses a high 10,000/minute global circuit breaker rather than making a false low-volume per-client claim or exposing the old shared 60/minute denial-of-service bucket. Its clock, store, and key function remain injectable for deterministic tests.

Per-instance memory limiting is defense in depth only. Production owners MUST configure and monitor Vercel/edge distributed rate limiting, request-size policy, WAF/bot controls, and the trusted platform identity/header contract; application release approval depends on those controls.

## Privacy, retention, and telemetry

Contact and exact location are PII retained to action a request. Product Privacy owns approval of retention duration, legal-hold behavior, and anonymization fields; Operations owns cleanup execution and monitoring after approval. No destructive cleanup is implemented or authorized until that policy is approved. Schema comments record this ownership.

Event history is audit-oriented but is not claimed to be append-only because database permissions/triggers do not enforce that property. Event metadata must never include payloads, contact/location/VIN data, or raw errors.

Errors include a non-PII correlation ID. Telemetry contains only a fixed event name, safe category, correlation ID, and—when available—the two-character SQLSTATE class. Raw payloads, error messages, SQL, and connection details are excluded.
