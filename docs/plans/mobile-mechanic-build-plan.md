# Mobile Mechanic Marketplace Implementation Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task. Keep each run bounded: run the context snapshot script, read this plan, implement the next smallest task, verify, commit, and update Linear if a Mobile Mechanic backlog exists.

Goal: Turn the rough create.xyz Mobile Mechanic mockup into a working marketplace MVP for booking vetted mobile mechanics, shops, and dealership service options.

Architecture: Next.js app router frontend with service, provider, vehicle, estimate, and booking-state data separated from presentation. Start with static/mock data and harden the UX before adding persistence, auth, payments, or real provider integrations.

Tech Stack: Next.js, React, TailwindCSS, Node/npm, Git. Linear optional until a Mobile Mechanic project/backlog is confirmed.

---

## Long-duration loop design

The loop must survive context resets. Durable state lives in repo artifacts, commits, and Linear — not chat context.

1. Run `node scripts/context-snapshot.mjs` from repo root.
2. Read `docs/PROJECT_BRIEF.md` and this plan.
3. Check `git status` and latest commits.
4. Pick the next incomplete task.
5. Implement the smallest coherent slice.
6. Verify with `npm run build` at minimum.
7. Commit a small checkpoint.
8. If Linear backlog exists, comment with what changed, verification output, and next task.

---

## Market research inputs

Read `docs/research/market-research.md` before refining any P0 feature doc or implementation task. It adds competitor benchmarks, customer pain points, provider operations constraints, pricing/estimate requirements, VIN/parts fitment, recall/warranty routing, and compliance implications.

Research-driven product requirements now emphasized:
- VIN/plate-first vehicle profile and recall/dealer routing.
- Fixed/range/TBD estimate model with written authorization and change-order approval.
- Mobile eligibility rules per service, vehicle, provider skill, tools, location, and parts readiness.
- Provider trust/compliance: ASE/certifications, insurance COI, licenses, background/verification, warranty.
- Dispatch logic must account for travel time, buffers, route density, parts readiness, and SLA risk.
- Diagnostic flow should separate “I know what I need” from “something is wrong.”

---

## Task 1: Restore Mobile Mechanic direction

Objective: Correct the mistaken AssistMe pivot and rebuild the page as a Mobile Mechanic marketplace prototype.

Files:
- Modify: `package.json`
- Modify: `src/app/layout.js`
- Modify: `src/app/page.jsx`
- Modify: `docs/PROJECT_BRIEF.md`
- Modify: `docs/plans/mobile-mechanic-build-plan.md`

Steps:
1. Rename package to `mobile-mechanic-marketplace`.
2. Update metadata to Mobile Mechanic.
3. Replace AssistMe page with booking-marketplace UI.
4. Include service selection, fulfillment choice, oil options, provider comparison, booking summary, vehicle profile, and service history.
5. Run `npm install --package-lock-only`.
6. Run `npm run build`.
7. Commit with `feat: restore mobile mechanic marketplace prototype`.

Status: Done in the correction pass.

---

## Task 2: Extract domain data from the page

Objective: Separate data from UI so tests and future backend work can use it.

Files:
- Create: `src/data/services.js`
- Create: `src/data/providers.js`
- Create: `src/data/vehicles.js`
- Create: `src/data/fulfillment.js`
- Modify: `src/app/page.jsx`

Steps:
1. Move services, fulfillment options, oil options, providers, initial vehicle, and history out of page.
2. Export named constants.
3. Keep the UI behavior unchanged.
4. Run `npm run build`.
5. Commit with `refactor: extract mobile mechanic domain data`.

Verification:
- Build passes.
- UI still shows all services, fulfillment options, providers, vehicle, and history.

---

## Task 3: Add pricing and booking tests

Objective: Make estimate calculation trustworthy before adding payments.

Files:
- Create: `src/lib/pricing.js`
- Create: `src/lib/pricing.test.mjs`
- Modify: `package.json`
- Modify: `src/app/page.jsx`

Steps:
1. Add `calculateEstimate({ service, oil, fulfillment })`.
2. Move price math out of page into the helper.
3. Add Node built-in test runner script: `"test": "node --test src/**/*.test.mjs"`.
4. Test oil change with recommended oil returns `partsTbd: true`.
5. Test fixed oil option includes parts cost.
6. Test fulfillment fee and platform fee are included.
7. Run `npm test`.
8. Run `npm run build`.
9. Commit with `test: cover mobile mechanic estimate calculation`.

Verification:
- `npm test` passes.
- `npm run build` passes.

---

## Task 4: Add booking state machine

Objective: Turn the flow into explicit states instead of loose component state.

Files:
- Create: `src/lib/booking-state.js`
- Create: `src/lib/booking-state.test.mjs`
- Modify: `src/app/page.jsx`

Steps:
1. Define states: `select_service`, `select_fulfillment`, `select_parts`, `select_provider`, `review`, `confirmed`.
2. Define transitions based on service type and required fields.
3. Use the state machine to drive the visible step labels and confirm button behavior.
4. Add tests for oil-change path and non-oil service path.
5. Run `npm test`.
6. Run `npm run build`.
7. Commit with `feat: add booking state machine`.

Verification:
- Cannot confirm without service, fulfillment, provider, vehicle, and time.
- Oil-change path includes parts/oil step.
- Non-oil services skip oil preference.

---

## Task 5: Add provider dispatch/admin view

Objective: Show the operator side of the marketplace.

Files:
- Create: `src/data/jobs.js`
- Modify: `src/app/page.jsx`

Steps:
1. Add a new `dispatch` tab.
2. Render pending, assigned, en route, in progress, completed, and canceled jobs.
3. Show SLA, provider, customer, vehicle, service, location, and gross margin placeholder.
4. Run `npm run build`.
5. Commit with `feat: add dispatch operations view`.

Verification:
- Dispatcher can see which jobs need action.
- Build passes.

---

## Task 6: Add persistence

Objective: Preserve vehicle edits and draft booking state across refresh.

Files:
- Create: `src/lib/local-storage.js`
- Modify: `src/app/page.jsx`

Steps:
1. Add safe localStorage helpers that no-op during SSR.
2. Persist vehicle profile, address, selected service, fulfillment, provider, oil option, and appointment time.
3. Add a reset draft button.
4. Run `npm run build`.
5. Browser smoke test: edit vehicle, refresh, confirm persistence.
6. Commit with `feat: persist draft booking locally`.

Verification:
- Draft survives browser refresh.
- Build passes.

---

## Task 7: Add real backlog / CI once project ownership is confirmed

Objective: Make development trackable and automatically verified.

Files:
- Create: `.github/workflows/ci.yml`

Steps:
1. Confirm Linear project/team naming for Mobile Mechanic.
2. Create Linear issues from this plan.
3. Add GitHub remote if desired.
4. Add CI: npm ci, npm test, npm run build.
5. Commit with `ci: add mobile mechanic verification workflow`.

Verification:
- GitHub Actions passes on push.

---

## Open product questions

- Is the MVP customer-facing booking only, or should provider/dispatcher ops ship in the first demo?
- What city/market should mock providers represent?
- Should pricing be exact, estimate-only, or provider-confirmed after VIN/parts check?
- Does payment capture happen at booking, after provider confirmation, or after service completion?
- Are providers employees, contractors, partner shops, or a mix?
- Should dealership booking be real integration, lead/referral, or curated quote request?
