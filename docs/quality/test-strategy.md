# ReGo Mobile Mechanic Test Strategy

## Stack

Recommended immediate stack:
- Vitest for unit tests.
- React Testing Library and user-event for component tests.
- Playwright for browser/e2e tests.
- axe-core / @axe-core/playwright for accessibility.
- Playwright screenshots for visual regression.

## Test taxonomy

Unit:
- pricing calculations
- currency formatting
- booking draft guards
- state-machine transitions
- provider eligibility
- vehicle/VIN/mileage validation

Component:
- service card selection
- fulfillment selection
- oil preference visibility
- provider card selection
- booking summary updates
- vehicle form updates
- history list/detail states

E2E:
- customer oil-change booking
- diagnostic booking with no oil step
- vehicle edit then booking
- service history view
- provider accepts/completes job once provider UI exists
- dispatcher reassigns/escalates job once admin UI exists

Accessibility:
- keyboard-only booking flow
- labeled inputs
- selected card state is semantic, not color-only
- no critical axe violations
- focus visible and ordered

Security/privacy:
- customer only sees own vehicles/bookings
- provider only sees assigned or offered jobs
- admin-only routes are protected
- VIN/address/payment data not leaked to logs or analytics

## Journey matrix

Critical P0 journeys:
1. Customer books oil change, mobile mechanic, recommended oil, TBD parts.
2. Customer books oil change with known oil price and sees exact total.
3. Customer books diagnostic and oil step is hidden.
4. Customer switches fulfillment and fees update.
5. Customer switches provider and appointment time updates.
6. Customer edits vehicle/address and summary updates.
7. Customer views service history.
8. Booking confirmation rejects incomplete draft.
9. Provider accepts job and submits report.
10. Dispatcher sees unassigned/at-risk jobs.

## Release gates

PR gate:
- npm ci succeeds.
- npm run lint passes.
- npm test passes.
- npm run build passes.
- Playwright smoke passes in Chromium.
- No critical accessibility violations on touched flows.
- Feature docs updated for touched behavior.

Main/staging gate:
- Full unit/component suite passes.
- Playwright passes on Chromium, Firefox, WebKit.
- Visual changes reviewed.
- Lighthouse accessibility >= 95.
- No P0/P1 defects.

Production gate:
- Deployed app loads.
- Customer booking smoke passes.
- No console/runtime errors in smoke flow.
- Error monitoring and rollback plan ready once backend exists.

## Feature doc testing requirements

Each feature doc must include:
- Given/When/Then acceptance criteria.
- Unit test cases for business rules.
- Component test cases for UI states.
- E2E tests for user journeys.
- Accessibility expectations.
- Error/empty/loading states.
- Security/privacy tests when data is role-scoped.
- Release gate impact.
