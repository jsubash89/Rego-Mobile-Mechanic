# Partner-routed emergency roadside handoff

Last updated: 2026-07-01
Issue: JS-833

## MVP boundary

Emergency roadside is partner-driven only. ReGo Mobile Mechanic must not directly operate towing, lockout, fuel delivery, emergency flat-tire response, emergency battery dispatch, or emergency response.

Any urgent-now/roadside path must route to a partner handoff layer and must not create a normal ReGo booking, provider job, dispatch job, provider assignment, or dispatch status.

## In scope for static MVP

- Customer-facing roadside tab and urgent-roadside entry point from the booking flow.
- Static triage intents:
  - Tow / disabled vehicle.
  - Lockout.
  - Fuel delivery.
  - Jump / battery emergency.
  - Flat tire emergency.
  - Unsafe location.
  - Non-emergency diagnostic or maintenance as normal ReGo-eligible examples.
- Static partner data with placeholder phone/app/url/support channels, market coverage, service types, availability, SLA estimates, and operator disclosure.
- Pure helper that decides route, filters partner candidates, creates a minimal handoff audit/support placeholder, and explicitly returns no dispatch job/provider assignment.
- Tests proving emergency categories route only to partner handoff and non-emergency categories can continue to ReGo booking.

## Out of scope / deferred

- Backend partner APIs.
- Authenticated handoff events.
- Payments, memberships, insurance verification, or roadside contracts.
- Live ETA, live dispatch, tow-truck tracking, or partner acceptance.
- Storing full address, phone, VIN, exact GPS coordinates, or payment data.

## UX behavior

1. Customer selects an intent and market.
2. If the intent is one of the emergency roadside categories, the UI displays:
   - ReGo does not operate the service directly.
   - Partner-routed-only disclosure.
   - Matching third-party partner cards when static coverage exists.
   - Safety/fallback copy when no static partner is configured.
   - Audit/support placeholder showing route, market, candidate IDs, and `piiStored: false`.
3. If the intent is non-emergency and the vehicle is parked safely, the UI guides the customer back to the normal ReGo booking flow.
4. Emergency handoff never mutates customer booking, provider workbench, or dispatcher queue state.

## Data and privacy

Static data lives in `src/data/roadside-partners.js` and contains only partner/service/market metadata. It must not include customer full address, phone, VIN, payment data, or exact location.

The helper audit placeholder contains only:

- Handoff event ID.
- Market.
- Service type.
- Partner candidate IDs.
- Timestamp.
- `piiStored: false`.
- Note that no ReGo dispatch job/status/provider assignment was created.

The customer UI does not save roadside selections to localStorage.

## Implementation files

- `src/data/roadside-partners.js` — static partner and triage intent data.
- `src/lib/roadside-handoff.js` — pure routing/filter/audit helper.
- `src/lib/roadside-handoff.test.mjs` — helper coverage for product boundary.
- `src/app/page.jsx` — roadside tab and booking-flow urgent handoff entry point.

## Acceptance criteria

- Emergency roadside categories always return `route: "partner_handoff"` and `bookingAllowed: false`.
- Emergency handoff result contains operator disclosure that ReGo is not the roadside operator.
- Emergency handoff result contains `dispatchJob: null` and `providerAssignment: null` and no dispatch-like status/provider fields.
- Partner candidates respect market, service type, and availability where static data exists. The `national_fallback` market is a deliberate demo/fallback selection only; it must not act as wildcard coverage for unsupported markets such as Boise.
- Unavailable market/service returns safe fallback/support copy, not dispatch.
- Non-emergency categories can continue to the normal ReGo booking path.
- No full address/VIN/phone is stored in localStorage or partner handoff data.
