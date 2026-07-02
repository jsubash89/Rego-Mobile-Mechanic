# ReGo Autonomous Build Loop

Last updated: 2026-07-02

Current control-plane status: JS-823 is in progress for this docs refresh. JS-824 through JS-837 are complete on `main` as of commit `f11f109`, with the latest pushed GitHub CI green at https://github.com/jsubash89/Rego-Mobile-Mechanic/actions/runs/28608880203 before this local docs-only checkpoint is pushed.

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

Milestone completion means the named issue's acceptance criteria, implementation, tests, docs, and Linear state agree. Spec/doc completion alone means the repo has a buildable source-of-truth plan, but the feature remains incomplete until implementation and verification land. Implementation completion alone is also insufficient if the docs, tests, release-gate notes, or Linear status are stale.

| Order | Issue | Status | Milestone | Verification expectations | Release-gate impact |
| --- | --- | --- | --- | --- | --- |
| 1 | JS-823 | In Progress | Autonomous build control plane and CI/CD readiness map | Docs-only verification: `npm test`, `npm run lint`, `npm run build`; confirm this file and `rego-linear-issue-index.md` name the destination, gates, selection order, reset protocol, non-goals, partner-roadside boundary, and current milestone sequence. | Gate 1 control-plane source of truth; does not by itself complete product implementation. |
| 2 | JS-824 | Done | GitHub CI workflow and release gates | CI workflow runs `npm ci`, lint, tests, and build on pull requests and pushes to `main`; latest `main` CI is green. | Gate 2 release verification baseline. |
| 3 | JS-825 | Done | Domain data extraction and contracts | Domain constants/contracts are out of page UI and covered by unit tests; build remains green. | Gate 3 foundation: reduces UI coupling before feature hardening. |
| 4 | JS-826 | Done | Estimate/pricing engine | Pricing/TBD/change-order rules have focused unit coverage and build verification. | Gate 3 foundation: booking can show explainable estimates without live payments. |
| 5 | JS-827 | Done | Canonical booking and job state machines | Booking/job transition tests cover allowed, blocked, and terminal states. | Gate 3 foundation: customer, provider, and dispatcher flows share one lifecycle model. |
| 6 | JS-828 | Done | Provider eligibility and matching engine | Deterministic eligibility/matching tests cover service capability, market, fulfillment, and safety constraints. | Gate 3 foundation: matching is predictable before dispatch UX. |
| 7 | JS-829 | Done | Draft booking, vehicle garage, and service-history persistence | Prototype persistence tests cover draft booking, saved vehicles, service history, privacy-sensitive normalization, and safe restore behavior. | Gate 3 foundation: customer continuity without production auth or backend storage. |
| 8 | JS-830 | Done | Customer booking MVP hardening | Customer booking smoke/flow coverage verifies service selection, vehicle, fulfillment, estimate, schedule, confirmation, and guarded mock data. | Gate 4 customer MVP path. |
| 9 | JS-831 | Done | Provider operations MVP | Provider job inbox/lifecycle/reporting behavior is tested with mock jobs and guarded state transitions. | Gate 4 provider MVP path. |
| 10 | JS-832 | Done | Admin/dispatch operations MVP | Dispatcher/admin tests or smoke checks verify job visibility, assignment/status management, and no unauthorized emergency-roadside dispatch. | Gate 4 operations MVP path. |
| 11 | JS-833 | Done | Partner-routed emergency roadside handoff | Tests and docs assert urgent roadside routes only to partner handoff and never creates a ReGo booking, provider job, dispatch job, assignment, or dispatch status. | Gate 4 scope guard: emergency roadside remains partner-routed only. |
| 12 | JS-834 | Done | Auth/RBAC, privacy boundaries, and deployment-readiness checklist | Docs/checklist cover auth/RBAC, privacy, deployment, payment/notification/support/audit boundaries, and explicit deferrals; tests continue to use mocks. | Gate 5 near-production readiness map; not a production launch approval. |
| 13 | JS-835 | Done | Automotive data source strategy and MVP integration policy | Research/docs define NHTSA/static/provider-confirmed data policy, mock external APIs in tests/CI, VIN/address privacy boundaries, and data-source deferrals. | Gate 5 data-policy guardrail for vehicle identity, recalls, pricing, and fitment. |
| 14 | JS-836 | Done | Restore create.xyz-inspired ReGo UX shell while preserving engines | UI verification confirms the ReGo shell matches the create.xyz-inspired north-star structure without restoring generated create.xyz middleware or off-scope AssistMe framing. | Gate 4 UX readiness: customer-facing shell supports the MVP flows. |
| 15 | JS-837 | Done | Polish create.xyz customer UX fidelity | UX checks verify simple Uber-inspired, female-friendly customer polish against `Screenshots/` north-star references while preserving mock-only external integrations. | Gate 4/Gate 5 demo readiness: raises customer confidence without implying live auth, payment, messaging, or production data handling. |

### Future backlog after the current completed sequence

- Convert remaining P0/P1 feature specs into implementation only when a milestone starts and acceptance criteria, docs, tests, and Linear can be kept in sync.
- Keep live auth, payment, messaging, notifications, partner dispatch, production secrets, and production customer/provider data deferred unless a future milestone explicitly starts them.
- Continue using mocked external APIs in tests and CI; do not add network-dependent tests for VIN decode, payments, maps, messaging, or roadside partners.
- Preserve privacy constraints around VIN, address, confirmed restore, and eligibility normalization.
