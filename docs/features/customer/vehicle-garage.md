# Feature: Vehicle Garage

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
Customer creates, edits, selects, and reviews vehicles and service addresses.

## Status
Designed. Current prototype may only implement part of this feature.

## Roles
Customer

## Goals
- Make this capability explicit, testable, and buildable.
- Support customer/provider/admin workflows without hidden assumptions.
- Keep business rules in documented source of truth before implementation.

## Non-goals
- Do not add unrelated capabilities outside this feature boundary.
- Do not assume backend/auth/payments exist unless this document names the required contract.

## Entry points
vehicle CRUD, VIN/mileage validation, default vehicle, address

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
- VIN is validated/masked; mileage/year are validated; edits update booking summary and persist.
- MVP vehicle identity uses NHTSA vPIC as the preferred open/free VIN decode and normalization source. See `../../research/automotive-data-sources.md`.
- VIN decode failure must not block booking; customer can enter year/make/model/mileage manually.
- vPIC trim/engine fields are useful hints but are not sufficient by themselves for automated oil/parts fitment.
- Recall checks, when present, are informational and non-blocking; warranty/recall work should route the customer toward dealership/OEM confirmation.
- Store source/confidence metadata for decoded or corrected vehicle data.
- Mask full VIN in UI/admin/logs except where full VIN is operationally required.

## Data model
Minimum vehicle fields:

- `id`
- `vin` / `vinLast4`
- `year`
- `make`
- `model`
- `trim`
- `engine`
- `fuelType`
- `driveType`
- `bodyClass`
- `mileage`
- `source`: `manual`, `nhtsa_vpic`, `curated`, or `provider_corrected`
- `decodeConfidence`: `high`, `medium`, `low`, or `unknown`
- `decodedAt`
- audit timestamps

See `../../research/automotive-data-sources.md` for the vehicle identity source policy and `../../architecture/state-machines.md` where lifecycle state is involved.

## State machine
If this feature changes booking/job/payment/report state, use the canonical states in `../../architecture/state-machines.md` and document any feature-specific guards.

## API contract
MVP can begin with local/static data and mocked external calls. When implemented, VIN decode should be represented by an internal boundary such as:

- `POST /api/vehicles/decode-vin`
- Request: `{ vin: string, modelYear?: number }`
- Response: normalized vehicle fields plus `source`, `decodeConfidence`, and raw-source metadata needed for audit/debug.
- External source: NHTSA `DecodeVinValuesExtended` with `format=json`.
- Errors: invalid VIN, unavailable source, ambiguous decode.
- Side effects: none unless explicitly saving the decoded vehicle.

Tests must mock NHTSA responses; CI must not depend on live NHTSA uptime.

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
- Treat VIN plus customer identity/location/service history as sensitive data.
- Store and display `vinLast4` where possible; require explicit operational need for full VIN display.

## Acceptance criteria
- Given valid prerequisites, when the actor completes the primary flow, then the expected state is created or updated.
- Given invalid/missing prerequisites, when the actor tries to proceed, then the app blocks and explains why.
- Given stale or conflicting data, when the actor submits, then the app prevents unsafe writes and offers recovery.
- Given unauthorized access, when actor opens or calls the feature, then access is denied.
- Given a valid VIN and available decode source, when the user decodes it, then the app stores normalized vehicle fields with source/confidence metadata.
- Given VIN decode fails or is ambiguous, when the user continues, then the app offers manual entry and marks confidence accordingly.
- Given recall data is unavailable, when the user books service, then booking can continue with a non-blocking recall-unavailable message.

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
- VIN masking and no raw VIN in logs/analytics.

External data:
- Mock valid, invalid, ambiguous, and unavailable vPIC responses.
- Do not call live NHTSA in CI.

## Dependencies
- `../../research/automotive-data-sources.md`
- NHTSA vPIC for optional live VIN decode.
- Curated seed vehicle data and manual fallback for MVP.

## Open questions
- What parts of this feature are required for MVP vs later?
- What backend/integration decisions block production readiness?
- What operational policy affects edge cases?
