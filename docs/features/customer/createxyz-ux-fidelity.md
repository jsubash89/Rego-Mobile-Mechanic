# Feature: create.xyz Customer UX Fidelity

## Summary
JS-837 tightens the customer-facing prototype toward the original create.xyz screenshots while preserving ReGo's pricing, matching, booking state, privacy, auth/RBAC readiness, provider, dispatch, and partner-handoff engines underneath.

## UX source of truth
Reference screenshots live in `Screenshots/`.

Implemented fidelity points:
- Homepage keeps the black top nav, REG O / Mobile Mechanic brand treatment, customer nav links, two-line hero headline, six service tiles, service-location field, black Schedule Now CTA, and right-side mechanic photo card proportions.
- The hero photo card uses the deterministic local asset `public/images/createxyz-hero-mechanic-card.png`, cropped from `Screenshots/Screenshot 2025-01-29 145902.png`; no network image dependency is introduced.
- Vehicle modal keeps the create.xyz title and Make & Model / VIN tabs with year, make, model, trim, engine, and transmission fields.
- Scheduling modal uses the three screenshot labels: Specific Date and Time, Flexible Days and Time, Earliest Available.
- Location modal keeps Change Address, Home/Work/Other/Garage/Driveway/Parking Lot choices, Location Notes, and a 1000-character hint.
- Service Details modal keeps a black header, vehicle/service summary, Change Service affordance, price breakdown, add-ons, selected add-ons, totals, and a black Continue to location action.

## Preserved product boundaries
- Provider and dispatch demos remain off the top-level customer nav behind internal demo access.
- The top-nav `Mechanic Sign Up` label is preserved from the create.xyz screenshot, but it routes to provider-interest copy instead of provider/dispatch demo controls.
- Car Tow remains visible because the create.xyz homepage shows it, but it is `partnerOnly` in `src/data/createxyz-ux.js` and routes to the roadside partner handoff instead of normal ReGo booking, provider assignment, or dispatch job creation.
- No live auth, payment, messaging, image, or roadside integrations were added.
- Local booking drafts continue to minimize sensitive data: no full VIN, no full address, no persisted confirmed state, and restored provider/appointment data normalizes through current eligibility.

## Acceptance criteria
- Customer can see the screenshot-derived homepage service tile order and hero photo-card treatment.
- Customer nav preserves create.xyz labels without linking directly into internal provider/dispatch demos.
- Scheduling and location modal labels match the reference screenshot copy.
- Car Tow cannot become a normal ReGo engine service from the customer hero.
- Privacy constraints continue passing unit tests for local draft persistence.
- Existing engines continue passing unit tests, lint, and build.

## Tests
Automated:
- `src/data/createxyz-ux.test.mjs` verifies hero service order, partner-only Car Tow, schedule labels, location labels, and local hero asset path.
- `src/lib/local-storage.test.mjs` continues to cover VIN/address minimization, no confirmed restore, and eligibility normalization.

Manual smoke:
- Open `/` and compare hero, vehicle, scheduling, service details, location, and Car Tow handoff against the reference screenshots.

## Known fidelity boundaries
- The hero image is a local crop from the provided homepage screenshot rather than a separately sourced original photography file.
- Icons remain deterministic text glyphs instead of exact original icon artwork.
- Date/time picking remains a simple modal option selection; no live calendar/payment/auth/messaging integration is present in this milestone.
