# ReGo Mobile Mechanic Exhaustive Test Strategy

Status: buildable testing strategy/control plane for current and future unit, component/UI-state, browser E2E, accessibility, visual regression, privacy/security, data contracts, release gates, and app-ready certification.
Last updated: 2026-07-14
Linear: JS-787 — Docs: exhaustive test strategy
Implementation milestone: JS-888 — Playwright foundation and current MVP smoke certification

Canonical journey source: `../product/user-journeys.md`.

This document defines how ReGo should be tested as it moves from the current static/mock-first MVP shell toward an app customers, mechanics, and admins can actually use.

Current implementation note:
- Local test suite currently uses Node's built-in test runner via `npm test` (`node --test src/**/*.test.mjs`).
- Required local gates are `git diff --check`, `npm test`, `npm run lint`, `npm run test:e2e`, and `npm run build`.
- Playwright Chromium E2E is implemented by JS-888 via `npm run test:e2e`; it starts an isolated local server on port 3107.
- Payment, messaging/comms, notifications, live auth/RBAC, live provider dispatch, live partner dispatch, production persistence, and production payment/payout/refund behavior remain deferred/stubbed until explicit Linear milestones start them.
- Tests and CI must mock external behavior until those integrations are intentionally activated.

## Testing principles

1. Journey-first: every major test maps to a canonical journey ID from `../product/user-journeys.md`.
2. Docs-as-control-plane: every meaningful feature doc must include acceptance criteria, business rules, data/API contracts, and test coverage expectations before or alongside implementation.
3. Mock honestly: tests may validate mocked/stubbed behavior, but must not imply production auth, payment, messaging, dispatch, partner, or persistence integrations exist.
4. Fail closed: unknown role/entity/market/provider/payment/message states should block unsafe actions rather than silently permit them.
5. Privacy by default: tests must prove full VIN, full address, payment secrets, raw private messages, contact details, and unnecessary PII do not leak into localStorage, logs, role projections, queue rows, or analytics.
6. Customer simplicity: create.xyz/Uber-inspired customer UX is a quality gate, not decoration. Customer flows should stay simple, direct, safety-forward, inclusive, and trustworthy.
7. Multi-actor truth: customer, mechanic/provider, dispatcher/admin, and support journeys must agree on the same booking/job/payment/message/audit states.
8. CI evidence: Linear milestones are Done only after local gates and GitHub Actions CI pass.

## Current test stack

Current:
- Node built-in test runner for unit/state-machine/data tests.
- ESLint via `npm run lint`.
- Next build via `npm run build`.
- Playwright Chromium smoke and visual regression coverage runs via `npm run test:e2e`.
- GitHub Actions CI installs Chromium and runs lint, build, unit tests, and browser E2E.

Recommended next:
- `@axe-core/playwright` for browser accessibility checks.
- React Testing Library/user-event for component-level tests if UI logic becomes too complex for browser-only coverage.

## Test pyramid and ownership

| Layer | Purpose | Current status | Owner milestone pattern |
| --- | --- | --- | --- |
| Unit/data tests | Pure business rules, pricing, matching, routing, sanitization, state transitions | Implemented for major engines | Add/update with each feature engine |
| Component/UI-state tests | Stateful UI controls and disabled/enabled action surfaces | Mostly absent; some behavior covered indirectly | Add when flows outgrow pure helper tests |
| Browser E2E smoke | Verify user-visible click paths in current app shell | Implemented in Chromium for customer, Car Tow, provider, and dispatch MVP paths | Expand with protected routes/live contracts only when those features exist |
| Accessibility checks | Keyboard, labels, focus, axe critical violations | Not implemented | Add in the accessibility smoke milestone after Playwright setup |
| Visual regression | Guard create.xyz customer UX north-star | Desktop and mobile Playwright baselines implemented | Update snapshots only for intentional UX changes |
| Privacy/security negative tests | Role projections, storage minimization, logs, fail-closed data | Strong unit coverage plus browser localStorage checks | Add with each privacy/Auth/RBAC/payment/comms milestone |
| Data-contract tests | Static data shape, service/provider/partner contracts, future mocked API contracts | Partial | Add before integrating any live backend/API |
| Release gates | Local and CI verification | Implemented for lint/build/unit/browser tests | Expand with accessibility automation when added |
| Manual exploratory review | Human localhost walkthroughs against screenshots and journeys | Ad hoc | Formalize at app-ready checkpoints |

## Unit/data coverage requirements

Unit/data tests should be deterministic, fast, and independent of live services.

Required coverage areas:
- Pricing and estimates:
  - oil/parts/TBD behavior
  - fixed vs provider-confirmed totals
  - fulfillment/platform fees
  - customer-safe projection excludes provider payout, margin, internal fees, and payment secrets
- Booking readiness:
  - required service, vehicle, fulfillment, provider, appointment time, estimate, and acknowledgements
  - confirmation state never restores as confirmed
  - service/fulfillment/vehicle changes reset incompatible downstream selections
- Provider eligibility/matching:
  - service support
  - fulfillment support
  - availability and appointment slots
  - mobile travel caps and explicit service areas
  - market normalization and fail-closed unknown provider market when request market is known
  - provider-confirmed fitment/parts support
  - deterministic ranking and tie-breaks
- Local storage/privacy:
  - no full VIN or full address persisted
  - malformed persisted data clears safely
  - stale provider/time normalized against current eligibility
  - location/market context passed into restore normalization
- Provider lifecycle:
  - accept/decline rules
  - en route/arrived/started/completed ordering
  - report requirements gate completion
  - scope/price changes require customer approval
  - terminal states cannot regress
- Dispatch/admin operations:
  - candidate ranking consumes canonical matching output
  - manual assignment/reassignment guards
  - terminal/unknown/no-op/fail-closed actions
  - blocked/at-risk queue derivation
  - audit metadata on manual actions
  - decorated queue data remains masked and idempotent
- Roadside partner handoff:
  - roadside/tow/lockout/fuel/emergency services route partner-only
  - unsupported market/service returns safe fallback and no dispatch-like fields
  - no normal ReGo provider job, dispatch job, assignment, or status is created
- Auth/RBAC/privacy readiness:
  - customer/provider/admin/support projections
  - unknown/malformed role fails closed
  - nested PII/payment/message/log metadata redaction
  - deferred payment/message/notification writes fail closed

## Component/UI-state coverage requirements

Add component/UI-state tests when a flow has enough state transitions that browser E2E alone would be too broad.

Candidate UI-state tests:
- service tile selection and selected-state semantics
- Schedule Now modal open/close and focus behavior
- fulfillment toggle resets invalid provider/slot choices
- oil/parts preference appears only for relevant services
- provider card selection preserves only eligible provider/time combinations
- customer estimate panel updates when service/fulfillment/provider changes
- confirmation CTA disabled reasons are visible and specific
- Car Tow uses partner-handoff messaging instead of normal booking confirmation
- provider demo actions only show legal next actions
- admin demo queue actions hide unsafe assign/reassign/escalate controls

## Browser E2E strategy

Browser E2E should validate visible click-through behavior, not replace unit/state-machine tests.

Rules:
- Use Playwright Chromium through `npm run test:e2e` (isolated port 3107).
- Keep first suite smoke-level and stable; do not build a brittle full backend fantasy.
- External systems remain mocked/stubbed.
- Use stable selectors (`data-testid`) where needed instead of visual text only.
- Check localStorage for privacy invariants after customer booking flows.
- Check no customer top navigation exposes provider/admin/dispatch surfaces.
- Check console has no runtime errors for smoke paths.
- Add axe critical-violation checks after initial Playwright setup.
- Keep checked-in platform-specific desktop/mobile baselines stable and update them only after intentional visual review against `Screenshots/`; macOS supports local review while Linux baselines certify GitHub CI rendering.

Initial Playwright milestone scope:

1. `e2e-customer-oil-mobile-checkout-stub`
   - Journey: CJ-001.
   - Open `/`.
   - Verify ReGo/create.xyz-inspired customer shell renders.
   - Verify customer top nav does not expose internal provider/admin/dispatch demos.
   - Select Oil Change.
   - Open Schedule Now / booking modal.
   - Enter/update safe vehicle details.
   - Select mobile fulfillment, oil/parts preference, provider/slot where available.
   - Verify estimate/review/payment-auth stub copy.
   - Verify incomplete unsafe state cannot confirm.
   - Verify no full VIN/full address in localStorage.

2. `e2e-customer-diagnostic-no-oil-step`
   - Journey: CJ-001.
   - Select a non-oil service.
   - Verify oil/parts preference is hidden or skipped.
   - Verify estimate and provider eligibility still update.

3. `e2e-customer-provider-slot-normalizes-after-service-change`
   - Journey: CJ-001.
   - Select a service/provider/slot.
   - Change upstream service or fulfillment.
   - Verify incompatible provider/slot is cleared or replaced safely.

4. `e2e-customer-car-tow-partner-handoff-only`
   - Journey: CJ-002.
   - Select Car Tow.
   - Verify partner-only/emergency handoff copy.
   - Verify ReGo does not create normal booking/provider/dispatch indicators for tow.
   - Verify no dispatch/provider job controls appear as the result of the tow path.

5. `e2e-provider-demo-job-progress-guard`
   - Journey: PJ-001.
   - Use current lower-page internal demo surface until protected provider route exists.
   - Progress a seeded provider job through legal actions.
   - Verify illegal lifecycle shortcuts are hidden/blocked.
   - Verify report/completion readiness copy appears before completion.
   - Verify masked customer/location data.

6. `e2e-provider-change-request-customer-approval-stub`
   - Journey: PJ-002.
   - Use current demo/stateful surface when available; otherwise defer until UI exists.
   - Verify provider change request requires active job state.
   - Verify customer approval copy shows old/new total and reason in stubbed form.
   - Verify payment adjustment remains stubbed.

7. `e2e-admin-demo-assignment-escalation-guard`
   - Journey: AJ-001.
   - Use current lower-page dispatch demo surface until protected admin route exists.
   - Assign eligible provider from queue.
   - Reassign/escalate/resolve blocked or at-risk job where available.
   - Verify candidate order aligns with matching engine.
   - Verify queue data is masked.
   - Verify roadside handoff jobs are not assignable.

8. `e2e-createxyz-customer-visual-smoke`
   - Journeys: CJ-001, CJ-002.
   - Verify landing/service tile order and simple Uber-inspired customer shell.
   - Compare against approved screenshots/baselines once Playwright screenshots are configured.
   - Must preserve Car Tow visual presence while keeping partner-only behavior.

## Canonical journey coverage matrix

| Journey ID | Priority | Current coverage | Missing coverage | Future browser spec names | Acceptance checkpoints |
| --- | --- | --- | --- | --- | --- |
| CJ-001 | P0 | Unit coverage for pricing, matching, booking readiness, localStorage, and privacy projections; Playwright smoke covers customer shell, oil/non-oil paths, confirmation guards, sensitive draft exclusion, and reload behavior | Payment authorization/capture, messaging, report/invoice/history UI, live auth/backend, and browser selection of fulfillment/provider/slot controls that do not yet exist | `e2e-customer-oil-mobile-checkout-stub`, `e2e-customer-diagnostic-no-oil-step`, `e2e-customer-provider-slot-normalizes-after-service-change`, `e2e-customer-completion-report-history-stub` | no provider/admin nav; required fields gate confirmation; estimate excludes internal economics; no full VIN/address storage; payment/comms labeled stubbed |
| CJ-002 | P0 | Unit/data coverage plus Playwright smoke for partner-only handoff, unsupported-market fail-closed behavior, and unchanged provider/dispatch queues; Car Tow visual tile present | Future live partner contract tests | `e2e-customer-car-tow-partner-handoff-only`, `e2e-roadside-does-not-create-dispatch-job` | Car Tow remains visible; no normal booking/provider/dispatch job; unsupported market fails closed |
| CJ-003 | P1 | Docs/state-machine expectations only | cancellation/reschedule/support UI, payment/refund stub tests, browser E2E | `e2e-customer-reschedule-active-booking`, `e2e-customer-cancel-before-provider-enroute`, `e2e-customer-dispute-after-invoice` | no orphaned assigned jobs; refunds require permission/reason; audit redacts PII; dispute/payment/report states separate |
| PJ-001 | P0/P1 | Provider lifecycle unit coverage plus interim Playwright demo smoke for legal progress, report-gated completion, report-ready completion, and masked summaries | Protected provider route, messaging/report upload UI, and payout integration | `e2e-provider-accept-progress-report-complete`, `e2e-provider-decline-with-reason` | provider sees assigned/offered jobs only; lifecycle order enforced; report gates completion; payout separate from customer payment |
| PJ-002 | P1 | State-machine/docs coverage for approval-required behavior | Two-sided UI, browser E2E, payment adjustment stub UI | `e2e-provider-change-request-customer-approval-stub`, `e2e-provider-change-request-approved`, `e2e-provider-change-request-declined` | request only from legal active states; customer sees old/new total/reason; decline path not dead-end; payment remains stubbed |
| AJ-001 | P0/P1 | Dispatch assignment/reassignment queue unit coverage plus interim Playwright demo smoke for assignment guards, blocker recovery, masked summaries, and no roadside assignability | Protected admin route and full browser-visible audit UI | `e2e-admin-demo-assignment-escalation-guard`, `e2e-admin-assign-unassigned-job`, `e2e-admin-reassign-at-risk-job`, `e2e-admin-resolve-blocker-and-audit-closeout` | assignment uses matching candidates; manual actions audited; queue data masked; terminal/unknown/no-op/roadside assignment fails closed |
| AJ-002 | P1/P2 | RBAC/privacy/payment docs and readiness tests; no support/payment UI | support ticket UI, refund/dispute E2E, live payment/refund contract tests | `e2e-support-open-ticket-from-booking`, `e2e-admin-refund-with-reason-stub` | refund requires permission/reason; support least-privilege projection; payment/report/dispute states separate |
| SJ-001 | P2 | Conceptual fulfillment support only | shop/dealership route, capacity model, role projection, browser E2E | `e2e-shop-accept-service-lane-booking`, `e2e-shop-decline-with-reason` | shop capacity controls bookability; partner-scoped jobs only; warranty/OEM notes are not live-data claims before integration |

## Privacy/security negative test checklist

Every relevant milestone should add or preserve tests for:
- `localStorage` does not contain full VIN, full address, payment secrets, raw messages, phone/email, gate codes, or exact service address fragments outside allowed masked summaries.
- Confirmation state never restores as confirmed.
- Persisted provider/time is normalized against current service, fulfillment, market, vehicle/parts requirements, availability, and travel cap.
- Unknown roles cannot read or write customer/provider/admin/support data.
- Customer projection cannot read another customer's booking.
- Provider projection cannot read unassigned customer details.
- Admin/support projections redact raw VIN/address/payment/message data.
- Logs/analytics/audit metadata recursively drop sensitive fields.
- Estimate projections cannot leak margin, provider payout, internal fees, or payment containers.
- Deferred payment/message/notification writes fail closed.
- Roadside/tow partner handoff never creates normal ReGo jobs, dispatch records, assignments, provider actions, or dispatch statuses.
- Provider/admin/demo surfaces are not top-level customer tabs.
- Unknown provider, blank provider market, unsupported market/service, and missing eligibility context fail closed.

## Data-contract and mock API strategy

Until a backend exists, contracts should be expressed as pure functions/static fixtures plus docs. When APIs are added, introduce contract tests before browser flows depend on them.

Contracts to define/test before live integration:
- vehicle identity and VIN decode summary contract
- service catalog and required parts/fitment contract
- provider profile/capability/availability/market/service-area contract
- booking draft and booking persistence contract
- job lifecycle contract
- dispatch queue and assignment contract
- message thread/event contract
- payment authorization/capture/refund/payout contract
- partner roadside handoff contract
- audit log contract

Mock policy:
- CI must never call live payment, messaging, maps, VIN, parts, partner-dispatch, or notification APIs.
- Use deterministic fixture data and test-provider states.
- Tests should assert integration-disabled behavior until the relevant Linear issue activates the integration.

## Accessibility requirements

Initial browser accessibility checks:
- keyboard-only service selection and scheduling flow
- visible focus state
- selected card state conveyed semantically, not only by color
- modal open/close focus management
- all inputs have labels or accessible names
- buttons have descriptive names
- no critical axe violations on smoke flows
- reduced-motion/focus readability preserved for critical UI states

Accessibility should be part of app-ready, not a post-launch cleanup.

## Visual regression and UX north-star requirements

Create.xyz/Uber-inspired customer UX should be protected by visual/manual gates:
- landing page/service tile order and content match approved screenshot-derived UX constants
- Car Tow remains visually present
- customer surface remains simple and non-technical
- provider/admin/dispatch controls do not become top-level customer navigation
- Schedule Now and service-location modal remain direct and trustworthy
- mobile viewport smoke should be included once Playwright exists
- screenshot baselines should be updated only with intentional UX decisions and reviewed against the north-star references in `Screenshots/`

## Manual localhost review protocol

Run this before app-ready demos and after major UX changes:
1. Start local app with `npm run dev` if localhost is not already healthy.
2. Open `http://localhost:3000`.
3. Walk CJ-001 customer booking smoke on desktop and mobile viewport.
4. Walk CJ-002 Car Tow partner-handoff path.
5. Inspect provider/admin demo sections only after confirming customer nav remains clean.
6. Compare customer shell against `Screenshots/` north-star references.
7. Check browser console for runtime errors.
8. Verify no obviously sensitive draft data in localStorage.
9. Record findings in Linear before marking UX/app-ready milestones Done.

## Release gates

PR gate:
- `git diff --check` passes.
- `npm ci` succeeds when dependencies are refreshed.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.
- Feature docs updated for touched behavior.
- Journey IDs and acceptance criteria updated when behavior changes.
- New/changed business rules have unit tests.
- `npm run test:e2e` passes in Chromium, including desktop/mobile visual baselines.
- No new critical accessibility issue on touched flow once a11y tooling exists.

Main/staging gate:
- PR gate passes.
- GitHub Actions CI green.
- Browser smoke and visual suite passes in GitHub Actions.
- No P0/P1 defects open for touched journeys.
- No runtime console errors in smoke flow.
- Visual review completed for create.xyz customer shell changes.
- Linear issue has verification comment and CI URL before Done.

Production-readiness gate:
- Deployment loads in production-like environment.
- Customer booking smoke passes against production-like configuration.
- Auth/RBAC route boundaries pass once auth exists.
- Payment, messaging, notification, provider dispatch, and partner integrations each have explicit production readiness checks before activation.
- Error monitoring, audit logging, and rollback plan exist once backend/integrations exist.
- Secrets are configured outside client bundle and never appear in logs/test output.

App-ready milestone gate:
- P0 journeys CJ-001 and CJ-002 pass browser smoke in current supported environment.
- Provider and admin MVP operational paths have at least demo/protected-route smoke coverage appropriate to their implementation status.
- Customer can complete a realistic mocked booking and understand what is stubbed.
- Mechanic/provider can progress a realistic job to completion in the implemented surface.
- Admin/dispatcher can inspect/assign/escalate/close a realistic job in the implemented surface.
- Payment and messaging are either implemented and tested, or clearly disabled/stubbed with no misleading production behavior.
- Privacy localStorage/log/projection negative tests pass.
- GitHub CI is green and Linear control plane is current.

## Feature doc testing requirements

Each feature doc must include:
- Canonical journey IDs impacted.
- Given/When/Then acceptance criteria.
- Business rules and state-machine checkpoints.
- Data/API contract or fixture contract.
- Unit test cases for business rules.
- Component/UI-state test cases where applicable.
- Browser E2E or smoke test expectations.
- Accessibility expectations.
- Error/empty/loading/no-match states.
- Security/privacy tests when data is role-scoped or sensitive.
- Deferred integration boundaries and mock policy.
- Release gate impact.

## Recommended next test milestones

1. Playwright foundation and current MVP smoke tests. Completed by JS-888.
   - Chromium config, stable selectors, CJ-001/CJ-002/provider/dispatch smoke, privacy checks, and desktop/mobile visual baselines are present.
   - CI installs Chromium and runs `npm run test:e2e`; failure reports are retained as artifacts.

2. Accessibility smoke gate.
   - Add `@axe-core/playwright`.
   - Run axe critical checks on landing, booking modal, Car Tow handoff, provider demo, admin demo.

3. Role route test upgrade.
   - After auth/routes exist, replace demo-surface smoke with protected customer/provider/admin/support route smoke.

4. Payment/messaging contract tests.
   - Before live integrations, define mocked provider contracts and negative tests for disabled states.

5. App-ready certification suite.
   - Combine P0/P1 browser smoke, privacy negative checks, localStorage inspection, visual smoke, and CI gates into a single release checklist.

## Deferred integration test policy

While integrations are deferred:
- Tests should assert inert/stubbed behavior, not fake production behavior.
- Payment tests should use test-provider/mock states only and must not store/log card, token, bank, processor secret, or payment metadata.
- Messaging tests should assert feature-flagged or booking-scoped stub behavior and PII-safe display.
- Notification tests should assert no live SMS/email/push provider call.
- Auth/RBAC tests should assert fail-closed projections and future route boundaries without claiming production auth is live.
- Partner roadside tests should assert handoff boundaries without calling live partner dispatch.

## Open testing gaps to track

- Protected role-specific routes and live integration E2E remain deferred; current provider/dispatch coverage intentionally uses the internal demo surface.
- Accessibility automation is not installed yet.
- True role-specific customer/provider/admin/support routes are not implemented yet.
- Payment, messaging, notifications, live auth/RBAC, live dispatch, and production persistence are not implemented yet.
- Service report, invoice, service history, support ticket, dispute/refund, and payout closeout UI are only partly represented or deferred.

These gaps are expected at JS-787 closeout. They should become the roadmap for the next implementation milestones toward an app ready to use.
