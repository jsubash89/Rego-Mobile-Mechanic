# Auth, RBAC, and Privacy Boundaries

Status: JS-834 near-production readiness guardrail. No real backend auth provider is added in this milestone.

This document defines the minimum role model, data boundaries, privacy gates, and feature-flag policy for ReGo Mobile Mechanic until a production identity provider, API, and data store are selected.

## Roles

| Role | Purpose | Minimum enforcement in this repo | Deferred production enforcement |
| --- | --- | --- | --- |
| Customer | Books service, manages own vehicles, views own bookings/history. | Pure helpers allow access only when `actor.customerId === record.customerId`; projections hide raw VIN/address/payment/message fields. | Server-side session validation, row-level ownership checks, route middleware, customer account recovery. |
| Provider | Views accepted/assigned jobs, own profile, availability, and payout summaries. | Pure helpers allow read-only assigned job access and own provider-profile access only when `actor.providerId` matches the record; generic provider booking/job/message writes fail closed until a modeled provider action/transition permission exists. Provider projections expose masked customer/vehicle data only. | Provider auth, compliance state checks, assignment API authorization, payout-provider authorization. |
| Dispatcher | Operates live job queue, assignment, exceptions, and SLA recovery. | Pure helpers grant operations access to booking/job/provider/audit records; operational projections still remove raw sensitive containers. | Server-side RBAC policies, audited override workflows, least-privilege route groups. |
| Admin | Manages platform configuration, service catalog, providers, pricing rules, and operations records. | Pure helpers grant broad operations/admin permissions; raw sensitive containers are excluded from projected records. | Tenant/environment scoping, admin MFA, approval workflows, immutable audit log. |
| Support | Helps customers/providers with limited read-only context. | Pure helpers allow read-only limited booking/job/provider views; payment, full vehicle, and message-body access is denied. | Case-based access windows, support reason capture, redaction-aware CRM integration. |
| System | Runs internal jobs, audits, schedulers, and future integration webhooks. | Pure helpers recognize `system` as internal-only and allow system/audit permissions. | Signed jobs/webhooks, service-to-service auth, replay/idempotency controls. |

The implementation lives in `src/lib/access-control.js` and is intentionally pure so it can be reused by future API handlers, route loaders, and tests without introducing auth UI or credentials.

## Route and data permissions

Current app routes are a customer-shell prototype. Production routes must apply these rules server-side before returning data.

| Data/route family | Customer | Provider | Dispatcher | Admin | Support | System |
| --- | --- | --- | --- | --- | --- | --- |
| Customer booking | Own only | Assigned job summary only | Operations view | Operations/admin view | Limited read-only support view | Internal jobs only |
| Vehicle garage | Own only | Masked vehicle summary for assigned job | Masked operations view | Masked operations view | No raw vehicle data | Internal jobs only |
| Provider jobs | No | Assigned only | Read/assign/reassign per dispatch rules | Read/manage | Limited read-only | Internal jobs only |
| Provider profile | Public/comparison fields only | Own profile | Operations view | Manage | Limited read-only | Internal jobs only |
| Payments | Own checkout status only when enabled | Payout summary only when enabled | Status only | Status/config only | Denied | Provider webhooks/jobs only |
| Messaging | Conversation participant only when enabled | Conversation participant only when enabled | Escalation/moderation when enabled | Escalation/moderation when enabled | Metadata only; body denied | Delivery jobs only |
| Notifications | Own preferences when enabled | Own preferences when enabled | Operational notifications | Manage templates/config | No template secrets | Delivery jobs only |
| Audit log | Own visible lifecycle events only | Own visible lifecycle events only | Write/read operations events | Write/read/manage | Write support events only | Write internal events |

## Enforced now

- Role constants and permission constants for customer, provider, dispatcher, admin, support, and system.
- `canAccessRecord(actor, record, action)` for customer/provider/admin/dispatcher/support/system data-boundary checks.
- `projectRecordForRole(actor, record)` for least-privilege record projections.
- `sanitizeOperationalRecord(record)` to remove raw customer, vehicle, payment, message, VIN, address, contact, access/location note, license plate, payout/bank/account, token, secret, password, and API key fields from operational projections and replace safe customer/vehicle details with masked summaries.
- `sanitizeLogMetadata(metadata)` to redact VIN/license plate, address, access/location instructions/notes, phone/email, payment/card/payout/bank/account, message/body/text/note, token/secret/password/API key fields before analytics, audit details, console logging, or error metadata.
- Unit tests for customer/provider/admin/support boundaries and sensitive metadata redaction.

## Explicitly deferred

- Production identity provider, login/signup UI, passwordless/OAuth flows, MFA, and session storage.
- Backend API authorization, database row-level security, route middleware, and audit-log persistence.
- Payment processor, messaging vendor, notification provider, webhook handlers, and related secrets.
- Admin/support impersonation tooling. If added later, it must be case-scoped, time-limited, audited, and redaction-aware.

## Privacy and logging gates

Never write these raw fields to console logs, analytics events, audit metadata, browser storage, or error reports:

- Full VIN or license plate.
- Exact service address, gate/access instructions, or location notes.
- Payment method, processor secret, card data, payment intent secret, payout account, bank data.
- Private message body, conversation transcript, chat text, support note details.
- Customer phone/email unless a documented support workflow explicitly requires a masked or tokenized value.
- Tokens, secrets, passwords, or API keys.

Allowed low-risk operational substitutes:

- `vinMasked`, e.g. `VIN ending 123456`.
- `addressSummary`, e.g. `Chicago, IL` or `Service area only`.
- Payment status and non-sensitive amounts, e.g. `authorized`, `captured`, or customer total.
- Message metadata, e.g. unread count, timestamp, participant IDs, escalation status, with body redacted.

Any new logging or analytics helper must pass event metadata through `sanitizeLogMetadata` or an equivalent server-side redactor before emission.

## Feature flags and provider-choice boundaries

Payments, messaging, and notifications remain disabled/stubbed until provider choices are made and documented.

| Capability | Flag | Safe local default | Current policy |
| --- | --- | --- | --- |
| Payments | `NEXT_PUBLIC_ENABLE_PAYMENTS` | `false` | Keep checkout/payment processor work stubbed; do not collect card data. |
| Messaging | `NEXT_PUBLIC_ENABLE_MESSAGING` | `false` | Keep private message body flows stubbed; do not persist transcripts. |
| Notifications | `NEXT_PUBLIC_ENABLE_NOTIFICATIONS` | `false` | Keep SMS/email/push sending stubbed; do not add provider keys. |

Only `"true"` or `"1"` enables a flag in `requireFeatureFlag`. Provider-specific secret names must be added to the deployment env contract before any integration code is merged.

## Test expectations

- Unit tests must cover every helper that grants or denies role-scoped access.
- Tests for implemented boundaries must include at least customer, provider, and admin cases.
- Support must remain read-only until a support workflow is explicitly implemented.
- Sensitive VIN/license plate, address/access/location, contact, payment/payout/bank/account, message/note, token/secret/password/API key data must be absent or redacted in projected records and log metadata.

## Acceptance checklist for future auth work

- Server enforces every rule in this document; client checks are only UX hints.
- Unauthorized responses are fail-closed and do not reveal whether another user's record exists.
- Every privileged write includes actor ID, role, reason where applicable, timestamp, old/new state, and request ID.
- Audit entries store redacted metadata only.
- Browser storage contains no secrets and no full VIN/address/payment/message data.
