# ReGo Mobile Mechanic Documentation

This directory is the build control plane for ReGo Mobile Mechanic.

Principle: the product should be buildable from documents. Every meaningful feature must have a document that defines user journeys, business rules, data/API contracts, UI states, acceptance criteria, and tests.

Start here:

1. `PROJECT_BRIEF.md` — current product direction and verified baseline.
2. `product/user-journeys.md` — canonical customer, provider, shop/dealer, dispatcher, admin, and support journeys.
3. `research/market-research.md` — competitor, market, customer-need, and provider-operations research.
4. `research/automotive-data-sources.md` — open/free vs curated/provider-confirmed vs deferred commercial automotive data policy.
5. `plans/autonomous-build-loop.md` — near-production MVP destination, phase gates, and reset/token-limit protocol.
6. `features/README.md` — feature-document index and ownership map.
7. `features/platform/auth-rbac-privacy.md` — role matrix, data permissions, privacy/logging gates, and feature flags.
8. `operations/deployment-readiness.md` — environment contract, release checks, rollback, and post-deploy smoke.
9. `architecture/state-machines.md` — canonical booking/job lifecycle.
10. `quality/test-strategy.md` — exhaustive testing and release gates.
11. `plans/mobile-mechanic-build-plan.md` — implementation sequence.

Build rule:
- No new feature without a doc.
- No implementation without acceptance criteria.
- No acceptance without tests mapped to journey coverage.
- If implementation contradicts docs, update docs or fix implementation before continuing.

## JS-784 control-plane acceptance

JS-784 can close only when the build control plane remains testable and traceable:

- This `docs/` tree is the source of truth for ReGo product behavior and implementation boundaries.
- Feature documents must include acceptance criteria and test-plan pointers before related implementation is considered complete.
- `plans/autonomous-build-loop.md`, `plans/autonomous-linear-milestones.md`, and `plans/rego-linear-issue-index.md` must stay synchronized with Linear milestone/issue status.
- Product boundaries remain intact: emergency roadside is partner-routed only, and live auth, payments, messaging, location, VIN/recall, fitment, and commercial automotive integrations stay deferred until explicitly scoped.
- Local verification before Done is `npm test`, `npm run lint`, and `npm run build`; remote CI must pass before any issue is moved to Done.
