# Feature: Estimate and Pricing

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
System calculates and displays transparent booking estimate.

## Status
Designed. Current prototype may only implement part of this feature.

## Roles
Customer/Provider/Admin/System

## Goals
- Make this capability explicit, testable, and buildable.
- Support customer/provider/admin workflows without hidden assumptions.
- Keep business rules in documented source of truth before implementation.

## Non-goals
- Do not add unrelated capabilities outside this feature boundary.
- Do not assume backend/auth/payments exist unless this document names the required contract.

## Entry points
labor, parts, fulfillment fee, platform fee, tax/discounts later, TBD rules

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
- Pricing is deterministic, tested, auditable, and explains TBD/changed estimates.
- MVP estimates use static/curated service pricing bands plus provider confirmation for uncertain oil, parts fitment, labor, or field-condition inputs.
- Exact oil viscosity/capacity/filter, battery group/CCA, and brake part fitment must not be treated as automatically known from VIN/year/make/model alone.
- Quote types are `fixed`, `range`, and `tbd_provider_confirmed`.
- Provider confirmation is required before final quote/service when `requiresFluidSpec` or `requiresPartsFitment` is true and no high-confidence curated source exists.
- Commercial oil/maintenance/parts/labor APIs are deferred to P1/P2 unless explicitly licensed.
- See `../../research/automotive-data-sources.md` for source policy.

## Data model
Estimate inputs should include:

- `serviceId`
- `vehicleId`
- `fulfillmentMode`
- `marketId`
- `providerId`
- `pricingVersion`
- `quoteType`: `fixed`, `range`, or `tbd_provider_confirmed`
- `requiresFluidSpec`
- `requiresPartsFitment`
- `providerConfirmationRequired`
- `lineItems`: labor, parts, travel/mobile fee, platform fee, taxes/discounts later
- `sources`: source name/type/url/version/confidence/verifiedAt
- audit timestamps

See `../../architecture/state-machines.md` where lifecycle state is involved.

## State machine
If this feature changes booking/job/payment/report state, use the canonical states in `../../architecture/state-machines.md` and document any feature-specific guards.

## API contract
MVP estimate calculation can begin as a pure library function. When wrapped by an API, document:

- `POST /api/estimates/preview`
- Request: service, vehicle, fulfillment, market, provider, selected options.
- Response: line items, total/range/TBD state, source/confidence metadata, provider-confirmation requirements, and customer-facing explanation copy.
- Errors: unsupported service, unsupported vehicle, missing fulfillment/provider, stale pricing table.
- Idempotency: preview has no side effects; booking/authorization endpoints need idempotency keys later.

External oil/parts/labor APIs are not P0 dependencies. Tests must use deterministic fixtures/mocks.

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
- Customer estimate projections may include only customer-facing status, totals, fees, discounts, taxes, and currency.
- Provider estimate projections must use a provider-safe whitelist: customer-facing total/status/currency plus providerEarnings/providerPayout/payoutStatus when needed for the assigned job. Providers must not receive platform margin, internalFees, payment intent IDs/client secrets, or raw payment containers.
- Admin/system operational projections may include internal economics for audit/ops, but payment secrets remain scrubbed.

## Acceptance criteria
- Given valid prerequisites, when the actor completes the primary flow, then the expected state is created or updated.
- Given invalid/missing prerequisites, when the actor tries to proceed, then the app blocks and explains why.
- Given stale or conflicting data, when the actor submits, then the app prevents unsafe writes and offers recovery.
- Given unauthorized access, when actor opens or calls the feature, then access is denied.
- Given a supported fixed-price service, when inputs are complete, then the estimate returns deterministic line items and source metadata.
- Given oil/parts fitment is uncertain, when calculating an estimate, then quote type is `tbd_provider_confirmed` or a range and the UI explains provider confirmation.
- Given pricing rules change after quote creation, when viewing the historical quote, then original quote inputs/version remain explainable.

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
- Quote source/version auditability without exposing unnecessary VIN/customer data.
- Provider estimate projection tests must assert platform margin, internalFees, payment intent IDs/client secrets, and raw payment containers are absent while allowed provider earnings/payout summary remains available.

External data:
- Mock oil/parts/labor sources if/when added.
- Confirm CI does not call live commercial or NHTSA APIs.

## Dependencies
- `../../research/automotive-data-sources.md`
- curated service catalog and pricing bands
- provider-confirmed data workflow for oil/parts/labor uncertainty

## Open questions
- What parts of this feature are required for MVP vs later?
- What backend/integration decisions block production readiness?
- What operational policy affects edge cases?
