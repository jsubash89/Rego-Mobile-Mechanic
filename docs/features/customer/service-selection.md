# Feature: Service Selection

## Document contract
This feature doc is intended to be buildable: an engineer should be able to implement the feature by following the sections below, and QA should be able to test it without guessing. Keep every product decision here or linked from here.

Sections:
- Summary
- Roles
- Goals / non-goals
- Entry points
- Primary flow
- Alternate flows
- Edge cases
- Business rules
- Data model
- State machine
- API contract
- UI requirements
- Accessibility
- Analytics
- Security/privacy
- Acceptance criteria
- Test plan
- Dependencies
- Open questions


## Summary
Customer chooses the service catalog item to book.

## Status
Designed. Current prototype may only implement part of this feature.

## Roles
Customer/Admin

## Goals
- Make this capability explicit, testable, and buildable.
- Support customer/provider/admin workflows without hidden assumptions.
- Keep business rules in documented source of truth before implementation.

## Non-goals
- Do not add unrelated capabilities outside this feature boundary.
- Do not assume backend/auth/payments exist unless this document names the required contract.

## Entry points
oil change, diagnostic, brake service, pre-purchase inspection

## Primary flow
1. Actor enters from the relevant app route or system event.
2. App loads required data and validates permissions.
3. Actor completes the feature-specific task.
4. App persists or derives the updated state.
5. App updates downstream summaries, timelines, notifications, or records.

## Alternate flows
- Missing required data.
- User changes upstream selection.
- Data becomes stale before save/confirm.
- Network/API failure.
- Unauthorized role attempts access.

## Edge cases and errors
- Incomplete or invalid inputs.
- Stale availability/estimate/status.
- Duplicate submission.
- User abandons and resumes.
- Role-specific permission denial.
- External integration failure once integrations exist.

## Business rules
Exactly one service is active; service defines required inputs, fulfillment eligibility, duration, and base labor.

## Data model
Define or reference entities used by this feature. Minimum fields should include stable IDs, actor IDs, timestamps, status, and audit metadata. See `../../architecture/state-machines.md` where lifecycle state is involved.

## State machine
If this feature changes booking/job/payment/report state, use the canonical states in `../../architecture/state-machines.md` and document any feature-specific guards.

## API contract
Document endpoints before implementation. Include request shape, response shape, errors, auth, idempotency, and side effects.

## UI requirements
- Desktop, tablet, and mobile states.
- Loading, empty, error, disabled, and success states.
- Stable selectors for automated tests.
- Clear copy for pricing/status/permission errors.

## Accessibility
- Keyboard reachable and operable.
- Focus visible.
- Inputs have labels.
- Selected/error states are semantic, not color-only.
- No critical axe violations.

## Analytics
Define event names, triggers, required properties, and forbidden PII before instrumenting.

## Security/privacy
- Enforce role permissions server-side.
- Mask sensitive vehicle/customer/payment data where not needed.
- Do not log VIN, address, payment, or private messages into analytics/errors.

## Acceptance criteria
- Given valid prerequisites, when the actor completes the primary flow, then the expected state is created or updated.
- Given invalid/missing prerequisites, when the actor tries to proceed, then the app blocks and explains why.
- Given stale or conflicting data, when the actor submits, then the app prevents unsafe writes and offers recovery.
- Given unauthorized access, when actor opens or calls the feature, then access is denied.

## Test plan
Unit:
- Business rules and derived calculations.
- Validation and state guards.

Component:
- Initial render, interactions, conditional UI, loading/empty/error states.

E2E:
- Happy path.
- Main alternate path.
- Mobile viewport.
- Keyboard-only path.

Accessibility:
- axe scan and keyboard path.

Security/privacy:
- Role-scoped data access and sensitive-data masking.

## Dependencies
List upstream feature/data/API dependencies here before implementation.

## Open questions
- What parts of this feature are required for MVP vs later?
- What backend/integration decisions block production readiness?
- What operational policy affects edge cases?
