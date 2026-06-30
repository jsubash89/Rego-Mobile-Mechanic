# ReGo Mobile Mechanic Market Research

Date: 2026-06-30

Purpose: ground the ReGo Mobile Mechanic product docs in real customer needs, competitor patterns, provider operations, and auto-service market constraints.

This document synthesizes subagent web research. It should inform feature docs, Linear implementation order, and product positioning. It is not legal advice; compliance details must be verified market-by-market before production launch.

## Executive summary

ReGo should not be “just another mobile mechanic booking page.” The strongest opportunity is a hybrid marketplace/operating layer that lets customers choose the right fulfillment mode for the job:

- Mobile mechanic when the job is safe, predictable, and convenient at home/work.
- Independent shop when equipment, lift, bay capacity, or price makes a shop better.
- Dealership when warranty, recall, OEM tooling, software, or brand specialization matters.

Competitors validate each part of the thesis separately:

- YourMechanic and Wrench validate mobile repair convenience and upfront quote demand.
- Openbay validates provider comparison and quote marketplace behavior.
- RepairPal validates fair-price estimates and certified provider trust.
- Yelp/Google validate that local discovery and reviews are entrenched substitutes.
- Dealership/OEM portals validate VIN, recall, warranty, and OEM service routing.
- Tire Rack/Goodyear mobile service validate predictable mobile wedge services.
- AAA validates urgent/roadside intent, but also shows that emergency dispatch is a different operational model. ReGo will not operate emergency roadside directly; emergency/tow/lockout/fuel flows are partner-routed.

ReGo’s wedge should be:

1. Transparent estimate and fulfillment comparison.
2. VIN-aware service and parts fitment.
3. Trust layer: verified provider, certifications, insurance, warranty, reviews, photos.
4. Mobile/service eligibility guidance: “can this be done in your driveway?”
5. Durable vehicle history with reports, photos, invoices, warranty, and reminders.
6. Operationally realistic provider dispatch: geography, travel time, skills, tools, parts, appointment windows.

## Market/customer needs

### Large and durable aftermarket

The U.S. light-duty automotive aftermarket reached $413.7B in 2024 and is projected to keep growing; broader light/medium/heavy-duty aftermarket is projected to reach $664.3B by 2028. Vehicles are also staying on the road longer, with average age cited over 12.8 years.

Source:
- Auto Care Association: https://www.autocare.org/news/latest-news/details/2025/06/13/new-report-5.1-growth-expected-for-auto-care-industry-in-2025-reaching-$664-billion-in-2028

Implications:
- ReGo should optimize for repeat maintenance and lifecycle ownership, not one-off repairs only.
- Vehicle garage, history, reminders, and “book again” should be P0/P1, not nice-to-have.

### Dealerships are vulnerable on convenience/perception

Cox Automotive reports dealership share of service visits has fallen, while general repair providers gained ground. The study points to convenience/accessibility and perceived lower cost as major reasons consumers choose alternatives, even when average spend is comparable.

Source:
- Cox Automotive Ownership Study: https://www.coxautoinc.com/retail/resources/ownership-study/

Implications:
- ReGo should not compete only on “cheaper.” It should compete on clarity, convenience, and confidence.
- Dealer fulfillment should be framed as the right choice for warranty/recall/OEM work, not the default.

### Pricing opacity and trust are central pains

Consumer Reports emphasizes finding shops committed to fair and transparent pricing. RepairPal’s entire consumer proposition is fair-price estimation and certified providers.

Sources:
- Consumer Reports repair shop guidance: https://www.consumerreports.org/cars/car-repair-shops/car-repair-shop-survey-chains-dealers-independents-a1071080370/
- Consumer Reports high-quality shop guidance: https://www.consumerreports.org/cars/car-repair-maintenance/how-to-find-a-high-quality-car-repair-shop-a9066489721/
- RepairPal: https://repairpal.com/
- RepairPal estimator: https://repairpal.com/estimator

Implications:
- Estimate/pricing docs must specify itemized labor, parts, mobile/travel fee, platform fee, tax, disposal/shop fees, diagnostic fee, and TBD/range behavior.
- ReGo should explain what is included/excluded before confirmation.
- Price changes after arrival must require explicit customer approval.

### Affordability blocks conversion

AAA found one in three U.S. drivers could not pay for an unexpected repair without going into debt. Other consumer finance research similarly shows many consumers cannot absorb $500–$1,000 repair surprises.

Sources:
- AAA unexpected repair bill: https://newsroom.aaa.com/2017/04/one-three-u-s-drivers-cannot-pay-unexpected-car-repair-bill/
- MarketWatch unexpected repair: https://www.marketwatch.com/insurance-services/car-warranty/are-americans-ready-for-an-unexpected-car-repair/
- Repairer Driven News repair affordability: https://www.repairerdrivennews.com/2023/05/09/study-most-americans-cant-afford-unexpected-vehicle-repair-bills/
- Bankrate emergency savings: https://www.bankrate.com/banking/savings/emergency-savings-report/

Implications:
- Larger repairs need financing/pay-over-time or deposit/authorization options.
- The product should support triage: urgent safety repair vs. can wait vs. monitor.
- “Diagnostic fee credited toward repair” should be considered.

### Repair costs are rising

BLS reported motor vehicle maintenance and repair costs increased 6.2% from Dec. 2023 to Dec. 2024.

Sources:
- BLS CPI contributors: https://www.bls.gov/opub/btn/volume-14/what-price-changes-contributed-the-most-to-increases-in-the-cpi-in-2024.htm
- FRED CPI maintenance/repair: https://fred.stlouisfed.org/series/CUSR0000SETD

Implications:
- ReGo should show transparent price reasoning and preventive maintenance value.
- A maintenance/reminder plan is strategically relevant.

## Competitor and substitute analysis

### YourMechanic

Source: https://www.yourmechanic.com/

Offering:
- Mobile mechanics at home/office.
- Broad repair/maintenance catalog.
- Upfront/fair pricing.
- Online booking.
- 12-month / 12,000-mile warranty.

ReGo opportunity:
- Differentiate with explicit comparison across mobile, shop, and dealership fulfillment.
- Add richer vehicle history, service reports, and provider choice.
- Route non-mobile-appropriate jobs instead of forcing a mobile-only model.

### Wrench

Source: https://wrench.com/

Offering:
- Mobile repair, diagnostics, fleet support, tires, towing/roadside adjacency.
- Certified mechanics.
- Diagnostic visit for unknown issues.
- 1-year / 12,000-mile warranty.

ReGo opportunity:
- Build a strong “diagnose first, quote second” flow.
- Treat towing/roadside as adjacency only; ReGo should partner-route emergency roadside instead of staffing or operating it directly.
- Compete on same/next-day availability and ETA transparency.

### AutoNation Mobile Service / RepairSmith successor

Source: https://www.autonation.com/autonation-mobile-service

Offering:
- Mobile repair/maintenance backed by AutoNation.
- ASE/manufacturer-certified techs.
- Screening/background checks.
- 12-month / 12,000-mile guarantee.

ReGo opportunity:
- Trust layer must be explicit: background checks, insurance, certifications, warranty, verified reviews, completed-job photos.
- ReGo can be brand-neutral and compare independents, dealerships, and mobile providers side by side.

### Openbay

Source: https://app.openbay.com/

Offering:
- Shop/service marketplace.
- Compare providers by price, location, reviews, amenities, availability.
- Upfront pricing and appointment scheduling.

ReGo opportunity:
- Combine Openbay-style comparison with mobile eligibility and driveway logistics.
- Make fulfillment mode a first-class dimension.

### RepairPal

Sources:
- https://repairpal.com/
- https://repairpal.com/estimator

Offering:
- Fair Price Estimator.
- Certified shops and dealerships.
- Price-range methodology based on vehicle/service/location and labor/parts data.

ReGo opportunity:
- Pricing credibility matters. ReGo should move from mock prices to a documented estimate methodology.
- Support fixed quotes for known services and range/TBD estimates for uncertain repairs.

### Yelp / Google local search

Example source: https://www.yelp.com/search?find_desc=Auto+Repair&find_loc=Philadelphia%2C+PA

Offering:
- Entrenched local discovery, reviews, phone calls, quote requests, business profiles.

ReGo opportunity:
- SEO/local landing pages will matter.
- ReGo must beat directories after click: estimate, compare, book, pay, warranty, and history in one place.

### Dealership/OEM schedulers

Example source: https://www.toyota.com/owners/schedule-service/

Offering:
- Owner portal scheduling, VIN/account, recalls, warranties, dealer selection.

ReGo opportunity:
- Add recall/warranty/dealer routing via VIN.
- Explain “why dealership” when OEM tooling, recall, warranty, or software is relevant.

### Tire Rack / Goodyear mobile services

Sources:
- https://www.tirerack.com/mobile-tire-installation
- https://www.goodyear.com/en-us/mobile-garage

Offering:
- Mobile tire installation and some mobile auto services.
- Predictable SKU/service workflow.
- Appointment windows and technician arrival alerts.

ReGo opportunity:
- Wedge into predictable jobs: oil, tires, battery, brakes, inspections.
- Add prep instructions, ETA, SMS, workspace requirements, and bundled maintenance.

### AAA / roadside

Source: https://www.ace.aaa.com/automotive/roadside-assistance.html

Offering:
- Emergency roadside assistance, towing, battery, flat tire, lockout, fuel.

ReGo opportunity:
- Emergency roadside is explicitly partner-driven. ReGo should not personally operate towing, lockout, fuel delivery, emergency flat-tire response, or emergency battery dispatch.
- Add “urgent now” triage only as a routing/handoff layer: partner roadside/tow vs. scheduled mobile mechanic vs. shop/dealer.

## Provider/supply-side operations

### Certification and skill trust

ASE is the recognizable technician certification signal. ASE certifications validate technical knowledge and require recertification.

Source:
- ASE: https://ase.com/

Implications:
- Provider onboarding should capture ASE certification number/status, expiration, specialties, and service categories.
- Use ASE/certification tags for matching/ranking, especially diagnostics, brakes, hybrid/EV, and dealership-grade work.

### Licensing and compliance are local

Mobile mechanic licensing, auto repair, auto body, hazardous waste, A/C refrigerant, and similar requirements vary by jurisdiction.

Sources:
- Houston auto/tire business starter kit: https://www.houstontx.gov/business/start/auto-tire.html
- NJ MVC Auto Body Repair License: https://www.nj.gov/mvc/business/autobodylic.htm

Implications:
- ReGo needs a market compliance matrix.
- Provider onboarding should collect licenses/attestations by market and service type.
- Some services should be disabled until market compliance is resolved.

### Insurance must cover custody/control risk

Garagekeepers/care-custody-control coverage can matter when customer vehicles are in a mechanic’s custody/control. Mobile mechanics may also need general liability, commercial auto, tools/equipment, workers comp depending on structure.

Sources:
- Insureon mobile mechanic insurance: https://www.insureon.com/auto-services-business-insurance/mobile-repair-mechanics
- NJ MVC Auto Body Repair License: https://www.nj.gov/mvc/business/autobodylic.htm

Implications:
- Provider Management doc should require insurance COI capture and expiration tracking.
- Customer-facing trust should include insured/verified status.
- Policies must define who covers damage during mobile service.

### Parts sourcing and VIN fitment are operationally critical

Parts catalogs and OEM/aftermarket suppliers support VIN-based lookup because fitment errors are costly.

Sources:
- GM Parts / ACDelco: https://www.gmparts.com/
- OEM Parts Online: https://oempartsonline.com/
- Auto Value parts catalog: https://www.autovalue.com/parts-catalog.php
- O’Reilly VIN lookup: https://www.oreillyauto.com/vin-lookup

Implications:
- Vehicle Garage should prioritize VIN/trim/engine capture.
- Estimate/Pricing should distinguish quote, range, TBD, and provider-confirmed parts.
- Provider workflow needs pre-dispatch parts confirmation and wrong-part exception handling.

### Dispatch is field-service optimization, not simple scheduling

Field-service scheduling systems optimize around travel time, skills, availability, customer constraints, and routing.

Sources:
- Salesforce Field Service routing: https://help.salesforce.com/s/articleView?id=service.pfs_streetlevelrouting.htm&language=en_US&type=5
- ORTEC field service scheduling: https://ortec.com/en/insights/fs-scheduling-optimization-hidden-complexity

Implications:
- Provider matching must include geography, drive time, skills, tools, parts readiness, duration, appointment window, and buffer time.
- Route density should inform provider profitability and dispatch rules.

### Written estimates and approvals reduce disputes

Several state/consumer-protection resources emphasize written estimates and authorization before repair work.

Sources:
- Ohio Attorney General repairs/services: https://www.ohioattorneygeneral.gov/Business/Services-for-Business/Business-Guide/Repairs-and-Services
- Ohio motor vehicle repair rule: https://codes.ohio.gov/ohio-administrative-code/rule-109:4-3-13
- Washington State Attorney General auto repair: https://www.atg.wa.gov/auto-repair
- AAA written repair estimate: https://www.aaa.com/autorepair/articles/insist-on-a-written-repair-estimate

Implications:
- Booking Confirmation and Estimate/Pricing docs should require written in-app estimate/authorization.
- Scope or price change after inspection must trigger customer approval.
- Store timestamp, actor, estimate version, and approval record.

### Warranty expectations must be explicit

Consumers expect clarity on labor warranty, parts warranty, manufacturer warranty, and service contract coverage.

Sources:
- FTC Auto Repair Basics: https://consumer.ftc.gov/articles/0211-auto-repair-basics
- AAA vehicle warranties: https://www.aaa.com/autorepair/articles/vehicle-warranties-offer-low-or-no-cost-repairs

Implications:
- Service Report and Customer Support docs need warranty claim flow.
- ReGo should separate platform workmanship warranty from parts warranty and manufacturer warranty.
- Recall/warranty-covered work should route to dealer where appropriate.

## EV/hybrid, recalls, warranty, and financing

### EV/hybrid requires qualification gates

EV/hybrid growth creates repair complexity, high-voltage safety concerns, and technician qualification constraints.

Sources:
- Center for Automotive Research EV/hybrid context: https://www.automotiveresearch.com/insights/the-rise-of-electric-and-hybrid-vehicles
- FutureTech EV technician shortage: https://www.futuretechauto.com/blog/addressing-hybrid-and-ev-technician-shortage-how-auto-repair-shops-can-thrive-in-the-hybrid-and-electric-vehicle-era
- Nelson’s hybrid/EV shop maintenance: https://www.nelsonsrepair.com/blog/how-do-full-service-auto-repair-shops-handle-hybrid-and-electric-vehicle-maintenance

Implications:
- Vehicle model should include fuel/propulsion type.
- Provider eligibility should include hybrid/EV qualifications.
- MVP EV scope should be conservative: 12V battery, tires, cabin filters, basic diagnostics, brakes only with qualified providers.

### Recall/dealer routing protects trust

NHTSA provides VIN-based recall lookup; recall repairs are generally free at manufacturer dealerships.

Sources:
- NHTSA recalls: https://www.nhtsa.gov/recalls
- NHTSA recall alert: https://www.nhtsa.gov/press-releases/consumer-alert-change-your-clocks-check-safety-recalls
- Auto Care Association Magnuson-Moss overview: https://www.autocare.org/government-relations/current-issues/Magnuson-Moss-Warranty-Act

Implications:
- ReGo should run VIN recall check before selling paid work that might be recall-covered.
- Dealer fulfillment should become a strength, not an afterthought.
- Service history should preserve receipts for warranty documentation.

### Financing can unlock larger repairs but must be responsible

BNPL/financing for repairs is emerging as repair costs rise, but consumer risk exists.

Sources:
- Auto Finance News BNPL repair costs: https://www.autofinancenews.net/allposts/capital-funding/bnpl-picks-up-at-dealerships-as-repair-costs-rise-6/
- Growth Market Reports BNPL auto repair: https://growthmarketreports.com/report/buy-now-pay-later-for-auto-repair-market
- LendingTree BNPL statistics: https://www.lendingtree.com/personal/buy-now-pay-later-loan-statistics/

Implications:
- Checkout/Payment should consider pay-over-time for $300+ repairs.
- Terms, APR, fees, and late-payment risks must be transparent.
- Financing should not obscure total repair cost.

## Product positioning

Recommended positioning:

“Trusted car care at your driveway, shop, or dealership — with upfront pricing, verified providers, VIN-fit parts, and every service saved to your vehicle history.”

Customer promise:
- Save time.
- Know what it should cost.
- Choose the right service path.
- Avoid surprise upsells.
- Keep proof of work, warranty, and reminders in one place.

Provider promise:
- Better-fit jobs.
- Reduced admin burden.
- Route-dense scheduling.
- Faster payments.
- Parts/vehicle info before dispatch.

Admin/ops promise:
- SLA visibility.
- Provider compliance.
- Estimate/approval audit trail.
- Dispute and warranty traceability.

## Product requirements added or strengthened by research

P0 should include:

1. VIN/plate-first vehicle profile.
2. Explicit mobile-eligible service catalog.
3. Itemized estimate with TBD/range/fixed quote support.
4. Written customer authorization and change-order approval.
5. Provider trust profile: certifications, background/insurance/verified status, reviews, warranty.
6. Diagnostic flow: “I know the service” vs. “something is wrong.”
7. Appointment windows, ETA, location prep instructions.
8. Provider eligibility: service, vehicle, location, skill, tools, parts, availability.
9. Service report/history with photos, invoice, warranty, and recommendations.
10. Recall/warranty/dealer routing warnings.

P1 should include:

1. Parts sourcing/fitment integration.
2. Maintenance schedule/reminders.
3. EV/hybrid qualification gating.
4. Financing/pay-over-time for larger repairs.
5. Support/dispute/refund/warranty flows.
6. Provider compliance matrix by market.
7. Route optimization and provider productivity analytics.

P2 should include:

1. Partner-driven roadside/tow handoff or integration; ReGo does not operate emergency roadside directly.
2. Fleet/light commercial flow.
3. Dealer/warranty partner integrations.
4. Advanced diagnostics/telematics.
5. Preventive maintenance subscriptions.

## Required doc updates after this research

Feature docs to refine first:

- `docs/features/customer/estimate-pricing.md`
  - Add fixed/range/TBD quote types.
  - Add written estimate/authorization requirements.
  - Add diagnostic-fee and change-order rules.

- `docs/features/customer/vehicle-garage.md`
  - Strengthen VIN, trim, engine, propulsion type, recall check, service history.

- `docs/features/customer/service-selection.md`
  - Add mobile eligibility and “route to shop/dealer” logic.

- `docs/features/customer/provider-comparison.md`
  - Add trust signals: ASE, insurance, background, warranty, punctuality, completed jobs.

- `docs/features/provider/provider-onboarding.md`
  - Add certifications, licenses, insurance COI, tools/equipment, service radius, market compliance.

- `docs/features/provider/provider-availability.md`
  - Add travel time, route density, buffers, parts readiness.

- `docs/features/operations/job-assignment.md`
  - Add field-service dispatch constraints.

- `docs/features/platform/search-matching.md`
  - Add eligibility/ranking dimensions: service, vehicle, provider skill, tools, parts, travel, slot, rating.

- `docs/features/customer/checkout-payment.md`
  - Add financing and payment timing clarity.

- `docs/features/customer/service-report.md`
  - Add warranty, photos, recommendations, approval history.

## Open strategic questions

1. Which roadside/tow partners should ReGo route emergency cases to by market?
2. Will dealership fulfillment be direct scheduling, referral/lead, or partner integration?
3. What warranty does ReGo offer, and who backs it?
4. Does ReGo require ASE certification for all providers or only higher-complexity jobs?
5. Which services are explicitly mobile-ineligible at launch?
6. Who sources parts: provider, ReGo, customer, or partner supplier?
7. Does diagnostic fee credit toward repair?
8. Are estimates binding, ranges, or provider-confirmed quotes?
9. What customer no-show/trip fee policy is acceptable?
10. What financing provider, if any, is appropriate for larger repairs?
