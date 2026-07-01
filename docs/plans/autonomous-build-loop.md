# ReGo Autonomous Build Loop

Last updated: 2026-06-30

GitHub repo: https://github.com/jsubash89/Rego-Mobile-Mechanic
Linear project: https://linear.app/js-ventures/project/rego-mobile-mechanic-ee580668ba72

## Destination success point

ReGo reaches the autonomous build-loop destination when the repo is clean; docs are the source of truth; Linear tracks every P0/P1 workstream; GitHub CI passes on `main`; the app builds from a fresh clone; and the customer booking, provider lifecycle, dispatcher/admin, and partner-roadside handoff MVP paths are implemented or explicitly deferred with documented rationale.

This is a near-production MVP readiness checkpoint, not a legal/business production launch. Human approval is still required before production payments, real customer/provider data, legal/compliance claims, warranty policy, roadside partner contracts, production secrets, and production domain rollout.

## Non-negotiable product boundaries

- Product name and framing remain ReGo Mobile Mechanic.
- The product is a marketplace/operating layer for mobile mechanics, independent shops, and dealership service.
- Emergency roadside is partner-driven only.
- ReGo must not directly operate towing, lockout, fuel delivery, emergency flat-tire response, or emergency battery dispatch.
- Any urgent-now/roadside path must route to a partner handoff layer and must not create a normal ReGo provider dispatch job.
- No feature is done unless docs, implementation, tests, and Linear status agree.

## Required destination gates

### Gate 0 — Orientation

Run before each autonomous session or reset:

```bash
cd /Users/johnnysubash/Documents/createxyz-mobile-mechanic
node scripts/context-snapshot.mjs
git status --short
git log --oneline -5
```

Read:

- `docs/PROJECT_BRIEF.md`
- `docs/plans/mobile-mechanic-build-plan.md`
- `docs/plans/rego-linear-issue-index.md`
- the relevant `docs/features/...` file for the chosen task

Exit criteria:

- Current repo status is known.
- Current product boundary is known.
- Next smallest task is known.
- Verification command is known.

### Gate 1 — Docs and Linear control plane

Required:

- Build docs remain source of truth.
- Every P0/P1 feature has a buildable feature doc.
- Linear issues link to repo docs and acceptance criteria.
- This autonomous loop doc maps the destination and reset protocol.

Exit criteria:

- Linear contains execution milestone issues for the destination.
- `docs/plans/rego-linear-issue-index.md` includes the milestone issues.
- Build sequence distinguishes docs/spec completion from implementation completion.

### Gate 2 — GitHub and CI/CD

Required:

- GitHub remote is configured.
- `.github/workflows/ci.yml` runs on `pull_request` and pushes to `main`.
- CI runs `npm ci`, lint or documented lint replacement, `npm test`, and `npm run build`.
- README documents local verification commands.

Exit criteria:

- Latest CI run on `main` passes.
- Fresh clone can run `npm ci` and `npm run build`.

### Gate 3 — Foundation implementation

Required:

- Domain data is extracted out of `src/app/page.jsx`.
- Pricing logic is extracted and tested.
- Booking/job state machines are extracted and tested.
- Provider eligibility/matching is deterministic and tested.
- Prototype persistence exists for vehicle garage, draft booking, and service history.

Exit criteria:

- `npm test` passes.
- `npm run build` passes.
- Customer booking smoke flow passes locally.

### Gate 4 — MVP journey implementation

Required:

- Customer booking MVP works end to end.
- Provider operations MVP exists.
- Dispatcher/admin MVP exists.
- Partner-roadside handoff exists and is explicitly not direct dispatch.
- Browser smoke tests cover P0 journeys.

Exit criteria:

- Customer can complete the intended booking demo.
- Emergency intent routes to partner handoff only.
- Provider can move a mock job through a guarded lifecycle.
- Dispatcher can see and manage job state.
- `npm test`, browser smoke, and `npm run build` pass.

### Gate 5 — Near-production readiness

Required:

- Auth/RBAC boundaries are documented and minimally enforced or explicitly deferred.
- Payment, notification, support, audit, privacy, and deployment boundaries are documented.
- Staging/deployment checklist exists.
- Remaining work is backlog/enhancement, not P0 readiness-critical.

Final report must include:

- latest commit hash
- git status
- verification commands and outputs
- GitHub CI run URL/status
- completed Linear issues
- deferred Linear issues and reasons
- known risks
- recommended next human decision

## Reset/token-limit protocol

Durable state lives in repo docs, commits, Linear, GitHub, and CI — not chat context.

### Reset triggers

Stop, checkpoint, and reset when any trigger occurs:

- Remaining context is below 25% and a new implementation task would be required.
- Remaining context is below 15%; only checkpoint, verify, commit/revert, and summarize.
- Remaining context is below 10%; stop all new exploration and produce handoff.
- More than one coherent task is complete without a commit.
- A product decision is required and not documented.
- Verification is failing after a bounded three-pass debugging loop.
- Working tree contains unrelated or unexplained changes.
- Product-scope drift is detected, especially around emergency roadside.
- Before switching between docs, implementation, Linear/GitHub operations, or broad refactors.
- Before ending a long autonomous session.

### Pre-reset checkpoint

Before reset:

1. Run:

```bash
node scripts/context-snapshot.mjs
git status --short
git log --oneline -5
```

2. If files changed:
   - run focused verification for the touched area
   - commit a coherent checkpoint, or revert unsafe incomplete work
   - never leave unexplained uncommitted changes

3. Update durable tracking:
   - relevant feature doc if behavior changed
   - `docs/plans/rego-linear-issue-index.md` if issues changed
   - relevant Linear issue comment with changed files, verification, commit, caveats, next task

4. Produce a handoff summary:
   - current gate/phase
   - completed task
   - next smallest task
   - files touched
   - verification status
   - blockers/product decisions

### Post-reset startup

Every fresh run starts with Gate 0, then picks the next smallest incomplete task from Linear/docs.

## Autonomous task selection order

1. Fix failing build/test/CI on main.
2. Fix product-scope violations.
3. Complete missing P0 docs.
4. Implement next P0 customer booking slice.
5. Implement P0 provider/dispatch slice.
6. Add/expand tests for implemented behavior.
7. Update Linear/GitHub traceability.
8. Move to P1/P2 only after P0 readiness is stable.

## Bounded debugging rule

For failing commands:

1. First pass: inspect the error, make the smallest fix, rerun focused command.
2. Second pass: inspect related code/config, make the smallest fix, rerun.
3. Third pass: if still failing and root cause is unclear, stop and produce a blocker report.

Blocker report must include failing command, exact error summary, suspected root cause, files inspected, attempted fixes, and recommended next step.

## Current execution milestones

The milestone issues are tracked in Linear and indexed in `docs/plans/rego-linear-issue-index.md`.

1. Autonomous build control plane and CI/CD readiness map.
2. GitHub CI workflow and release gates.
3. Domain data extraction and contracts.
4. Estimate/pricing engine.
5. Booking and job state machines.
6. Provider eligibility and matching engine.
7. Draft booking, vehicle garage, and service-history persistence.
8. Customer booking MVP hardening.
9. Provider operations MVP.
10. Admin/dispatch operations MVP.
11. Partner-routed emergency roadside handoff.
12. Auth/RBAC, privacy boundaries, and deployment-readiness checklist.
