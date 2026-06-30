"use client";

import React, { useMemo, useState } from "react";

const phases = [
  {
    id: "sourcing",
    title: "1 · Sourcing",
    subtitle: "Candidate enters the system",
    color: "bg-blue-600",
    steps: [
      {
        number: 1,
        title: "Apply or sourced",
        owner: "LinkedIn · ZipRecruiter · Indeed · AssistMe.com · recruiter outreach",
        happens:
          "A candidate enters through job boards, the AssistMe site, referral, or manual sourcing. Intake captures personal, legal, safety, preference, availability, salary, and travel details.",
        stored:
          "Complete candidate profile, parsed resume, source tag, qualifying answers, and role context.",
        status: "Confirmed",
      },
      {
        number: 2,
        title: "Appears in pipeline",
        owner: "Bullhorn",
        happens:
          "The recruiter sees the candidate on the relevant role pipeline with auto-tags for skills, seniority, and PA / EA / House Manager role type.",
        stored: "Candidate stage: Applied. Resume and tags visible to the recruiter.",
        status: "Confirmed",
      },
    ],
  },
  {
    id: "screening",
    title: "2 · Screening",
    subtitle: "Schedule, screen, score",
    color: "bg-amber-500",
    steps: [
      {
        number: 3,
        title: "Mark for screening",
        owner: "Recruiter → Bullhorn",
        happens:
          "Recruiter advances a promising candidate to Screening Requested, triggering the scheduling workflow.",
        stored: "Stage moves from Applied to Screening Requested.",
        status: "Confirmed",
      },
      {
        number: 4,
        title: "Trigger workflow",
        owner: "Bullhorn → Herefish",
        happens:
          "A branded scheduling email is sent with the candidate name, role, recruiter information, and booking link.",
        stored: "Email outreach logged on the candidate profile.",
        status: "Confirmed",
      },
      {
        number: 5,
        title: "Send booking link",
        owner: "Herefish → Calendly",
        happens:
          "Candidate receives a 20-minute recruiter screen link with 5-minute buffers, a 7-day rolling window, and phone / Zoom options.",
        stored: "Candidate is choosing a time in Calendly.",
        status: "Confirmed",
      },
      {
        number: 6,
        title: "Candidate picks time",
        owner: "Calendly",
        happens:
          "The candidate chooses from real-time recruiter availability. Either side can reschedule and notifications stay synchronized.",
        stored: "Calendly booking metadata awaits webhook write-back.",
        status: "Confirmed",
      },
      {
        number: 7,
        title: "Booking confirmed",
        owner: "Calendly",
        happens:
          "Candidate gets branded confirmation, day-before email reminder, and day-before SMS reminder. Recruiter gets the calendar event.",
        stored: "Calendar event created and webhook queued for Bullhorn.",
        status: "Confirmed",
      },
      {
        number: 8,
        title: "Save to Bullhorn",
        owner: "Herefish write-back",
        happens:
          "Booking details, attendees, meeting link, and appointment time are written to the candidate record.",
        stored: "New appointment record on candidate profile.",
        status: "Confirmed",
      },
      {
        number: 9,
        title: "Screen scheduled",
        owner: "Bullhorn",
        happens:
          "Candidate stage updates to Screen Scheduled and the appointment appears in recruiter pipeline views.",
        stored: "Stage: Screen Scheduled. Appointment visible everywhere it matters.",
        status: "Confirmed",
      },
      {
        number: 10,
        title: "Conduct screen",
        owner: "Recruiter + Granola",
        happens:
          "Recruiter uses a scored assessment for fit, salary, availability, and role suitability. Phone screens are not recorded; structured notes attach to the profile. Zoom recording requires mutual consent.",
        stored:
          "Admin-only scorecard, recruiter notes, role-type fit, and outcome: Qualified, Rejected, or On Hold.",
        status: "Note capture mechanism still to confirm",
      },
    ],
  },
  {
    id: "presenting",
    title: "3 · Presenting",
    subtitle: "Package, portal, decision",
    color: "bg-purple-600",
    steps: [
      {
        number: 11,
        title: "Mark client-ready",
        owner: "Recruiter → Bullhorn",
        happens:
          "Recruiter advances a qualified candidate to Client Ready, launching the submission package request.",
        stored: "Stage moves from Qualified to Client Ready.",
        status: "Confirmed",
      },
      {
        number: "12a",
        title: "Candidate submits package",
        owner: "Candidate + Hinterview",
        happens:
          "Candidate confirms resume, records a one-minute video intro, answers client-specific prep questions, and submits the 'why I would be a great assistant' document.",
        stored:
          "Submission assets, answers, resume confirmation, Hinterview intro URL, and package completion state.",
        status: "Confirmed",
      },
      {
        number: "12b",
        title: "Push to portal",
        owner: "Recruiter → Candidately",
        happens:
          "Recruiter submits the candidate package into the branded client portal. Internal Bullhorn details remain private.",
        stored: "Portal shortlist membership and shared package metadata.",
        status: "Confirmed",
      },
      {
        number: 13,
        title: "Client reviews shortlist",
        owner: "Client → Candidately + Hinterview",
        happens:
          "Client reviews the shortlist, opens candidate profiles, watches videos, and records their decision in the portal.",
        stored: "Portal activity, video watch time, feedback, and decision trail.",
        status: "Confirmed",
      },
      {
        number: 14,
        title: "Decline",
        owner: "Client → Bullhorn",
        happens:
          "If declined, the client records a reason and the candidate exits the client-specific flow.",
        stored: "Decline reason written back to Bullhorn.",
        status: "Confirmed",
      },
      {
        number: 15,
        title: "Request interview",
        owner: "Client → Bullhorn",
        happens:
          "If the client wants to meet the candidate, the request continues into client interview scheduling.",
        stored: "Interview requested state and client preference context.",
        status: "Confirmed",
      },
    ],
  },
  {
    id: "booking",
    title: "4 · Booking interview",
    subtitle: "Schedule, record, confirm",
    color: "bg-emerald-600",
    steps: [
      {
        number: 16,
        title: "Trigger scheduling",
        owner: "Bullhorn → Herefish",
        happens:
          "Interview requested status triggers the client interview scheduling workflow.",
        stored: "Workflow event with candidate, client, role, and recruiter context.",
        status: "Confirmed",
      },
      {
        number: 17,
        title: "Send options",
        owner: "Calendly + Hinterview",
        happens:
          "The client and candidate receive scheduling options for a one-hour interview. Video recording can be enabled with consent.",
        stored: "Scheduling options and recording preference context.",
        status: "Confirmed",
      },
      {
        number: 18,
        title: "Interview booked",
        owner: "Herefish → Bullhorn",
        happens:
          "Confirmed interview time writes back to Bullhorn and all parties receive the right notifications.",
        stored: "Client interview appointment, meeting link, recordable consent state, and video watch tracking.",
        status: "Confirmed",
      },
    ],
  },
];

const systems = [
  {
    name: "Bullhorn",
    role: "System of record",
    detail: "Candidate records, stages, notes, scorecards, appointments, placements, and custom intake fields.",
  },
  {
    name: "Herefish",
    role: "Orchestration layer",
    detail: "Listens for Bullhorn changes, fires workflows, routes notifications, and writes results back.",
  },
  {
    name: "Calendly",
    role: "Scheduling",
    detail: "Recruiter screening calls and client interviews, reminders, rescheduling, and calendar events.",
  },
  {
    name: "Candidately",
    role: "Client portal",
    detail: "Branded shortlist review, client decisions, and package presentation without exposing Bullhorn.",
  },
  {
    name: "Hinterview",
    role: "Video",
    detail: "One-minute candidate intros, recorded interviews, consent handling, and watch-time tracking.",
  },
  {
    name: "Granola",
    role: "Structured notes",
    detail: "Phone-screen notes without recording, attached to candidate records after recruiter review.",
  },
];

const metrics = [
  { label: "Journey steps", value: "18" },
  { label: "Core systems", value: "6" },
  { label: "Screen length", value: "20 min" },
  { label: "Client interview", value: "1 hr" },
];

function StepCard({ step, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        active
          ? "border-slate-950 bg-slate-950 text-white shadow-xl"
          : "border-slate-200 bg-white hover:border-slate-400 hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            active ? "bg-white text-slate-950" : "bg-slate-100 text-slate-700"
          }`}
        >
          {step.number}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
            {step.owner}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
          <p className={`mt-2 text-sm ${active ? "text-slate-200" : "text-slate-600"}`}>
            {step.happens}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function AssistMePrototype() {
  const allSteps = useMemo(() => phases.flatMap((phase) => phase.steps.map((step) => ({ ...step, phase: phase.title }))), []);
  const [activePhase, setActivePhase] = useState(phases[0].id);
  const [selectedStepNumber, setSelectedStepNumber] = useState(1);

  const selectedPhase = phases.find((phase) => phase.id === activePhase) ?? phases[0];
  const selectedStep = allSteps.find((step) => String(step.number) === String(selectedStepNumber)) ?? allSteps[0];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-700">AssistMe Platform</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
              Candidate journey command center
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              A rebuildable product prototype for the AssistMe recruiting workflow: Bullhorn remains the system of record, Herefish coordinates automation, and every scheduling, video, and portal interaction writes back to the candidate record.
            </p>
          </div>
          <div className="grid min-w-[280px] grid-cols-2 gap-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-3xl font-bold text-slate-950">{metric.value}</div>
                <div className="mt-1 text-sm text-slate-500">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr_360px]">
        <aside className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Phases</h2>
          {phases.map((phase) => (
            <button
              key={phase.id}
              type="button"
              onClick={() => {
                setActivePhase(phase.id);
                setSelectedStepNumber(phase.steps[0].number);
              }}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                activePhase === phase.id
                  ? "border-slate-950 bg-white shadow-lg"
                  : "border-slate-200 bg-white hover:border-slate-400"
              }`}
            >
              <div className={`mb-3 h-2 w-16 rounded-full ${phase.color}`} />
              <div className="font-semibold">{phase.title}</div>
              <div className="text-sm text-slate-500">{phase.subtitle}</div>
            </button>
          ))}
        </aside>

        <section className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Active flow</p>
            <h2 className="mt-2 text-3xl font-bold">{selectedPhase.title}</h2>
            <p className="mt-2 text-slate-600">{selectedPhase.subtitle}</p>
          </div>
          <div className="grid gap-4">
            {selectedPhase.steps.map((step) => (
              <StepCard
                key={step.number}
                step={step}
                active={String(selectedStep.number) === String(step.number)}
                onSelect={() => setSelectedStepNumber(step.number)}
              />
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Selected step</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-lg font-bold text-white">
                {selectedStep.number}
              </div>
              <div>
                <h3 className="text-2xl font-bold">{selectedStep.title}</h3>
                <p className="text-sm text-slate-500">{selectedStep.phase}</p>
              </div>
            </div>
            <dl className="mt-6 space-y-5">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Owner</dt>
                <dd className="mt-1 text-sm font-medium text-slate-700">{selectedStep.owner}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">What happens</dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700">{selectedStep.happens}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">What gets stored</dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700">{selectedStep.stored}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Status</dt>
                <dd className="mt-1 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                  {selectedStep.status}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">System architecture</p>
              <h2 className="mt-2 text-3xl font-bold">One recruiting workflow, six connected systems</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Phase 1 should prove visibility and hand-offs before deep API integration: every mock event should clearly identify its system owner, trigger, data written, and next state.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {systems.map((system) => (
              <div key={system.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-xl font-bold">{system.name}</h3>
                <p className="mt-1 text-sm font-semibold text-blue-700">{system.role}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{system.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
