# ReGo Mobile Mechanic Documentation

This directory is the build control plane for ReGo Mobile Mechanic.

Principle: the product should be buildable from documents. Every meaningful feature must have a document that defines user journeys, business rules, data/API contracts, UI states, acceptance criteria, and tests.

Start here:

1. `PROJECT_BRIEF.md` — current product direction and verified baseline.
2. `product/user-journeys.md` — canonical customer, provider, shop/dealer, dispatcher, admin, and support journeys.
3. `features/README.md` — feature-document index and ownership map.
4. `architecture/state-machines.md` — canonical booking/job lifecycle.
5. `quality/test-strategy.md` — exhaustive testing and release gates.
6. `plans/mobile-mechanic-build-plan.md` — implementation sequence.

Build rule:
- No new feature without a doc.
- No implementation without acceptance criteria.
- No acceptance without tests mapped to journey coverage.
- If implementation contradicts docs, update docs or fix implementation before continuing.
