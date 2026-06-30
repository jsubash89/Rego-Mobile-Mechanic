# AssistMe Build Implementation Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task. Keep each run bounded: load this plan, run the context snapshot script, pick the next incomplete task, implement, verify, commit, and update Linear.

Goal: Turn the abandoned create.xyz export into a useful AssistMe recruiting workflow product, starting with a strong prototype and moving toward integration-ready architecture.

Architecture: Next.js app router frontend with journey data separated from presentation. Phase 1 remains static/mock-data only but models the exact records, events, owners, and write-backs needed for later Bullhorn/Herefish/Calendly/Candidately/Hinterview/Granola integrations.

Tech Stack: Next.js, React, TailwindCSS, Node/npm, Linear for backlog, Git for checkpoints.

---

## Long-duration loop design

This project should not depend on one giant chat context. Every work session should reconstruct state from artifacts:

1. Run `node scripts/context-snapshot.mjs` from the repo root.
2. Read `docs/PROJECT_BRIEF.md` and this plan.
3. Check git status and latest commits.
4. Check Linear issues linked to AssistMe.
5. Pick the smallest next task.
6. Implement and verify with `npm run build` at minimum.
7. Commit a small checkpoint.
8. Add a Linear comment with what changed, verification output, and next task.

Context reset is a feature: the repo, docs, commits, and Linear are the durable memory.

---

## Task 1: Stabilize the imported app shell

Objective: Make the abandoned create.xyz export build and remove irrelevant generated wiring.

Files:
- Modify: `package.json`
- Modify: `src/app/page.jsx`
- Modify: `src/app/layout.js`
- Modify: `src/utilities/runtime-helpers.js`
- Delete: `src/middleware.js`

Steps:
1. Rename the app package to `assistme-platform-prototype`.
2. Replace the Mobile Mechanic page with an AssistMe candidate journey command center.
3. Import React hooks explicitly.
4. Remove undefined references like `autoShops` and generated create.xyz middleware.
5. Fix `runtime-helpers.js` to export `useUpload`, not undefined `rawUseUpload`.
6. Run `npm install`.
7. Run `npm run build`.
8. Commit with `feat: convert create export into AssistMe prototype`.

Status: Done in the first pass.

---

## Task 2: Extract data from page component

Objective: Separate journey data from UI so future tests and integrations can use it.

Files:
- Create: `src/data/journey.js`
- Create: `src/data/systems.js`
- Modify: `src/app/page.jsx`

Steps:
1. Move `phases`, `systems`, and `metrics` out of `page.jsx`.
2. Export `getAllJourneySteps()` from `src/data/journey.js`.
3. Update `page.jsx` imports.
4. Run `npm run build`.
5. Commit with `refactor: extract AssistMe journey data`.

Verification:
- Build passes.
- Page still renders all four phases and 18 steps.

---

## Task 3: Add basic tests for journey integrity

Objective: Make the 18-step process executable as data, not just prose.

Files:
- Modify: `package.json`
- Create: `src/data/journey.test.mjs`

Steps:
1. Add a `test` script using Node's built-in test runner.
2. Test that there are exactly 18 steps.
3. Test that required owners exist: Bullhorn, Herefish, Calendly, Candidately, Hinterview, Granola.
4. Test that every step has `number`, `title`, `owner`, `happens`, `stored`, and `status`.
5. Run `npm test`.
6. Run `npm run build`.
7. Commit with `test: cover AssistMe journey data integrity`.

Verification:
- `npm test` passes.
- `npm run build` passes.

---

## Task 4: Add recruiter operating view

Objective: Add a second panel focused on what the recruiter needs to do next.

Files:
- Create: `src/data/mock-candidates.js`
- Modify: `src/app/page.jsx`

Steps:
1. Create 4 mock candidates across Applied, Screening Requested, Screen Scheduled, and Client Ready.
2. Render a recruiter queue below the journey.
3. Show candidate stage, role type, source, next action, and missing data.
4. Add visual warnings for incomplete packages or unconfirmed note capture.
5. Run `npm run build`.
6. Commit with `feat: add recruiter operating queue`.

Verification:
- Recruiter can see candidate next action without reading the full journey.
- Build passes.

---

## Task 5: Add event/audit model

Objective: Model write-backs and handoffs before real integrations are built.

Files:
- Create: `src/data/events.js`
- Modify: `src/app/page.jsx`

Steps:
1. Define mock events for stage changes, scheduling sends, booking write-backs, package submissions, portal review, and interview booking.
2. Render an audit timeline with source system, target system, event type, and written fields.
3. Highlight events that write back to Bullhorn.
4. Run `npm run build`.
5. Commit with `feat: add integration event timeline`.

Verification:
- Each event has a source, target, timestamp, and stored fields.
- Build passes.

---

## Task 6: Prepare integration adapter stubs

Objective: Create safe boundaries for future API work without wiring credentials yet.

Files:
- Create: `src/lib/integrations/bullhorn.js`
- Create: `src/lib/integrations/herefish.js`
- Create: `src/lib/integrations/calendly.js`
- Create: `src/lib/integrations/candidately.js`
- Create: `src/lib/integrations/hinterview.js`
- Create: `src/lib/integrations/granola.js`
- Create: `src/lib/integrations/README.md`

Steps:
1. Add no-network adapter functions that throw clear `Not implemented` errors.
2. Document expected inputs and outputs for each integration.
3. Do not add credentials or real API calls.
4. Run `npm run build`.
5. Commit with `chore: add integration adapter boundaries`.

Verification:
- Build passes.
- Integration README describes environment variables needed later.

---

## Task 7: Add CI once a GitHub remote exists

Objective: Make every branch verify automatically.

Files:
- Create: `.github/workflows/ci.yml`

Steps:
1. Add npm cache setup.
2. Run `npm ci`.
3. Run `npm test` once Task 3 exists.
4. Run `npm run build`.
5. Commit with `ci: add build verification workflow`.

Verification:
- GitHub Actions passes on push.

---

## Open product questions

- Should the first deploy be an internal demo, recruiter command center, or client-facing portal shell?
- Which Bullhorn objects and custom fields already exist vs. need creation?
- Is Granola the confirmed note-taking mechanism for phone screens?
- What auth model is expected for admins/recruiters/clients/candidates?
- Should Candidately remain the long-term client portal or only the Phase 1 bridge?
