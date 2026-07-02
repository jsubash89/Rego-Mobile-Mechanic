# Deployment Readiness Checklist

Status: JS-834 baseline. This is a readiness contract for the current frontend prototype and documented/stubbed platform capabilities. No production secrets are required for local development.

## Environment variable contract

Safe local defaults should be used in `.env.local` when needed. Do not commit real secrets.

| Variable | Required locally | Safe local default | Scope | Notes |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | No | Set by Next/npm | Server/client build | Use `production` only in deployed build/runtime. |
| `NEXT_PUBLIC_APP_ENV` | No | `local` | Client | Human-readable environment label; allowed values: `local`, `preview`, `production`. |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Client | Used by smoke checks and future canonical links. |
| `NEXT_PUBLIC_ENABLE_PAYMENTS` | No | `false` | Client | Payments must remain stubbed/disabled until a provider is selected and security review is complete. |
| `NEXT_PUBLIC_ENABLE_MESSAGING` | No | `false` | Client | Messaging must remain stubbed/disabled until provider, retention, moderation, and privacy rules are selected. |
| `NEXT_PUBLIC_ENABLE_NOTIFICATIONS` | No | `false` | Client | SMS/email/push sending must remain stubbed/disabled until provider and consent rules are selected. |
| `NEXT_PUBLIC_DEMO_ACCESS_COPY` | No | `true` | Client | Allows demo-only explanatory copy; must not imply real auth or payments exist. |

Future provider variables, such as auth issuer/client ID, payment public key, webhook secret, email/SMS keys, maps keys, and observability DSNs, must be added here before code depends on them. Secrets must be server-only unless explicitly prefixed `NEXT_PUBLIC_` and reviewed as safe to expose.

## Local preflight

1. Confirm working tree and dependencies:
   - `git status --short`
   - `npm ci`
2. Run static and unit gates:
   - `npm run lint`
   - `npm test`
3. Build production assets:
   - `npm run build`
4. Browser smoke:
   - Start the app with `npm run dev` for local development or `npm run start` after a production build.
   - Open `http://localhost:3000`.
   - Verify the customer shell renders without console errors.
   - Verify primary CTA, service cards, booking summary, provider/dispatch demo areas, and mobile viewport are visible and usable.
5. Accessibility smoke:
   - Keyboard tab through the page from top to bottom.
   - Confirm focus is visible, buttons/links have understandable names, and dialogs/interactive sections are reachable.
   - Run an axe/Lighthouse scan where browser tooling is available; no critical violations should ship.
6. Privacy smoke:
   - Inspect console output and test fixtures for raw VIN, exact address, payment secret/card data, and private message body leaks.
   - Confirm new analytics/log metadata is redacted via `sanitizeLogMetadata` or equivalent.

## Preview deploy checklist

- `npm ci` completes on a clean checkout.
- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes.
- Environment variables are present with safe values; feature flags for payments/messaging/notifications are `false` unless explicitly approved.
- No secrets are committed or exposed through `NEXT_PUBLIC_` variables.
- Browser smoke passes on the preview URL.
- Accessibility smoke passes on desktop and mobile widths.
- Privacy smoke confirms VIN/address/payment/message data are absent from logs.

## Production deploy checklist

Before promotion:

- Confirm the exact commit SHA and release notes.
- Confirm all preview deploy checklist items passed on the immutable preview artifact.
- Confirm auth/payment/messaging/notification providers remain stubbed or feature-flagged off unless a separate provider-selection issue has approved them.
- Confirm environment variables match this contract and production-only secrets are configured in the hosting provider, not the repo.
- Confirm rollback target: last known good deployment URL/SHA and owner authorized to trigger rollback.
- Confirm monitoring owner and post-deploy smoke owner.

Deploy:

- Promote the tested artifact; do not rebuild from a different SHA when the hosting platform supports artifact promotion.
- Record deployment URL, SHA, start/end time, and operator.

Post-deploy smoke:

- Load the production URL in a clean browser session.
- Verify home/customer shell renders.
- Verify mobile viewport layout remains usable.
- Verify primary customer booking path demo interactions still work.
- Verify feature-flagged payments, messaging, and notifications do not expose live provider UI or collect sensitive data.
- Verify no new client console errors or server errors.
- Verify logs do not include raw VIN/address/payment/message data.

## Rollback checklist

Rollback immediately if production shows broken rendering, inaccessible primary actions, privacy leaks, unauthorized data exposure, or failed core smoke.

1. Announce rollback in the release channel with reason and current SHA.
2. Revert to the last known good artifact/SHA through the hosting provider.
3. Re-run post-deploy smoke on the rollback URL.
4. Open or update the incident/bug with failed checks, screenshots/log snippets with sensitive data redacted, owner, and next action.
5. Keep risky feature flags disabled until root cause is fixed and verified.

## Release blockers

- Failing `npm ci`, lint, tests, build, browser smoke, or accessibility smoke.
- Any raw VIN, exact address, payment/card/processor secret, or private message body in logs/analytics/errors.
- Live payments, messaging, or notifications without provider choice, env contract, privacy review, and rollback plan.
- Any implemented auth/RBAC path that allows customer/provider/admin data boundary bypass.
