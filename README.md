# Mobile Mechanic Marketplace

Working prototype for a customer-facing mobile mechanic booking marketplace.

## Run

```bash
npm install
npm run db:migrate
npm run dev
```

Open http://localhost:3000.

## Verify

```bash
TEST_DATABASE_URL=postgresql:///rego_test npm run test:rego
npm run lint
TEST_DATABASE_URL=postgresql:///rego_test npm run test:e2e
npm run build
node scripts/context-snapshot.mjs
```

The booking-request API requires PostgreSQL. Copy `.env.example` to a local
environment file, set the required pooled `DATABASE_URL`, and run
`npm run db:migrate` before the server. Integration tests deliberately have no
development-database fallback: create the disposable `rego_test` database and
run the canonical full command `TEST_DATABASE_URL=postgresql:///rego_test npm run test:rego`.
Bare `npm test` has the same PostgreSQL integration tests and therefore requires
an explicit safe `TEST_DATABASE_URL`; it never falls back to `DATABASE_URL`.
The database name must contain `test`. The destructive guard can be bypassed only
for a manually verified one-off by setting
`ALLOW_UNSAFE_TEST_DATABASE=JS889_ONE_OFF_ALLOW_DESTRUCTIVE_TESTS`. CI provisions
PostgreSQL 16 automatically.

The Playwright command runs migrations against `TEST_DATABASE_URL` (defaulting
locally to the explicit disposable `postgresql:///rego_test` database), then
starts its own Next.js development server on `http://127.0.0.1:3107`, so it does not reuse or interfere with an app already
running on port 3000. Install Chromium once on a new machine with
`npx playwright install chromium`. On Linux and in CI, install Chromium and its
system dependencies with `npx playwright install --with-deps chromium`. Use
`npm run test:e2e:headed` to debug in a visible browser and
`npm run test:e2e:update` only when intentionally approving desktop and mobile
visual changes. Review updated baselines against the north-star references in
`Screenshots/` before accepting them. Baselines are platform-specific so macOS
local review and Linux CI each compare against deterministic references.

## Current scope

- Service selection
- Fulfillment choice: mobile mechanic, independent shop, dealership
- Oil preference flow
- Provider comparison
- Persistent Chicago-pilot concierge requests (pending review, not confirmed bookings)
- Booking summary and nonbinding estimate
- Editable vehicle profile
- Service history

## Customer request semantics

The normal mechanic flow sends `POST /api/booking-requests` only after the
customer supplies a name, at least one contact channel, and explicit consent.
The browser keeps contact, address, notes, full VIN, every VIN suffix, confirmation, and the
cryptographically random idempotency key out of web storage. Vehicle suffixes exist
only in transient request state and the durable server request. A successful
response means the PostgreSQL request and initial event were saved; it remains
`pending review` until ReGo contacts the customer. Requested providers and times
are nonbinding, and no payment is collected. Car Tow remains a partner-only
handoff and never creates a mechanic request.

## Production privacy and abuse controls

The public endpoint uses an atomic PostgreSQL fixed-window counter shared by all
instances (default 10 submissions per client per minute). Only an HMAC-SHA256
identity digest is stored; raw IP addresses are never persisted. On Vercel,
identity comes only from normalized `x-vercel-forwarded-for`; arbitrary
`x-forwarded-for` is ignored. Outside Vercel production, launch is blocked unless
`BOOKING_TRUSTED_PROXY_IP_HEADER` and a 32+ byte
`BOOKING_TRUSTED_PROXY_SECRET` define an authenticated proxy contract. That proxy
must overwrite the configured IP header and inject `x-booking-proxy-secret`.
Production also requires a separate 32+ byte `BOOKING_RATE_LIMIT_SECRET`.

The pilot PII policy deletes every booking request, regardless of status, once
`created_at` is older than 90 days; event rows cascade. The retention setting is
safely configurable from 30–90 days and defaults to the approved 90-day maximum.
`npm run privacy:purge` is a dry run and requires an explicit `DATABASE_URL`; add
`-- --execute` to drain the purge in bounded batches. Vercel calls
`/api/internal/retention` daily using `Authorization: Bearer ***` and drains up to
50 batches of 1,000 rows per invocation while reporting whether backlog may remain.
Before production launch, configure independent `BOOKING_RATE_LIMIT_SECRET` and
`CRON_SECRET` values, apply migrations through 004, and verify the Vercel cron is
enabled and succeeding. Missing protection or cron credentials fail closed.

Coverage checks are deliberately limited to consistency of a customer-entered
explicit `Chicago, IL` address and ZIP 60601–60661. They do not geocode, establish
an authoritative boundary, or confirm coverage. Every success remains pending
operator coverage verification.

## Planning docs

- `docs/PROJECT_BRIEF.md`
- `docs/plans/mobile-mechanic-build-plan.md`
