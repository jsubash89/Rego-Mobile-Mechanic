# Mobile Mechanic Marketplace

Working prototype for a customer-facing mobile mechanic booking marketplace.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Verify

```bash
npm test
npm run lint
npm run test:e2e
npm run build
node scripts/context-snapshot.mjs
```

The Playwright command starts its own Next.js development server on
`http://127.0.0.1:3107`, so it does not reuse or interfere with an app already
running on port 3000. Install Chromium once on a new machine with
`npx playwright install chromium`. On Linux and in CI, install Chromium and its
system dependencies with `npx playwright install --with-deps chromium`. Use
`npm run test:e2e:headed` to debug in a visible browser and
`npm run test:e2e:update` only when intentionally approving desktop and mobile
visual changes. Review updated baselines against the north-star references in
`Screenshots/` before accepting them.

## Current scope

- Service selection
- Fulfillment choice: mobile mechanic, independent shop, dealership
- Oil preference flow
- Provider comparison
- Booking summary and estimate
- Editable vehicle profile
- Service history

## Planning docs

- `docs/PROJECT_BRIEF.md`
- `docs/plans/mobile-mechanic-build-plan.md`
