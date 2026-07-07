# ReGo Mobile Mechanic Test Strategy

Status: testing control plane for unit, component, browser E2E, accessibility, privacy/security, and release gates.
Last updated: 2026-07-02

Canonical journey source: `../product/user-journeys.md`.

Current implementation note:
- Local test suite currently uses Node's built-in test runner via `npm test` (`node --test src/**/*.test.mjs`).
- Browser E2E is desired but not yet implemented: no Playwright/Cypress config or specs are present as of JS-785.
- Payment, messaging/comms, notifications, live auth/RBAC, live provider dispatch, live partner dispatch, production persistence, and production payment/payout/refund behavior remain deferred/stubbed until explicit Linear milestones start them.

## Stack

Current stack:
- Node built-in test runner for unit/state-machine/data tests.
- npm scripts: `npm test`, `npm run lint`, `npm run build`.

Recommended next stack:
- Playwright for browser/e2e tests.
- React Testing Library and user-event if/when component tests are split out.
- axe-core / @axe-core/playwright for accessibility.
- Playwright screenshots for visual regression on create.xyz-inspired customer shell.

## Test taxonomy

Unit:
- pricing calculations and currency formatting
- booking draft guards
- state-machine transitions
- provider eligibility and ranking
- dispatch assignment/reassignment guards
- vehicle/VIN/mileage validation and masking
- localStorage minimization and restore normalization
- RBAC/privacy projections and log redaction
- partner-only roadside handoff routing

Component/UI state:
- service card selection
- fulfillment selection
- oil preference visibility
- provider card selection
- booking summary updates
- vehicle form updates
- status/action button availability
- empty/error/no-match states
- history/report/invoice placeholder states once implemented

Browser E2E / Playwright:
- customer booking smoke through current mocked confirmation path
- customer Car Tow partner-only handoff smoke
- provider demo job accept/progress guard smoke until protected provider route exists
- dispatcher demo assign/reassign/escalate guard smoke until protected admin route exists
- future role-specific customer/provider/admin/support paths after auth/routes exist

Accessibility:
- keyboard-only booking flow
- labeled inputs and buttons
- selected card state is semantic, not color-only
- no critical axe violations on touched flows
- focus visible and ordered
- modal open/close focus management

Security/privacy:
- customer only sees own vehicles/bookings once auth exists
- provider only sees assigned or offered jobs
- admin/support-only routes are protected once routes exist
- VIN/address/payment/private-message data not leaked to logs, analytics, queue rows, localStorage, or role projections
- unknown/malformed role or entity data fails closed

## Canonical journey test matrix

| Journey ID | Journey | Current test status | Required test coverage | Release priority |
| --- | --- | --- | --- | --- |
| CJ-001 | Customer mobile service booking through completion and payment closeout | Unit/state-machine coverage exists for booking/pricing/matching/draft guards; browser E2E missing; payment/comms/report/history closeout deferred | Playwright smoke for current booking path now; later full checkout/auth/messaging/report/payment/history E2E | P0 |
| CJ-002 | Customer partner-routed roadside/tow handoff | Unit/data tests cover partner-only boundary; browser E2E missing | Playwright smoke selecting Car Tow and asserting partner handoff/no ReGo dispatch/provider job | P0 |
| CJ-003 | Customer cancellation/reschedule/support/dispute | Mostly docs/state-machine only | State-machine tests plus E2E after cancellation/support/payment/refund implementation | P1 |
| PJ-001 | Mechanic/provider accepts and completes a mobile job | Provider ops/state-machine unit coverage and demo UI exist; true role E2E missing | Interim Playwright demo smoke; later protected provider route inbox -> accept -> status -> report -> completion -> payout queued | P0/P1 |
| PJ-002 | Provider change request and customer approval | Mostly state-machine/docs | Unit tests for approval transitions; later two-sided E2E approval/decline flow | P1 |
| AJ-001 | Dispatcher/admin assigns, monitors, escalates, and closes jobs | Dispatch unit coverage and demo UI exist; true role E2E missing | Interim Playwright demo smoke; later protected admin queue -> assign/reassign/escalate/audit closeout | P0/P1 |
| AJ-002 | Admin/support payment/refund/dispute/audit intervention | Deferred | RBAC/privacy/payment tests and E2E after support/payment implementation | P1/P2 |
| SJ-001 | Shop/dealership service-lane booking | Deferred | Future partner role E2E after shop/dealer surface exists | P2 |

## Initial Playwright milestone recommendation

Before implementing real payments/comms, add a browser smoke suite that validates the current MVP shell and guards against regressions:

1. `e2e-customer-oil-mobile-checkout-stub`
   - Open `/`.
   - Verify create.xyz-inspired customer shell renders.
   - Select Oil Change.
   - Open Schedule Now / booking modal.
   - Verify required service/location/schedule/estimate copy.
   - Exercise confirmation guard against incomplete unsafe state where available.

2. `e2e-customer-car-tow-partner-handoff-only`
   - Open `/`.
   - Select Car Tow.
   - Verify partner-only/emergency handoff copy.
   - Assert provider/dispatch normal booking indicators are not created/exposed for tow.

3. `e2e-provider-demo-job-progress-guard`
   - Open internal demo provider surface only through its current lower-page section.
   - Accept/progress a seeded job.
   - Verify lifecycle guards and completion/report readiness copy.
   - This is temporary until a protected provider route exists.

4. `e2e-admin-demo-assignment-escalation-guard`
   - Open internal demo dispatch surface only through its current lower-page section.
   - Assign/reassign/escalate/resolve a seeded job.
   - Verify masked queue data and audit-facing status copy.
   - This is temporary until a protected admin route exists.

## Release gates

PR gate:
- `npm ci` succeeds.
- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes.
- Feature docs updated for touched behavior.
- If touched flow has Playwright coverage, relevant Playwright spec passes in Chromium.
- No critical accessibility violations on touched browser flows once accessibility tooling exists.

Main/staging gate:
- Full unit/state-machine/data suite passes.
- Browser smoke passes in Chromium once Playwright exists.
- Visual changes to create.xyz-inspired customer shell are reviewed against screenshots.
- No P0/P1 defects.
- No console/runtime errors in smoke flow.

Production gate:
- Deployed app loads.
- Customer booking smoke passes.
- Role-specific auth boundaries pass once auth exists.
- Payments, messaging, notifications, provider dispatch, and roadside partner integrations must each have explicit production-readiness checks before activation.
- Error monitoring and rollback plan ready once backend exists.

## Feature doc testing requirements

Each feature doc must include:
- Given/When/Then acceptance criteria.
- Unit test cases for business rules.
- Component/UI state test cases where applicable.
- E2E tests or journey IDs from `../product/user-journeys.md`.
- Accessibility expectations.
- Error/empty/loading states.
- Security/privacy tests when data is role-scoped.
- Release gate impact.

## Deferred integration test policy

While integrations are deferred:
- Tests should assert inert/stubbed behavior, not fake production behavior.
- Payment tests should use test-provider/mock states only and must not store/log card, token, bank, processor secret, or payment metadata.
- Messaging tests should assert feature-flagged or booking-scoped stub behavior and PII-safe display.
- Notification tests should assert no live SMS/email/push provider call.
- Auth/RBAC tests should assert fail-closed projections and future route boundaries without claiming production auth is live.
