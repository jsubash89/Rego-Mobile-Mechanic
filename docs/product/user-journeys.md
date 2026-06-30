# ReGo Mobile Mechanic User Journeys

## 1. Customer: book vehicle service

Goal: book a vetted mobile mechanic, independent shop, or dealership option with a transparent estimate.

Happy path:
1. Customer starts booking.
2. Customer selects/adds vehicle: year, make, model, mileage, VIN, address.
3. Customer selects service: oil change, diagnostic, brake service, or pre-purchase inspection.
4. Customer selects fulfillment: mobile mechanic, independent shop, or dealership.
5. If oil change, customer chooses oil preference.
6. Customer compares providers and slots.
7. Customer reviews estimate and terms.
8. Customer confirms appointment.
9. Provider confirms parts and arrival window.
10. Customer tracks job status.
11. Provider completes service.
12. Customer receives report/invoice.
13. Service record is saved to vehicle history.

Acceptance:
- Booking cannot be confirmed without vehicle, address, service, fulfillment, provider, appointment time, and valid estimate state.
- Non-oil services skip oil preference.
- Changing service or fulfillment invalidates incompatible downstream selections.
- Completed work creates vehicle history.

## 2. Customer: manage vehicle garage

Goal: keep vehicle and service-location data accurate for booking, pricing, and history.

Happy path:
1. Customer opens Garage.
2. Customer adds/edits vehicle.
3. System validates VIN/mileage/year/address.
4. Customer selects default vehicle for booking.
5. Booking summary reflects active vehicle.

Acceptance:
- VIN can be stored but is masked in summaries.
- Multiple vehicles are supported by design.
- History is attached to the correct vehicle.

## 3. Customer: view service history

Goal: see completed services, invoices, reports, warranty, and recommendations.

Happy path:
1. Customer opens History.
2. Customer selects service record.
3. Customer reviews report, invoice, provider, total, photos, and next recommendations.
4. Customer can rebook or contact support.

Acceptance:
- No-history state is useful.
- Report status, payment status, and dispute status are separate.

## 4. Mechanic/provider: accept and complete job

Goal: review incoming work, confirm feasibility, perform service, document completion, and get paid.

Happy path:
1. Provider receives job offer.
2. Provider reviews vehicle, service, location, estimate, tools/parts, and time.
3. Provider accepts or declines.
4. Provider confirms parts and arrival window.
5. Provider marks en route, arrived, started.
6. Provider performs service.
7. Provider uploads notes/photos/service report.
8. Provider submits invoice and completes job.
9. Payout is queued.

Acceptance:
- Provider cannot complete job before start.
- Scope/price changes require customer approval.
- Required report fields gate completion.

## 5. Shop/dealership admin: manage service-lane bookings

Goal: receive marketplace bookings, confirm capacity, perform service, and submit report/invoice.

Happy path:
1. Shop/dealer receives request.
2. Admin reviews vehicle, service, slot, estimate, and constraints.
3. Admin accepts and confirms appointment.
4. Vehicle is checked in.
5. Shop performs work.
6. Admin requests approval for changes if needed.
7. Admin submits report/invoice.

Acceptance:
- Shop/dealer can decline with reason.
- Availability/capacity determines bookability.
- Dealer-specific warranty/OEM notes can be captured.

## 6. Dispatcher/platform admin: operate marketplace

Goal: ensure jobs are assigned, confirmed, serviced, and closed within SLA.

Happy path:
1. Dispatcher opens job queue.
2. Jobs are grouped by status and SLA risk.
3. Dispatcher handles unassigned/blocked/at-risk jobs.
4. Dispatcher reassigns, escalates, cancels, or resolves.
5. Completion/report/invoice are audited.

Acceptance:
- Every manual action is auditable.
- Dispatcher can filter by status, market, fulfillment, provider, and SLA.
- At-risk jobs are obvious.

## 7. Support: resolve issues

Goal: resolve booking, payment, provider, quality, cancellation, warranty, and dispute issues with full context.

Happy path:
1. Ticket is created from booking/history/account.
2. Support sees customer, vehicle, provider, booking, invoice, messages, and audit log.
3. Support categorizes issue and contacts parties.
4. Support resolves, refunds/escalates if authorized, and closes with reason.

Acceptance:
- Tickets link to bookings/service records.
- Refunds require permission and reason.
- Resolution category is mandatory.
