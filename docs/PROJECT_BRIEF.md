# Mobile Mechanic Marketplace — Project Brief

## Correction

The product direction is Mobile Mechanic. The create.xyz export in Downloads was rough inspiration and was broken, but it was not meant to become AssistMe. A previous pass mistakenly reframed the app as AssistMe; that has been corrected locally.

## Source material inspected

- Local create.xyz export: `/Users/johnnysubash/Downloads/createxyz-project`
- Working copy: `/Users/johnnysubash/Documents/createxyz-mobile-mechanic`

## What the imported code was

The original export was a single-page Next.js mockup for a mobile mechanic booking app. It contained useful product hints:

- Services: oil change, inspection, tune-up, error/check-engine diagnostics.
- Vehicle profile flow.
- Oil preference flow.
- Mobile mechanic vs independent shop vs dealership fulfillment.
- Provider selection.
- Appointment and checkout states.
- Service history.

It was not production-ready:

- `useState` was referenced without being imported.
- `autoShops` was referenced but not defined.
- Multiple modal states were declared without complete flow handling.
- The create.xyz middleware rewrote integration routes back to create.xyz.
- `runtime-helpers.js` exported an undefined symbol.
- The original Next.js version had security audit findings.

## Current implemented baseline

The app is now a working Mobile Mechanic marketplace prototype:

- Service selection for oil changes, diagnostics, brakes, and pre-purchase inspections.
- Fulfillment options: mobile mechanic, independent shop, dealership.
- Oil preference selection for oil changes.
- Provider comparison with ratings, distance, specialties, and earliest availability.
- Booking summary with vehicle, location, provider, time, fulfillment type, and estimate.
- Editable vehicle profile / garage tab.
- Service history tab.
- Updated package name and metadata.
- Removed generated create.xyz middleware.
- Fixed undefined helper export.

## Verification already run

- `npm install --package-lock-only`
- `npm run build`

Latest build result: passing on Next.js 16.2.9.

Known caveat: `npm audit` still reports moderate Next/PostCSS advisories. npm’s suggested fix path is breaking and inconsistent, so this is documented as dependency-monitoring until a clean patched Next line is available.

## Product thesis

Mobile Mechanic should become a marketplace/operating layer for vehicle service:

1. Customer enters or selects a vehicle.
2. App recommends services and parts based on vehicle context.
3. Customer chooses fulfillment: mobile mechanic, shop, or dealership.
4. Customer compares trusted providers by price, distance, rating, specialty, and availability.
5. Customer books an appointment with a transparent estimate.
6. Provider confirms parts/arrival and performs the service.
7. Service report, photos, invoice, warranty, and reminders persist to the vehicle history.

## Next direction

Build from prototype to product in this order:

1. Extract service/provider/vehicle data into modules.
2. Add tests for pricing and booking-state calculations.
3. Add a proper booking state machine.
4. Add provider and customer views.
5. Add persisted local storage or a lightweight database.
6. Add auth and real backend only after the flow is stable.
7. Add payments, messaging, provider onboarding, and dispatch logic.
