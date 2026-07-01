# ReGo Automotive Data Sources and API Strategy

Date: 2026-06-30

Purpose: define what ReGo should use for vehicle identity, year/make/model, VIN decode, recalls, oil specs, maintenance intervals, parts fitment, labor/pricing data, and roadside partner handoff during MVP and later phases.

This document is implementation input for:

- `docs/features/customer/vehicle-garage.md`
- `docs/features/customer/estimate-pricing.md`
- `docs/features/customer/service-selection.md`
- `docs/features/platform/search-matching.md`
- `docs/plans/autonomous-build-loop.md`
- Linear milestone issues JS-825 through JS-833

## Executive decision

For MVP, ReGo should not attempt to become a complete automotive data platform.

Use live/open public data only where it materially improves safety, trust, or user friction:

1. NHTSA vPIC for VIN decode and vehicle identity normalization.
2. NHTSA recall APIs/datasets as a non-blocking recall/safety signal.
3. Static/curated ReGo seed data for services, oil-change assumptions, pricing bands, provider eligibility, and simple vehicle coverage.
4. Provider confirmation before final quote or dispatch whenever oil, parts, labor, or fitment is uncertain.
5. Partner handoff for emergency roadside; no direct ReGo roadside dispatch.

Defer broad oil/parts/maintenance/labor automation until ReGo has volume and can justify licensed/commercial datasets.

## P0 / MVP data policy

### Live API now

#### NHTSA vPIC Vehicle API

Source: https://vpic.nhtsa.dot.gov/api/

Use for:

- VIN decode.
- Partial VIN decode where useful.
- Year, make, model.
- Manufacturer.
- Body class.
- Vehicle type.
- Engine/fuel/drive fields when available.
- Batch decode for admin/import workflows.

Implementation notes from NHTSA docs:

- Output formats include JSON, CSV, and XML.
- `DecodeVinValues` and `DecodeVinValuesExtended` provide flat output.
- NHTSA recommends sending `modelyear` when available.
- vPIC is populated from manufacturer submissions.
- API traffic is subject to automated rate control.
- Standalone vPIC databases are available for download.

MVP rule:

- Use vPIC as canonical free VIN decode/normalization.
- Cache decode results because vehicle attributes are stable.
- Fallback to manual year/make/model when VIN decode fails or user does not know VIN.
- Treat trim/engine output as helpful but not always complete enough for oil/parts automation.

Example endpoint patterns:

```text
https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/{VIN}?format=json&modelyear={YEAR}
https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/{MAKE}/modelyear/{YEAR}?format=json
https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json
```

#### NHTSA Datasets and APIs

Source: https://www.nhtsa.gov/nhtsa-datasets-and-apis

Use for:

- Recalls.
- Safety ratings.
- Complaints/investigations/manufacturer communications later if useful.

Implementation notes:

- NHTSA publishes public datasets/APIs for ratings, recalls, investigations, complaints, manufacturer communications, and more.
- Recall data exists because manufacturers must notify NHTSA of safety defects or noncompliance.

MVP rule:

- Recall checks are informational and non-blocking.
- Do not block booking if recall API is unavailable.
- For potential recall/warranty work, route user toward dealership/OEM guidance.
- Copy must say recall information should be confirmed with manufacturer/dealer.

### Static/curated now

Use ReGo-owned seed data for:

- Supported service catalog.
- Mobile eligibility rules.
- Vehicle selector fallback for common vehicles in launch market.
- Service pricing bands/ranges.
- Labor-time assumptions for scheduling.
- Oil-change supported-vehicle seeds if ReGo wants a better oil-change demo.
- Basic parts categories: oil, filter, battery, brake pads/rotors, wipers.
- Provider eligibility statuses and compliance flags.

MVP pricing language should use:

- fixed estimate when inputs are curated and high confidence
- range estimate when labor/parts vary
- TBD/provider-confirmed where parts, oil, trim/engine, or field condition is uncertain

### Provider-confirmed now

Provider confirmation is required before final quote/service for:

- exact oil viscosity/capacity/filter
- exact battery group/CCA
- brake pad/rotor fitment
- complex diagnostics
- unusual vehicles
- EV/hybrid service scope
- any job where vPIC/seed data confidence is low

Store confirmation metadata:

- confirmed_by
- confirmed_at
- source_type: provider_confirmed, curated, official_manual, user_confirmed, commercial_api
- confidence
- notes
- source_url when applicable

## P1 data sources after MVP validation

### OEM owner manual portals

Use as authoritative linked references, not bulk-copied structured data.

Examples:

- Toyota manuals: https://www.toyota.com/owners/warranty-owners-manuals/
- Ford manuals: https://www.ford.com/support/owner-manuals-details/
- Honda manuals: https://mygarage.honda.com/s/manuals-search
- GM manuals: https://experience.gm.com/support/vehicle/manuals-guides
- Mopar manuals: https://www.mopar.com/en-us/my-vehicle/explore-the-manual.html

Use for:

- Linking users/providers to official maintenance/oil/fluids guidance.
- Manual validation when curating high-volume vehicle/service seeds.

Caveats:

- OEM manuals are copyrighted.
- They are not broad open APIs.
- Link and cite; do not scrape/copy at scale without permission.

### Commercial oil/maintenance/spec sources

Public product selectors are useful for manual validation but not safe production datasets without permission/licensing.

Examples:

- AMSOIL lookup: https://www.amsoil.com/lookup/auto-and-light-truck/
- Mobil oil selector: https://www.mobil.com/en/lubricants/what-to-buy/find-the-right-motor-oil
- LIQUI MOLY oil guide: https://www.liqui-moly.com/en/service/oil-guide.html
- FluidCapacity: https://www.fluidcapacity.com/

MVP rule:

- Do not rely on these as automated production sources unless licensed.
- Use them as research/validation references only.
- Keep customer-facing oil specs provider-confirmed unless curated and versioned.

### Vehicle model enrichment APIs

Possible supplements after MVP:

- CarAPI: https://carapi.app/
- API Ninjas Cars API: https://api-ninjas.com/api/cars

Use for:

- richer year/make/model/trim/engine data
- vehicle selector enrichment
- trim/engine hints

Caveats:

- Production/commercial usage may be paid.
- Not a full oil/parts/maintenance source.

## P2 / scale data sources

### ACES / PIES / VCdb

Sources:

- ACES: https://www.autocare.org/aces
- Auto Care Digital Hub: https://digital.autocare.org/standards
- Data standards subscriptions: https://www.autocare.org/data-standards/subscriptions

Use for:

- standardized aftermarket parts fitment
- vehicle configuration reference data
- product classifications
- qualifiers
- brand data

Important caveat:

- ACES is the industry standard for fitment data, but Auto Care notes that annual paid subscriptions to reference databases are required to use ACES for product data.
- ACES/PIES are standards plus reference data, not a free full parts catalog.

MVP rule:

- Do not build broad automated fitment in P0.
- Use provider-confirmed parts initially.
- Later license ACES/PIES/VCdb-backed data or partner with a parts provider.

### Parts catalogs and fitment vendors

Potential future sources:

- ShowMeTheParts API: https://info.showmetheparts.com/utilize-showmetheparts-api-for-detailed-searches-beyond-year-make-model/
- MOTOR data products: https://www.motor.com/products-services/data-products/estimated-work-times/
- ALLDATA: https://www.alldata.com/
- PartsTech or supplier/catalog partners, subject to commercial terms

Retail catalogs like RockAuto, AutoZone, and NAPA are useful references but should not be scraped or treated as open reusable data without permission.

### Labor-time and repair data

Future licensed sources:

- MOTOR Estimated Work Times
- ALLDATA
- Mitchell/ProDemand
- HaynesPro
- CarMD or other vehicle data vendors

MVP rule:

- Use ReGo static labor bands for scheduling and ranges.
- Do not claim labor-guide precision until a licensed source is integrated.

## API standards and oil categories

### API engine oil categories

Source: https://www.api.org/products-and-services/engine-oil/eolcs-categories-and-classifications/oil-categories

Use for:

- Educational content about API/ILSAC categories.
- Validating labels such as API SP or ILSAC GF-6.

Important caveats from API guidance:

- Vehicle owners should refer to owner manuals before consulting oil category charts.
- The latest gasoline category generally includes earlier category performance, but diesel categories have exceptions.
- API FA-4 diesel oils are not broadly backward compatible.

MVP rule:

- API categories are not vehicle-specific oil requirements.
- Do not use them to infer oil viscosity/capacity for a vehicle.

## Recommended P0 data model fields

Vehicle:

```ts
type Vehicle = {
  id: string;
  vin?: string; // masked in UI/logs
  vinLast4?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  engine?: string;
  fuelType?: string;
  driveType?: string;
  bodyClass?: string;
  mileage?: number;
  source: 'manual' | 'nhtsa_vpic' | 'curated' | 'provider_corrected';
  decodeConfidence: 'high' | 'medium' | 'low' | 'unknown';
  decodedAt?: string;
};
```

ServiceDataRequirement:

```ts
type ServiceDataRequirement = {
  serviceId: string;
  requiredVehicleFields: string[];
  requiresPartsFitment: boolean;
  requiresFluidSpec: boolean;
  providerConfirmationRequired: boolean;
  quoteType: 'fixed' | 'range' | 'tbd_provider_confirmed';
  sourceType: 'curated' | 'official_manual_link' | 'provider_confirmed' | 'commercial_api';
};
```

EstimateSource:

```ts
type EstimateSource = {
  sourceType: 'static_seed' | 'nhtsa_vpic' | 'official_manual_link' | 'provider_confirmed' | 'commercial_api';
  sourceName: string;
  sourceUrl?: string;
  version?: string;
  confidence: 'high' | 'medium' | 'low';
  verifiedAt?: string;
};
```

## Privacy and compliance requirements

- Treat VIN + user identity/location/service history as sensitive data.
- Mask VIN in UI/admin except where full VIN is required.
- Do not log raw VIN, address, payment, or private messages.
- Cache decoded VIN data with source/version timestamp.
- Avoid sending VIN/user info to paid vendors until privacy policy and vendor contracts cover it.
- Version every quote input for dispute/audit handling.
- Do not present ReGo data as OEM-certified unless it comes directly from OEM/dealer-authorized source.

## Fallback UX rules

- VIN decode fails: allow manual vehicle entry.
- Vehicle not found: allow manual review/request.
- Recall API unavailable: show recall check unavailable and continue.
- Oil/spec uncertain: show provider will confirm exact oil/filter before service.
- Parts fitment uncertain: show parts will be confirmed before appointment.
- Price uncertain: show range or TBD with written approval before added work.
- Provider eligibility pending: provider cannot accept jobs until approved.
- Roadside emergency: route to partner/support handoff, not ReGo dispatch.

## Test implications

- Mock every external API in unit/e2e tests.
- Do not make CI depend on live NHTSA/vendor uptime.
- Add fixtures for:
  - valid VIN
  - invalid VIN
  - manual vehicle
  - unsupported vehicle
  - ambiguous trim/engine
  - recall API unavailable
  - oil spec uncertain
  - parts fitment uncertain
- Add privacy tests or assertions for VIN masking/no raw VIN logging.
- Add quote versioning tests so historical estimates remain explainable after pricing-table changes.
- Add roadside tests asserting partner handoff never creates a direct ReGo dispatch job.

## Implementation sequence

1. Add `src/data/vehicle-data-sources.js` with source metadata and MVP decisions.
2. Add `src/lib/vehicle-identity.js` with pure helpers for manual vehicle normalization, VIN masking, and vPIC response mapping.
3. Add tests for VIN masking, manual fallback, and vPIC mapping using fixtures.
4. Add optional client/server boundary for vPIC lookup; keep tests mocked.
5. Add seed service data fields for `requiresFluidSpec`, `requiresPartsFitment`, `providerConfirmationRequired`, and `quoteType`.
6. Update pricing to output fixed/range/TBD/provider-confirmed result types.
7. Add recall lookup later as non-blocking informational UI.

## Bottom line

For ReGo MVP: use NHTSA vPIC now, optionally NHTSA recall data now, and static/curated/provider-confirmed data for oil, parts, labor, and pricing. Defer broad fitment, oil-spec automation, commercial maintenance/labor guides, and real roadside partner dispatch until P1/P2.
