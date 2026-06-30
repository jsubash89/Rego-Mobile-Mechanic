# AssistMe Platform Prototype — Project Brief

## Source material inspected

- Local create.xyz export: `/Users/johnnysubash/Downloads/createxyz-project`
- Working copy created at: `/Users/johnnysubash/Documents/createxyz-mobile-mechanic`
- AssistMe narrative PDF: `/Users/johnnysubash/Downloads/AssistMe Narrative Flow - Final Pre Build.pdf`
- AssistMe diagrams PDF: `/Users/johnnysubash/Downloads/AssistMe_Diagrams.pdf`
- Linear project found: `AssistMe` in JS Ventures

## What the imported code was

The create.xyz export was a very early single-page Next.js mockup. It was branded as a generic "Mobile Mechanic" booking flow and was not production-ready:

- `src/app/page.jsx` referenced `useState` without importing it.
- Several UI states were declared but never rendered.
- `autoShops` was referenced but undefined.
- The create.xyz middleware rewrote `/integrations/*` to create.xyz and was unnecessary for an owned app.
- `src/utilities/runtime-helpers.js` exported `rawUseUpload`, which was not defined.
- Next.js 14.0.4 had multiple audit findings.

## Product direction inferred from actual AssistMe docs

The project should be rebuilt as an AssistMe recruiting workflow platform, not as the imported Mobile Mechanic mockup.

Core product model:

- Bullhorn is the system of record.
- Herefish is the orchestration layer.
- Calendly handles recruiter screen and client interview scheduling.
- Candidately is the branded client shortlist portal.
- Hinterview handles candidate video introductions and recorded interviews.
- Granola is the structured note capture path for phone screens.

The first valuable build target is a clean prototype / command center that makes the 18-step journey explicit and gives the future backend model a stable shape.

## Current implemented baseline

The first pass converts the broken create.xyz app into a buildable AssistMe candidate journey command center:

- Interactive 18-step journey organized into four phases.
- System architecture cards for the six-tool stack.
- Selected-step details showing owner, event, stored data, and status.
- Updated metadata and package name.
- Removed the create.xyz middleware rewrite.
- Fixed the undefined helper export.
- Upgraded Next.js via `npm audit fix --force` to `next@^16.2.9`.

## Verification already run

- `npm install`
- `npm run build`

Latest build result: passing.

Known remaining caveat: npm audit still reports moderate issues against Next/PostCSS advisories even after upgrading to `next@^16.2.9`; npm reports no non-breaking fix path and suggests a breaking/downgrade path. Treat this as a dependency-monitoring item rather than a blocker for the static prototype.

## Next direction

Build from prototype to useful product in this order:

1. Stabilize app shell, visual hierarchy, responsive behavior, and docs.
2. Extract journey, systems, statuses, and events into typed data modules.
3. Add candidate and recruiter views with realistic mock data.
4. Add event timeline / audit trail model.
5. Add integration adapter stubs for Bullhorn, Herefish, Calendly, Candidately, Hinterview, and Granola.
6. Add tests around journey state transitions and data mapping.
7. Add GitHub remote, CI, and deploy target when ownership is decided.
