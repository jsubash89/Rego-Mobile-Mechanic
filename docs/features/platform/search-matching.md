# Feature: Search and Matching

## Summary
Search and Matching is the local deterministic provider-matching engine for ReGo's customer booking and internal dispatch demos. It turns a selected service, fulfillment mode, coarse market/location proxy, provider capability data, travel coverage, availability, and trust/parts-confirmation signals into:

- eligible provider matches sorted in a stable order;
- ineligible providers with customer/ops-readable exclusion reasons;
- a safe selected-provider fallback/clear result when upstream booking inputs change.

The current implementation is mock/local only. It preserves the simple create.xyz-inspired customer shell while keeping newer provider, dispatch, privacy, and roadside boundaries underneath.

## Status
Implemented as a local JavaScript matching helper and exercised by unit tests. No live search, maps, provider network API, auth, payment, messaging, notification, or partner dispatch integration exists in this milestone.

## Roles
- Customer: chooses a service/fulfillment path and receives a compatible provider/time when available.
- System: evaluates provider eligibility, ranks deterministic matches, and clears stale selections.
- Dispatcher demo: reuses matching for local assignment candidates and manual assignment guards.

## Goals
- Match only providers that can perform the selected service and fulfillment mode.
- Respect a coarse market/location proxy and mobile service travel limits without storing a full address.
- Exclude unavailable providers and explain why no provider can be selected.
- Prefer providers with earlier availability, closer travel distance, stronger ratings, specialty alignment, and trust/compliance signals.
- Require parts/fitment confirmation capability for provider-confirmed work such as oil/fluid/fitment-sensitive services.
- Keep selected provider and appointment time safe when service, fulfillment, provider data, or restored draft state changes.
- Keep emergency roadside/tow/lockout/fuel/emergency battery/emergency tire flows partner-routed only.

## Non-goals / deferred integrations
- No live Google/Apple maps, geocoding, route distance, or location search integration.
- No live provider marketplace/search API.
- No live auth, payment capture, messaging, notifications, VIN decode/recall, parts catalog, commercial automotive fitment, or partner dispatch integration.
- No normal booking, ReGo dispatch job, or provider assignment for emergency roadside paths.
- No redesign of the create.xyz-inspired customer shell.
- No persistence of full VIN or full street address in localStorage.

## Entry points
- Customer shell provider derivation: `src/app/page.jsx` calls `deriveProviderSelection` and `getProviderMatchingResults`.
- Dispatch demo assignment candidates: `src/lib/dispatch-operations.js` calls `getProviderMatchingResults` and consumes the returned `matches` order directly.
- Draft restore: `src/lib/local-storage.js` normalizes saved service/fulfillment/provider/time through `deriveProviderSelection`.
- Unit tests: `src/lib/provider-matching.test.mjs`, `src/lib/dispatch-operations.test.mjs`, `src/lib/local-storage.test.mjs`, and `src/lib/booking-state.test.mjs` cover the critical guards.

## Inputs
The matching request may include:

- `service` or `serviceId`: stable service id plus optional metadata such as `requiresFluidSpec`, `requiresPartsFitment`, `providerConfirmationRequired`, and `quoteType`.
- `fulfillment` or `fulfillmentId`: currently mobile, shop, or dealer-style fulfillment identifiers from local data.
- Market/location proxy: a coarse `market` string or equivalent `locationProxy.market`. Matching chooses the first non-empty text market from `market`, `locationProxy.market`, then `location.market`; blank or whitespace-only values fall through to the next source. Matching trims and lowercases market values for comparison, so case/whitespace variants such as `Chicago`, ` chicago `, and `chicago` are equivalent. The app must not require or persist a full address for matching; local demos default to the seeded Chicago market.
- Provider capability data:
  - `serviceIds` supported by the provider;
  - `fulfillmentModes` supported by the provider;
  - `specialtyServiceIds` / `specialties` for ranking boosts;
  - `providerConfirmedParts` or `compliance.providerConfirmedParts` for provider-confirmed parts/fitment work.
- Provider travel distance / coverage:
  - request-level `providerDistances[providerId]` when the system has a safe distance proxy;
  - provider-level `distance` for seeded local demos;
  - `serviceArea.maxTravelMiles` / `maxTravelMiles` travel cap;
  - explicit coverage flags such as `providerCoverage[providerId]`, `serviceArea.coversRequest`, or `coversServiceLocation` when distance is unavailable but coverage is known.
- Availability:
  - `availability.available` must not be false;
  - `availability.earliestSlot` or `earliest` must exist;
  - `availability.rank` is used to score and tie-break earlier slots.
- Rating/trust/compliance:
  - `rating`, `certifications`, `compliance.verified`, `compliance.insured`, and `compliance.backgroundChecked` contribute to score.

## Eligibility exclusions
A provider is ineligible when any of these are true:

1. The selected service id is missing or not in `provider.serviceIds`.
2. The selected fulfillment id is missing or not in `provider.fulfillmentModes`.
3. The provider is unavailable or has no earliest bookable slot.
4. For mobile fulfillment, neither a safe distance proxy nor explicit coverage confirmation exists.
5. For mobile fulfillment, known distance exceeds the provider travel cap.
6. A coarse request market exists and the provider's configured market is missing/blank or does not match it after trim/lowercase normalization.
7. The service requires provider-confirmed parts/fitment and the provider cannot confirm parts/fitment.

The result retains all evaluated providers. Eligible providers appear in `matches`; excluded providers appear in `ineligible` with `exclusions`. No-match behavior must clear selected provider and appointment time so confirmation cannot proceed with stale/ineligible data.

## Ranking and tie-breaking
Only eligible providers are ranked. Scoring is deterministic and explainable:

- availability score: `max(0, 120 - availabilityRank * 25)`;
- distance score: `max(0, 60 - distanceMiles * 5)` when distance is known, otherwise `0`;
- rating score: `round(rating * 10)`;
- specialty score: `20` when `specialtyServiceIds` or specialty text matches the service;
- compliance score:
  - verified: `+10`;
  - insured: `+8`;
  - background checked: `+6`;
  - provider-confirmed parts: `+6`;
  - certifications: `+2` each, capped at `+6`.

Tie-breaking after total score:
1. earlier availability rank;
2. shorter distance, unknown distance last;
3. higher rating;
4. lexicographic provider id.

Because the final tie-break is provider id, the same input order is not required for stable output.

Dispatch assignment candidates must use this provider-matching order as the single source of ranking so assignment tie-breaks stay consistent with customer/provider selection.

## Selected provider fallback and clearing
`deriveProviderSelection` is the guard for upstream changes and restored drafts.

- If the current selected provider remains eligible for the current service/fulfillment/location request, keep it and preserve the existing appointment time when one exists.
- If the selected provider is missing or ineligible, choose the top eligible match and set appointment time to that provider's earliest slot.
- If no provider is eligible, clear selected provider and appointment time and return `noEligibleProviders: true`.
- The customer shell must use these derived values for confirmation and local draft saves after service/fulfillment/provider inputs change so confirmation cannot be completed with a stale provider/time pair.
- LocalStorage draft restore must run the same derivation with the current coarse `market` or `locationProxy` and must not restore stale provider/time selections blindly.

## Roadside partner-only boundary
Emergency roadside intents, including tow, lockout, fuel, emergency battery, and emergency tire, are outside normal provider matching. The customer shell may show partner handoff cards, but it must not create a normal ReGo booking, provider assignment, or dispatch job for those paths. Current data marks Car Tow as `partnerOnly`, and roadside handoff tests verify partner routing.

## UI requirements
- Preserve the simple customer shell and avoid provider/admin UI drift in the top-level customer nav.
- When an eligible provider exists, display/derive the compatible provider and earliest time through the existing booking flow.
- When no provider exists, confirmation guidance must block confirmation with a provider/appointment requirement. More explicit customer-facing no-match cards can be added later without changing matching semantics.
- Ineligible reasons should remain concise and safe for customer support or ops display.

## Accessibility
- Provider/no-provider states must be represented in text, not color alone.
- Any future no-match or provider comparison controls must be keyboard reachable and use standard button/list semantics.
- Existing shell controls must retain labels or screen-reader text.

## Analytics
No analytics are implemented in this milestone. Future analytics must not include full VIN, full address, raw free-text location notes, or unmasked customer contact details. Event properties should use service id, fulfillment id, coarse market, match count, selected provider id, and high-level exclusion categories only.

## Security/privacy
- Matching uses seeded/local provider data only.
- Full VIN and full address must not be persisted to localStorage. Draft persistence stores minimized vehicle identity (`vinLast6`/`vinLast4` where available) and omits full address.
- Logs, test fixtures, dispatch/provider demo records, and analytics must use masked VIN/address/contact summaries only.
- The market/location input is a coarse proxy; do not introduce precise geocoding or address storage without a separate privacy review.
- Provider confirmation for parts/fitment happens after request review in this MVP; do not imply live parts fitment or commercial catalog validation.

## Acceptance criteria
- Given a service, fulfillment mode, market proxy, and providers, when matching runs, then only providers satisfying capability, availability, market, travel, and provider-confirmation rules are eligible.
- Given eligible providers, when ranking runs, then results are deterministic and include explainable score components.
- Given a selected provider that remains eligible after upstream changes, when selection is derived, then the provider is kept and the existing valid appointment time is preserved.
- Given a selected provider that becomes ineligible after service/fulfillment/location changes, when selection is derived, then the top eligible fallback provider and earliest time are selected.
- Given no eligible providers, when selection is derived or booking confirmation is attempted, then provider/time are cleared and confirmation is blocked.
- Given provider-confirmed services, when a provider cannot confirm parts/fitment, then that provider is excluded.
- Given mobile fulfillment with missing distance and no explicit coverage, when matching runs, then the provider is excluded.
- Given mobile fulfillment outside travel cap, when matching runs, then the provider is excluded.
- Given shop/dealer fulfillment, when provider distance exceeds a mobile travel cap, then the mobile cap is not used to exclude the provider.
- Given emergency roadside/tow intent, when the customer proceeds, then the app routes to partner handoff only and does not create a normal booking/provider assignment/dispatch job.
- Given localStorage draft save/restore, when a full VIN/address exists in UI state, then only minimized vehicle fields are stored and stale provider/time selections are refreshed.

## Test plan
Unit tests:
- `src/lib/provider-matching.test.mjs`
  - deterministic ranking and score components;
  - service and fulfillment exclusions;
  - market mismatch exclusion;
  - mobile travel cap and unknown-distance exclusions;
  - explicit service-area coverage without distance;
  - provider-confirmed parts/fitment requirement;
  - deterministic provider-id tie-break;
  - selected-provider fallback and no-match clearing;
  - preservation of eligible selected provider/time.
- `src/lib/dispatch-operations.test.mjs`
  - assignment candidates reuse matching exclusions and market rules;
  - wrong-market/ineligible providers cannot be manually assigned.
- `src/lib/local-storage.test.mjs`
  - draft persistence sanitizes VIN/address and normalizes stale provider/time through matching.
- `src/lib/booking-state.test.mjs`
  - confirmation remains blocked without provider/time/required booking fields.
- `src/lib/roadside-handoff.test.mjs` and `src/data/createxyz-ux.test.mjs`
  - emergency roadside/Car Tow remains partner-only.

Build/quality gates for this milestone:
- `git diff --check`
- `npm test`
- `npm run lint`
- `npm run build`

## Dependencies
- Local provider seed data: `src/data/providers.js`.
- Local services/fulfillment seed data: `src/data/services.js`, `src/data/fulfillment.js`.
- Matching helper: `src/lib/provider-matching.js`.
- Draft sanitization: `src/lib/local-storage.js` and `src/lib/vehicle-identity.js`.
- Booking confirmation guards: `src/lib/booking-state.js`.
- Roadside partner handoff: `src/lib/roadside-handoff.js` and `src/data/roadside-partners.js`.

## Open questions / limitations
- Current customer UI does not yet expose a rich provider comparison list or detailed no-match remediation card; it relies on derived selection and confirmation guidance.
- Current distance and market inputs are seeded proxies, not live drive-time or geocoded coverage checks.
- Provider availability is static local data; no real-time calendar hold or revalidation exists.
- Parts/fitment confirmation is a provider capability guard only; there is no live fitment catalog or VIN decode integration.
