# ReGo Mobile Mechanic Canonical User Journeys

Status: source-of-truth journey map for MVP build, QA, and future Playwright/browser E2E coverage.
Last updated: 2026-07-02
Linear: JS-785 — Docs: canonical user journeys

This document scopes the end-to-end user journeys ReGo should be tested against. It is intentionally more concrete than the older high-level journey list: each journey names the actor, surface, click-through path, system states, privacy/payment/comms boundaries, and test intent.

Current implementation note:
- The app is still a static/mock-first MVP shell. Several flows below are documented as mocked, stubbed, or future/backend-dependent.
- Payments, messaging/comms, notifications, live auth/RBAC, live provider dispatch, live partner dispatch, and production data persistence are deferred until explicit Linear milestones start those integrations.
- Browser E2E automation is not implemented yet. Repo-root `docs/quality/test-strategy.md` maps these journeys to future Playwright coverage.
- The customer shell should stay near-verbatim to the original create.xyz screenshots where those screenshots define the flow or visual language.

## Implementation status legend

| Status | Meaning |
| --- | --- |
| Implemented | Behavior exists in code and is covered by local tests or UI smoke. |
| Mocked | Behavior exists with static/local/demo data only. No live external service. |
| Stubbed | UX/control point is documented or partially represented, but final backend/provider/payment/messaging behavior is not active. |
| Deferred | Future work. Must not be treated as production-ready. |
| Blocked by integration | Requires explicit later milestone and approved live service contract. |

## Canonical journey matrix

| ID | Journey | Primary actor | Current status | Critical feature docs | Test intent |
| --- | --- | --- | --- | --- | --- |
| CJ-001 | Customer mobile service booking through completion and payment closeout | Customer | Partly implemented, payment/comms/report closeout stubbed/deferred | `features/customer/booking-flow.md`, `features/customer/checkout-payment.md`, `features/customer/booking-confirmation.md`, `features/platform/search-matching.md`, `features/platform/payments.md`, `features/platform/messaging.md`, `features/customer/service-report.md`, `features/customer/service-history.md` | P0 Playwright golden path plus unit/state-machine coverage |
| CJ-002 | Customer partner-routed roadside/tow handoff | Customer | Implemented/mocked partner-only boundary | `features/customer/partner-routed-emergency-roadside-handoff.md`, `features/customer/createxyz-ux-fidelity.md` | P0 Playwright handoff smoke; assert no ReGo booking/dispatch/provider job |
| CJ-003 | Customer cancellation, reschedule, support, and dispute | Customer/support | Mostly deferred; policy/state docs exist | `features/operations/cancellation-rescheduling.md`, `features/customer/customer-support.md`, `features/platform/payments.md`, `features/platform/audit-log.md` | P1 E2E once status/payment/support slices exist |
| PJ-001 | Mechanic/provider accepts and completes a mobile job | Mechanic/provider | Mocked demo ops + unit/state-machine coverage; true role route deferred | `features/provider/provider-job-inbox.md`, `features/provider/provider-job-lifecycle.md`, `features/provider/provider-service-reporting.md`, `features/provider/provider-payouts.md`, `features/platform/messaging.md` | P0/P1 provider Playwright once provider route exists; interim demo smoke |
| PJ-002 | Mechanic/provider change request and customer approval | Mechanic/provider + customer | State-machine/docs only; UI mostly deferred | `features/provider/provider-job-lifecycle.md`, `architecture/state-machines.md`, `features/platform/messaging.md`, `features/customer/checkout-payment.md` | P1 state-machine + E2E approval flow |
| AJ-001 | Dispatcher/admin assigns, monitors, escalates, and closes jobs | Dispatcher/admin | Mocked demo ops + unit coverage; protected route deferred | `features/operations/dispatch-dashboard.md`, `features/operations/job-assignment.md`, `features/operations/job-status-tracking.md`, `features/platform/audit-log.md` | P0/P1 admin Playwright once ops route exists; interim demo smoke |
| AJ-002 | Admin/support payment, refund, dispute, and audit intervention | Admin/support | Deferred; RBAC/privacy readiness documented | `features/platform/payments.md`, `features/customer/customer-support.md`, `features/platform/audit-log.md`, `features/platform/auth-rbac-privacy.md` | P1/P2 E2E after payment/support implementation |
| SJ-001 | Shop/dealership service-lane booking | Shop/dealer admin | Deferred except conceptual fulfillment support | `features/operations/job-status-tracking.md`, `features/admin/provider-management.md`, `features/customer/provider-comparison.md` | P2 E2E after shop/dealer surface exists |

## CJ-001 — Customer mobile service booking through completion and payment closeout

Goal: a customer books a vetted mobile mechanic with transparent pricing, communicates safely, tracks the job, receives report/invoice, and reaches payment closeout.

Actors and roles:
- Primary: customer.
- Downstream: provider/mechanic, dispatcher/admin, payment processor stub, messaging/notification stub.

Entry point and surface:
- Current: landing page customer shell at `/` with create.xyz-inspired service tiles and scheduling modal.
- Future: authenticated customer app shell with Garage, Book, Jobs, Messages, History, Support.

Current implementation status:
- Service selection, draft booking controls, pricing/matching engines, provider eligibility, local draft persistence, and confirmation guards are partly implemented/mocked.
- Checkout/payment auth, messaging/comms, notifications, provider live confirmation, service report display, invoice, payment capture, and persistent history are stubbed/deferred.

Click-through path:
1. Customer opens ReGo landing page.
   - Expected UI: ReGo brand, simple service tiles, address input, Schedule Now CTA, customer-only top navigation.
   - State checkpoint: no provider/admin internal controls exposed through customer nav.
2. Customer enters service address or confirms current local demo address.
   - Expected system state: address is used for eligibility/ranking and display is masked/summarized outside the active booking context.
   - Privacy boundary: full address must not be persisted in localStorage.
3. Customer selects service tile, e.g. Oil Change.
   - Expected UI: selected service is clear; incompatible downstream selections are reset.
   - State checkpoint: booking draft remains `draft` until required inputs and valid estimate are present.
4. Customer clicks Schedule Now.
   - Expected UI: booking modal opens with vehicle/service details, schedule/location fields, and estimate context.
5. Customer enters or selects vehicle.
   - Expected system state: vehicle can include year/make/model/mileage and VIN-derived fitment in future.
   - Privacy boundary: full VIN must not be persisted in localStorage; summaries must be masked.
6. Customer selects fulfillment: mobile mechanic for this journey.
   - Expected system state: pricing fees and provider eligibility recompute for fulfillment.
7. If service requires oil/parts preference, customer selects recommendation/known oil option.
   - Expected system state: non-oil services hide or skip this step.
8. Customer compares eligible providers and appointment slots.
   - Expected system state: provider must support service, fulfillment, vehicle/parts fitment, market, travel radius, and slot.
   - Guard: restored provider/slot drafts must normalize against current provider eligibility and clear invalid selections.
9. Customer reviews estimate, terms, cancellation policy, and mocked checkout summary.
   - Expected UI: transparent line items; provider payout/internal margin hidden from customer.
   - Payment boundary: payment authorization is stubbed/test-provider only until JS-818 or equivalent starts real payments.
10. Customer confirms appointment.
   - Expected state: `quote_ready -> pending_confirmation`.
   - Guard: confirmation state must never restore as confirmed from localStorage.
11. Provider confirms parts and arrival window.
   - Current/future status: mocked/deferred.
   - Expected state: `pending_confirmation -> confirmed -> assigned` when accepted.
12. Customer receives communication touchpoint.
   - Expected UI future: booking thread with masked participant contact and system messages.
   - Comms boundary: messaging/notifications are stubbed/deferred; no live SMS/email/chat provider yet.
13. Customer tracks job status.
   - Expected states: `assigned -> en_route -> arrived -> in_progress`.
   - UI should be simple and reassuring, with ETA/status copy rather than internal dispatch jargon.
14. If provider requests scope/price change, customer reviews change request.
   - Expected states: `in_progress -> approval_required -> in_progress` if approved, or cancellation/partial completion if declined per policy.
   - Payment boundary: additional authorization/capture remains stubbed until payments milestone.
15. Provider completes service.
   - Expected states: `in_progress -> completed -> report_submitted -> invoice_ready`.
16. Customer reviews service report and invoice.
   - Expected UI future: notes, checklist, photos, recommendations, warranty/service notes, invoice total.
17. Payment capture/settlement completes in mocked/test-provider mode.
   - Expected state: `invoice_ready -> paid`.
   - Payment boundary: no production card, token, bank, or processor secret should be stored/logged in app state or analytics.
18. Customer sees service saved in vehicle history.
   - Expected state: completed service record appears under the correct vehicle.

Acceptance criteria:
- Booking cannot be confirmed without vehicle, service, fulfillment, eligible provider, appointment time, valid estimate, and required policy acknowledgements.
- Customer-facing flow does not expose provider/admin/dispatch demo controls as top-level customer navigation.
- Estimate shown to customer excludes provider payout, internal margin, payment secrets, and admin-only economics.
- Payment and messaging controls are labeled/stubbed until their dedicated milestones activate real integrations.
- Completed service creates or displays a vehicle history record only after report/invoice closeout.
- No full VIN or full address is persisted in localStorage.

E2E test candidates:
- `e2e-customer-oil-mobile-checkout-stub`
- `e2e-customer-diagnostic-no-oil-step`
- `e2e-customer-provider-slot-normalizes-after-service-change`
- `e2e-customer-completion-report-history-stub`

## CJ-002 — Customer partner-routed roadside/tow handoff

Goal: preserve the create.xyz Car Tow tile while routing urgent roadside demand to partners, not to ReGo-operated mobile mechanic dispatch.

Actors and roles:
- Primary: customer.
- Downstream: roadside partner handoff stub.
- Explicit non-actor: ReGo mechanic/provider dispatch for emergency roadside.

Entry point and surface:
- Current: landing page service tile, including Car Tow.

Current implementation status:
- Partner-only data/test boundary is implemented/mocked.
- Live roadside partner integration is deferred.

Click-through path:
1. Customer opens landing page.
2. Customer selects Car Tow.
   - Expected UI: Car Tow remains visually present for screenshot fidelity.
3. Customer starts scheduling/handoff.
   - Expected UI/system: route to partner-only roadside handoff copy/action, not normal ReGo provider booking.
4. Customer is shown emergency/partner disclosure.
   - Expected copy: ReGo does not operate towing, lockout, fuel delivery, or emergency roadside directly.
5. If future partner integration exists, customer is handed off to approved partner flow.
   - Current status: mocked/deferred.

Acceptance criteria:
- Car Tow never creates a normal ReGo booking, provider job, dispatch job, assignment, or dispatch status.
- Roadside/tow/lockout/fuel/emergency flat-tire/emergency battery paths are partner-routed only.
- Unsupported market/service combinations fail closed instead of using wildcard coverage.

E2E test candidates:
- `e2e-customer-car-tow-partner-handoff-only`
- `e2e-roadside-does-not-create-dispatch-job`

## CJ-003 — Customer cancellation, reschedule, support, and dispute

Goal: customer can change or resolve a booking without hidden state corruption or unsafe payment/refund behavior.

Actors and roles:
- Primary: customer.
- Downstream: support/admin, provider, payment/refund stub.

Entry point and surface:
- Current: active booking summary, confirmation state, or future service history/support entry point.
- Future: authenticated customer Jobs, History, Messages, and Support surfaces.

Current implementation status:
- Mostly deferred; state-machine and feature docs exist.

Related docs/features:
- `features/operations/cancellation-rescheduling.md`
- `features/customer/customer-support.md`
- `features/platform/payments.md`
- `features/platform/audit-log.md`
- `architecture/state-machines.md`

State-machine checkpoints:
- Pre-completion actions affect `draft`, `quote_ready`, `pending_confirmation`, `confirmed`, `assigned`, `en_route`, `arrived`, or `in_progress` according to cancellation policy.
- Post-completion support actions affect `disputed`, `refunded`, or support/audit state without rewriting report status.

Data/privacy/comms/payment boundaries:
- Cancellation/refund messaging is stubbed until messaging/notifications exist.
- Payment/refund updates are test-provider stubs until payments are implemented.
- Support and audit views must redact full VIN, full address, payment secrets, and raw private message bodies.

Click-through path:
1. Customer opens active booking or service history.
2. Customer chooses Reschedule, Cancel, Contact Support, or Dispute.
3. System shows policy, refund/fee implications, and provider impact.
4. Customer confirms action.
5. Provider/admin receives updated job state or support ticket.
6. Payment/refund state is updated in mocked/test-provider mode when relevant.
7. Audit log records actor, reason, old/new state, timestamp.

Acceptance criteria:
- Pre-completion cancellation/reschedule follows policy and does not leave assigned jobs orphaned.
- Post-completion dispute/refund is separate from report status and payment status.
- Refund/payment intervention requires support/admin permission and reason.
- Private messages, full address, payment data, and VIN are not leaked into audit/log metadata.

E2E test candidates:
- `e2e-customer-reschedule-active-booking`
- `e2e-customer-cancel-before-provider-enroute`
- `e2e-customer-dispute-after-invoice`

## PJ-001 — Mechanic/provider accepts and completes a mobile job

Goal: provider can review feasible work, accept it, communicate safely, perform service, submit a report, complete the job, and see payout queued.

Actors and roles:
- Primary: mechanic/provider.
- Downstream: customer, dispatcher/admin, payout stub.

Entry point and surface:
- Current: internal demo provider controls embedded below customer shell.
- Future: protected provider route/app shell with Job Inbox, Active Job, Messages, Reports, Payouts.

Current implementation status:
- Provider operations and state-machine engines are partly implemented/mocked.
- True auth role shell, live messaging, report upload storage, and payout integration are deferred.

Click-through path:
1. Provider logs in to provider app shell.
   - Future/backend-dependent; current auth is readiness-gated only.
2. Provider opens Job Inbox.
   - Expected list: offered jobs only, with masked customer/location details and service/vehicle summary.
3. Provider selects a job.
   - Expected details: service, estimated duration, market, tools/parts requirements, payout estimate, arrival window, eligibility warnings.
4. Provider accepts or declines.
   - Expected states: `offered -> accepted` or `offered -> declined` with reason.
5. Provider confirms parts and arrival window.
   - Expected state: `accepted -> parts_confirmed -> assigned` or equivalent documented job state.
6. Provider sends/receives booking-specific customer message.
   - Comms boundary: no raw phone/email exposure; live messaging deferred.
7. Provider marks En Route.
   - Expected guard: cannot mark en route before accepting.
8. Provider marks Arrived.
9. Provider marks Started.
10. Provider performs service.
11. If scope/price changes, provider submits change request.
   - Expected state: `started/in_progress -> customer_approval_required`.
12. Customer approves or declines change.
   - Expected state resumes or cancels/partial-completes according to policy.
13. Provider fills service report.
   - Required: notes/checklist/outcome; future photos; recommended follow-up; warranty/OEM notes if relevant.
14. Provider submits invoice/complete action.
   - Expected guards: cannot complete before started; required report fields gate completion.
15. Payout is queued in mocked payout state.
   - Payment boundary: no live bank/payout data until payout milestone.

Acceptance criteria:
- Provider sees only assigned/offered jobs and masked customer/location data appropriate to the role.
- Provider cannot bypass lifecycle order: accept before en route, arrived before started, started before complete.
- Required report fields gate completion.
- Customer approval is required for scope/price changes.
- Payout state is distinct from customer payment state.

E2E test candidates:
- `e2e-provider-accept-progress-report-complete`
- `e2e-provider-decline-with-reason`
- `e2e-provider-change-request-customer-approval`

## PJ-002 — Mechanic/provider change request and customer approval

Goal: handle unexpected work without silently changing price/scope.

Actors and roles:
- Primary: mechanic/provider.
- Decision maker: customer.
- Downstream: dispatcher/support for escalation, payment auth/capture stub for revised totals.

Entry point and surface:
- Current: provider lifecycle state-machine coverage and internal demo concepts.
- Future: protected provider Active Job surface plus customer booking/message approval surface.

Current implementation status:
- Mostly state-machine/docs; true two-sided UI deferred.

Related docs/features:
- `features/provider/provider-job-lifecycle.md`
- `features/provider/provider-service-reporting.md`
- `features/platform/messaging.md`
- `features/customer/checkout-payment.md`
- `architecture/state-machines.md`

State-machine checkpoints:
- Provider request: `started`/`in_progress -> customer_approval_required`.
- Customer approval: `customer_approval_required -> started`/`in_progress` with revised estimate/invoice stub.
- Customer decline: policy-defined return/cancel/partial-complete state; must not deadlock provider.

Data/privacy/comms/payment boundaries:
- Change request messages are booking-scoped and stubbed until messaging exists.
- Customer sees old/new total, reason, and safety/parts impact; internal margin/provider payout remains hidden.
- Additional authorization/capture is stubbed until payment integration starts.
- Photos/notes must not include unredacted PII in logs or audit summaries.

Click-through path:
1. Provider starts active job.
2. Provider clicks Request Approval for additional work or price change.
3. Provider enters reason, parts/labor delta, safety impact, and photo/note if available.
4. Customer receives approval request in booking view/message thread.
5. Customer approves or declines.
6. System updates estimate/invoice stub and job state.
7. Audit log records all actor decisions.

Acceptance criteria:
- Change request cannot be submitted before job start unless policy explicitly allows pre-service parts adjustment.
- Customer must see old/new total and reason before approval.
- Decline path must not trap provider in a dead-end state.
- Additional payment authorization/capture remains stubbed until payment integration starts.

E2E test candidates:
- `e2e-provider-change-request-approved`
- `e2e-provider-change-request-declined`

## AJ-001 — Dispatcher/admin assigns, monitors, escalates, and closes jobs

Goal: dispatcher/platform admin can operate the marketplace safely with clear queues, SLA risk, assignment controls, escalation, audit, and closeout.

Actors and roles:
- Primary: dispatcher/platform admin.
- Downstream: customer, provider, support, payment/refund stub.

Entry point and surface:
- Current: internal demo dispatch controls embedded below customer shell.
- Future: protected admin/dispatch route/app shell with Queue, Job Detail, Provider Assignment, Escalations, Audit, Payments/Refunds.

Current implementation status:
- Dispatch operations and assignment helpers are partly implemented/mocked with unit coverage.
- Protected admin route, live auth, and full audit/payment integration are deferred.

Click-through path:
1. Admin logs in to protected ops shell.
2. Admin opens Dispatch Queue.
   - Expected groups: unassigned, at-risk, blocked, active, completed/audit-needed.
3. Admin filters by market, fulfillment, provider, status, SLA risk.
4. Admin opens unassigned job detail.
   - Expected data: masked customer/location, service, estimate, eligible provider candidates ranked by canonical matching engine.
5. Admin assigns provider.
   - Expected guard: candidate must be eligible; no alternate ranking source should contradict provider matching.
6. Admin monitors job status.
   - Expected states: pending/assigned/en route/arrived/in progress/approval required/completed/report/invoice/paid.
7. Admin handles at-risk or blocked job.
   - Actions: reassign, escalate, cancel, resolve blocker, contact support, request provider/customer action.
8. Admin audits completion.
   - Expected: report present, invoice ready, payment/refund state clear, messages/audit log available.
9. Admin closes or flags job.

Acceptance criteria:
- Every manual admin action has actor, reason, old/new state, and timestamp.
- Admin queue displays masked, role-safe data; no raw full VIN/address/payment secrets in queue rows or logs.
- Assignment and reassignment fail closed for terminal jobs, unknown providers, missing eligibility context, no-op reassigns, and roadside partner handoffs.
- At-risk jobs are visually obvious.

E2E test candidates:
- `e2e-admin-assign-unassigned-job`
- `e2e-admin-reassign-at-risk-job`
- `e2e-admin-resolve-blocker-and-audit-closeout`

## AJ-002 — Admin/support payment, refund, dispute, and audit intervention

Goal: support/admin can resolve payment/refund/dispute issues with least-privilege access and auditable actions.

Actors and roles:
- Primary: support agent or admin.
- Downstream: customer, provider, payment/refund stub, audit log.

Entry point and surface:
- Current: RBAC/privacy readiness and audit/payment docs only.
- Future: protected Support/Admin ticket detail, payment/refund panel, audit log, and message summary surfaces.

Current implementation status:
- Deferred; auth/RBAC/privacy readiness exists, payment integration deferred.

Related docs/features:
- `features/platform/payments.md`
- `features/customer/customer-support.md`
- `features/platform/audit-log.md`
- `features/platform/auth-rbac-privacy.md`
- `architecture/state-machines.md`

State-machine checkpoints:
- Dispute can branch from `invoice_ready`, `paid`, or completed service history into `disputed`.
- Refund can move payment state toward `refunded` without changing the underlying service report.
- Support resolution closes the support ticket and appends audit metadata; it must not silently rewrite booking/job lifecycle history.

Data/privacy/comms/payment boundaries:
- Support/admin views must use least-privilege projections and redact payment secrets, raw card/bank/token data, full VIN, full address, and unnecessary raw messages.
- Refund/payment changes are mocked/test-provider only until live payments are explicitly approved.
- Customer/provider updates are stubbed until messaging/notifications exist.

Click-through path:
1. Support/admin opens job/customer support ticket.
2. Support sees role-safe customer, vehicle, provider, booking, invoice, payment status, message summary, and audit log.
3. Support categorizes issue: cancellation, refund, quality, warranty, provider no-show, payment failure, dispute.
4. Support takes permitted action or escalates to admin.
5. Admin approves refund/payment adjustment in mocked/test-provider mode.
6. Customer/provider receive status update through stubbed comms/notification.
7. Audit log records decision and reason.

Acceptance criteria:
- Refunds require permission and reason.
- Support role is limited; admin/system still redact payment secrets and private PII from display/log metadata.
- Payment status, report status, and dispute status remain separate.

E2E test candidates:
- `e2e-support-open-ticket-from-booking`
- `e2e-admin-refund-with-reason-stub`

## SJ-001 — Shop/dealership service-lane booking

Goal: future shop/dealership partner can confirm capacity, complete service-lane work, and submit report/invoice.

Actors and roles:
- Primary: customer and shop/dealership admin.
- Downstream: dispatcher/admin, payment stub, support, OEM/warranty-note data source when approved.

Entry point and surface:
- Current: conceptual fulfillment support in customer/provider comparison docs.
- Future: customer shop/dealer fulfillment path plus protected shop/dealer service-lane admin surface.

Current implementation status:
- Deferred except conceptual fulfillment support in domain docs.

Related docs/features:
- `features/operations/job-status-tracking.md`
- `features/admin/provider-management.md`
- `features/customer/provider-comparison.md`
- `features/customer/checkout-payment.md`
- `features/customer/service-report.md`
- `architecture/state-machines.md`

State-machine checkpoints:
- Customer request follows `draft -> quote_ready -> pending_confirmation`.
- Shop/dealer acceptance moves `pending_confirmation -> confirmed -> assigned` or checked-in equivalent.
- Service lane work follows checked-in/arrived equivalent through `in_progress -> completed -> report_submitted -> invoice_ready -> paid`.

Data/privacy/comms/payment boundaries:
- Shop/dealer admin sees only partner-scoped jobs and role-safe customer/vehicle/location details.
- Payment authorization/capture remains stubbed until payments are implemented.
- Dealer warranty/OEM notes must not become live data-source claims until approved integrations exist.
- Customer/shop communications are stubbed until messaging/notifications exist.

Click-through path:
1. Customer selects shop/dealer fulfillment.
2. Customer chooses eligible shop/dealer slot.
3. Shop/dealer admin receives request.
4. Shop/dealer accepts/declines with reason.
5. Customer receives confirmation/check-in instructions.
6. Vehicle is checked in.
7. Shop/dealer performs work and requests approval if scope changes.
8. Shop/dealer submits report/invoice.
9. Customer pays/receives service history record.

Acceptance criteria:
- Shop/dealer capacity determines bookability.
- Dealer warranty/OEM notes can be captured.
- Shop/dealer admin sees only partner-scoped jobs.

E2E test candidates:
- `e2e-shop-accept-service-lane-booking`
- `e2e-shop-decline-with-reason`

## Cross-journey data, privacy, payment, and comms boundaries

Privacy:
- Full VIN and full address must not be persisted in localStorage.
- Role projections must mask customer, vehicle, location, payment, message, and audit data according to actor.
- Logs/analytics must not include VIN, full address, payment secrets, raw private messages, gate codes, or contact details.

Payments:
- Until JS-818 or another explicit payment milestone, all payment auth/capture/refund/payout steps are stubbed/test-provider only.
- Customer-visible estimates must not reveal provider payouts, margin, or internal fees.
- Payout state and customer payment state are related but separate.

Messaging/comms:
- Until JS-817 or another explicit messaging milestone, messaging and notifications are stubbed/deferred.
- Future messaging must be booking-scoped, role-scoped, retained according to policy, and safe for support audit without exposing unnecessary raw PII.

Auth/RBAC:
- Role-specific customer/provider/admin/support surfaces are future/protected routes.
- Current internal demo sections must not be exposed as top-level customer navigation.
- Browser E2E should eventually verify role-specific route boundaries, not only unit-level projections.

Roadside boundary:
- Emergency roadside/tow/lockout/fuel/emergency flat-tire/emergency battery are partner-routed only.
- These paths must not create normal ReGo provider jobs, dispatch jobs, assignments, or dispatch statuses.

## Next build/test implications

1. Use this document as the source of truth for JS-787 exhaustive test strategy and Playwright setup.
2. First Playwright milestone should smoke-test current implemented/mocked surfaces:
   - customer booking start/confirmation guard
   - Car Tow partner handoff only
   - provider demo job progression guard
   - dispatcher demo assignment/escalation guard
3. Later implementation milestones should add missing role-specific routes and then upgrade these journeys from mocked/stubbed to implemented.
4. Do not mark payment, messaging, payout, refund, or production auth journeys as production-ready until their Linear milestones implement and verify real contracts.
