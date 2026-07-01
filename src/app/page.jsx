"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { dispatchJobs as seededDispatchJobs } from "@/data/dispatch-jobs";
import { fulfillmentOptions } from "@/data/fulfillment";
import { serviceHistory } from "@/data/history";
import { providerJobs as seededProviderJobs } from "@/data/provider-jobs";
import { providers } from "@/data/providers";
import { roadsidePartners, roadsideServiceTypes } from "@/data/roadside-partners";
import { oilOptions, services } from "@/data/services";
import { initialVehicle } from "@/data/vehicles";
import bookingState from "@/lib/booking-state";
import dispatchOperations from "@/lib/dispatch-operations";
import localStorageHelpers from "@/lib/local-storage";
import providerOperations from "@/lib/provider-operations";
import matching from "@/lib/provider-matching";
import pricing from "@/lib/pricing";
import roadsideHandoff from "@/lib/roadside-handoff";

const { deriveProviderSelection, getProviderMatchingResults } = matching;
const { DISPATCH_JOB_STATES, MANUAL_ACTIONS, applyDispatchAction, deriveDispatchQueue, filterDispatchJobs, getAssignmentCandidates, getReassignCandidate, groupDispatchJobs } = dispatchOperations;
const { clearBookingDraft, loadBookingDraft, normalizeBookingDraft, saveBookingDraft } = localStorageHelpers;
const { calculateEstimate, formatEstimateAmount, getEstimateStatusCopy } = pricing;
const { canConfirmBooking, getBookingSteps, getConfirmationGuidance, requiresPartsSelection, transitionBooking } = bookingState;
const { PROVIDER_JOB_STATES, canAcceptProviderJob, canDeclineProviderJob, canProgressProviderJob, getCompletionReadiness, hasPendingCustomerApproval, transitionProviderJob } = providerOperations;
const { buildRoadsideHandoff, isEmergencyRoadsideIntent } = roadsideHandoff;

const DEFAULT_BOOKING_DRAFT = {
  selectedServiceId: "oil-change",
  fulfillmentId: "mobile",
  selectedOilId: "recommended",
  selectedProviderId: "maria",
  vehicle: { ...initialVehicle },
  address: "Home · 220 W Kinzie St, Chicago, IL",
  appointmentTime: "Today 2:30 PM",
};

function currency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function providerStatusLabel(status) {
  return String(status ?? "unknown").replaceAll("_", " ");
}

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    orange: "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
    red: "bg-red-100 text-red-800 ring-1 ring-red-200",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export default function MobileMechanicMarketplace() {
  const [activeTab, setActiveTab] = useState("book");
  const [selectedServiceId, setSelectedServiceId] = useState(DEFAULT_BOOKING_DRAFT.selectedServiceId);
  const [fulfillmentId, setFulfillmentId] = useState(DEFAULT_BOOKING_DRAFT.fulfillmentId);
  const [selectedOilId, setSelectedOilId] = useState(DEFAULT_BOOKING_DRAFT.selectedOilId);
  const [selectedProviderId, setSelectedProviderId] = useState(DEFAULT_BOOKING_DRAFT.selectedProviderId);
  const [vehicle, setVehicle] = useState(DEFAULT_BOOKING_DRAFT.vehicle);
  const [address, setAddress] = useState(DEFAULT_BOOKING_DRAFT.address);
  const [appointmentTime, setAppointmentTime] = useState(DEFAULT_BOOKING_DRAFT.appointmentTime);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftNotice, setDraftNotice] = useState("Loading saved draft…");
  const [providerJobs, setProviderJobs] = useState(seededProviderJobs);
  const [selectedProviderJobId, setSelectedProviderJobId] = useState(seededProviderJobs[0]?.id ?? null);
  const [providerDecisionNotice, setProviderDecisionNotice] = useState("Static provider workbench demo: changes stay in memory only.");
  const [dispatchJobs, setDispatchJobs] = useState(seededDispatchJobs);
  const [selectedDispatchJobId, setSelectedDispatchJobId] = useState(seededDispatchJobs[0]?.id ?? null);
  const [dispatchFilter, setDispatchFilter] = useState("exceptions");
  const [dispatchFilters, setDispatchFilters] = useState({ status: "all", risk: "all", market: "all", fulfillment: "all", providerId: "all" });
  const [dispatchGroupBy, setDispatchGroupBy] = useState("status");
  const [dispatchNotice, setDispatchNotice] = useState("Static dispatcher queue: actions are audited in memory only; no backend, auth, payments, or localStorage PII.");
  const [roadsideIntentId, setRoadsideIntentId] = useState("tow");
  const [roadsideMarket, setRoadsideMarket] = useState("chicago");
  const skipNextDraftSave = useRef(false);

  useEffect(() => {
    const persistedDraft = loadBookingDraft();

    if (persistedDraft) {
      const { draft: normalizedDraft, changed } = normalizeBookingDraft(persistedDraft, {
        defaultDraft: DEFAULT_BOOKING_DRAFT,
        services,
        fulfillmentOptions,
        oilOptions,
        providers,
        deriveProviderSelection,
      });

      if (normalizedDraft) {
        // Loading after mount avoids server/client hydration mismatches for browser-only localStorage.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedServiceId(normalizedDraft.selectedServiceId);
        setFulfillmentId(normalizedDraft.fulfillmentId);
        setSelectedOilId(normalizedDraft.selectedOilId);
        setSelectedProviderId(normalizedDraft.selectedProviderId);
        setVehicle(normalizedDraft.vehicle);
        setAddress(normalizedDraft.address);
        setAppointmentTime(normalizedDraft.appointmentTime);
        setBookingConfirmed(false);
        setDraftNotice(changed ? "Restored a saved draft and refreshed stale selections." : "Restored your saved draft. Private VIN and address details were not stored.");
      }

      if (!normalizedDraft || changed) {
        clearBookingDraft();
        if (!normalizedDraft) {
          setDraftNotice("Saved draft could not be restored, so the default booking is shown.");
        }
      }
    } else {
      setDraftNotice("Draft saves locally on this device with VIN and address minimized.");
    }

    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (!draftHydrated) {
      return;
    }

    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }

    saveBookingDraft({
      vehicle,
      address,
      selectedServiceId,
      fulfillmentId,
      selectedProviderId,
      selectedOilId,
      appointmentTime,
    });
  }, [address, appointmentTime, draftHydrated, fulfillmentId, selectedOilId, selectedProviderId, selectedServiceId, vehicle]);

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? services[0];
  const fulfillment = fulfillmentOptions.find((option) => option.id === fulfillmentId) ?? fulfillmentOptions[0];
  const selectedOil = oilOptions.find((oil) => oil.id === selectedOilId) ?? oilOptions[0];
  const partsSelectionRequired = requiresPartsSelection(selectedService);
  const matchingRequest = useMemo(() => ({ service: selectedService, fulfillment }), [selectedService, fulfillment]);
  const providerMatchingResults = useMemo(() => getProviderMatchingResults(providers, matchingRequest), [matchingRequest]);
  const providerMatches = providerMatchingResults.matches;
  const providerSelection = useMemo(() => deriveProviderSelection({
    providers,
    selectedProviderId,
    appointmentTime,
    request: matchingRequest,
  }), [appointmentTime, matchingRequest, selectedProviderId]);
  const selectedProvider = providerSelection.provider;
  const selectedAppointmentTime = providerSelection.appointmentTime;

  const estimate = useMemo(() => {
    return calculateEstimate({ service: selectedService, oil: selectedOil, fulfillment });
  }, [selectedService, selectedOil, fulfillment]);
  const roadsideIntent = roadsideServiceTypes.find((intent) => intent.id === roadsideIntentId) ?? roadsideServiceTypes[0];
  const roadsideMarkets = [
    { id: "chicago", label: "Chicago (covered)" },
    { id: "detroit", label: "Detroit (covered by national app)" },
    { id: "indianapolis", label: "Indianapolis (covered by national app)" },
    { id: "milwaukee", label: "Milwaukee (covered by national app)" },
    { id: "national_fallback", label: "National fallback demo (deliberate fallback mode)" },
    { id: "boise", label: "Boise (unsupported fallback test)" },
  ];
  const roadsideHandoffResult = useMemo(() => buildRoadsideHandoff({
    market: roadsideMarket,
    serviceType: roadsideIntentId,
    summary: roadsideIntent?.label,
    partners: roadsidePartners,
  }), [roadsideIntent?.label, roadsideIntentId, roadsideMarket]);
  const roadsideMustHandoff = isEmergencyRoadsideIntent(roadsideIntentId);

  const bookingDraft = useMemo(() => ({
    service: selectedService,
    fulfillment,
    oil: partsSelectionRequired ? selectedOil : undefined,
    provider: selectedProvider,
    vehicle,
    appointmentTime: selectedAppointmentTime,
    estimate,
    confirmed: bookingConfirmed,
  }), [selectedService, fulfillment, selectedOil, selectedProvider, vehicle, selectedAppointmentTime, estimate, bookingConfirmed, partsSelectionRequired]);
  const steps = getBookingSteps(bookingDraft);
  const stepByState = Object.fromEntries(steps.map((step) => [step.state, step]));
  const confirmationReady = canConfirmBooking(bookingDraft);
  const confirmationGuidance = getConfirmationGuidance(bookingDraft);
  const estimateCopy = getEstimateStatusCopy(estimate, { service: selectedService, provider: selectedProvider });
  const confirmationButtonLabel = bookingConfirmed ? "Appointment confirmed" : confirmationReady ? "Confirm appointment" : "Complete booking details";
  const selectedProviderJob = providerJobs.find((job) => job.id === selectedProviderJobId) ?? providerJobs[0];
  const selectedCompletionReadiness = getCompletionReadiness(selectedProviderJob);
  const pendingSelectedCustomerApproval = hasPendingCustomerApproval(selectedProviderJob);
  const selectedCanAccept = canAcceptProviderJob(selectedProviderJob).ok;
  const selectedCanDecline = canDeclineProviderJob(selectedProviderJob, "Demo decline: provider capacity or fitment risk").ok;
  const providerProgressActions = [
    { status: PROVIDER_JOB_STATES.confirmed, label: "Confirm readiness" },
    { status: PROVIDER_JOB_STATES.enRoute, label: "Start route" },
    { status: PROVIDER_JOB_STATES.arrived, label: "Mark arrived" },
    { status: PROVIDER_JOB_STATES.inProgress, label: "Start work" },
    { status: PROVIDER_JOB_STATES.completed, label: "Complete job" },
    { status: PROVIDER_JOB_STATES.reportSubmitted, label: "Submit report" },
    { status: PROVIDER_JOB_STATES.closed, label: "Close job" },
  ].filter((action) => canProgressProviderJob(selectedProviderJob, action.status).ok);
  const canRequestSelectedCustomerApproval = canProgressProviderJob(selectedProviderJob, PROVIDER_JOB_STATES.customerApprovalRequired).ok;
  const payoutQueuedStatuses = ["queued", "processing"];
  const earningsEligibleStatuses = [PROVIDER_JOB_STATES.completed, PROVIDER_JOB_STATES.reportSubmitted, PROVIDER_JOB_STATES.closed];
  const queuedEarnings = providerJobs
    .filter((job) => earningsEligibleStatuses.includes(job.status) || payoutQueuedStatuses.includes(job.payout?.status))
    .reduce((sum, job) => sum + (job.estimate?.providerEarnings ?? 0), 0);
  const dispatchQueue = useMemo(() => deriveDispatchQueue(dispatchJobs), [dispatchJobs]);
  const dispatchFilterOptions = useMemo(() => {
    const decorated = dispatchQueue.jobs;
    const unique = (values) => [...new Set(values.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b));
    return {
      status: unique(decorated.map((job) => job.status)),
      risk: ["critical", "high", "medium", "low"].filter((risk) => decorated.some((job) => job.risk.level === risk)),
      market: unique(decorated.map((job) => job.market)),
      fulfillment: unique(decorated.map((job) => job.fulfillmentId)),
      providerId: unique(decorated.map((job) => job.providerId ?? "unassigned")),
    };
  }, [dispatchQueue]);
  const activeDispatchFilters = useMemo(() => ({
    ...(dispatchFilters.status !== "all" ? { status: dispatchFilters.status } : {}),
    ...(dispatchFilters.risk !== "all" ? { risk: dispatchFilters.risk } : {}),
    ...(dispatchFilters.market !== "all" ? { market: dispatchFilters.market } : {}),
    ...(dispatchFilters.fulfillment !== "all" ? { fulfillment: dispatchFilters.fulfillment } : {}),
    ...(dispatchFilters.providerId !== "all" && dispatchFilters.providerId !== "unassigned" ? { providerId: dispatchFilters.providerId } : {}),
  }), [dispatchFilters]);
  const visibleDispatchJobs = useMemo(() => {
    let jobsToShow;
    if (dispatchFilter === "exceptions") jobsToShow = dispatchQueue.exceptionJobs;
    else if (dispatchFilter === "unassigned") jobsToShow = dispatchQueue.jobs.filter((job) => job.isUnassigned);
    else if (dispatchFilter === "blocked") jobsToShow = dispatchQueue.jobs.filter((job) => job.isBlocked);
    else jobsToShow = filterDispatchJobs(dispatchJobs, activeDispatchFilters);

    if (dispatchFilters.providerId === "unassigned") return jobsToShow.filter((job) => job.isUnassigned);
    return filterDispatchJobs(jobsToShow, activeDispatchFilters);
  }, [activeDispatchFilters, dispatchFilter, dispatchFilters.providerId, dispatchJobs, dispatchQueue]);
  const visibleDispatchGroups = useMemo(() => groupDispatchJobs(visibleDispatchJobs, dispatchGroupBy), [dispatchGroupBy, visibleDispatchJobs]);
  const selectedDispatchJob = visibleDispatchJobs.find((job) => job.id === selectedDispatchJobId)
    ?? dispatchQueue.jobs.find((job) => job.id === selectedDispatchJobId)
    ?? dispatchQueue.jobs[0];
  const selectedDispatchCandidates = useMemo(() => (
    selectedDispatchJob ? getAssignmentCandidates(selectedDispatchJob, providers) : { matches: [], ineligible: [] }
  ), [selectedDispatchJob]);
  const bestDispatchCandidate = selectedDispatchCandidates.matches[0];
  const reassignDispatchCandidate = getReassignCandidate(selectedDispatchJob, selectedDispatchCandidates.matches);
  const canResolveSelectedDispatchBlocker = selectedDispatchJob?.status === DISPATCH_JOB_STATES.blocked || Boolean(selectedDispatchJob?.blocker);
  const dispatchActor = { type: "dispatcher", id: "ops-demo", name: "Ops demo dispatcher" };

  function updateDispatchJob(jobId, action, successMessage) {
    const currentJob = dispatchJobs.find((job) => job.id === jobId);
    if (!currentJob) {
      setDispatchNotice("Dispatch job was not found in the static queue.");
      return;
    }

    const result = applyDispatchAction(currentJob, { ...action, actor: dispatchActor, timestamp: new Date().toISOString() }, providers);
    if (!result.ok) {
      setDispatchNotice(result.blockers.join(" "));
      return;
    }

    setDispatchJobs((currentJobs) => currentJobs.map((job) => (job.id === jobId ? result.job : job)));
    setSelectedDispatchJobId(jobId);
    setDispatchNotice(successMessage ?? `${action.type.replaceAll("_", " ")} recorded with audit metadata.`);
  }

  function updateProviderJob(jobId, event, successMessage) {
    const currentJob = providerJobs.find((job) => job.id === jobId);
    if (!currentJob) {
      setProviderDecisionNotice("Provider job was not found in the static demo queue.");
      return;
    }

    const result = transitionProviderJob(currentJob, event);
    if (!result.ok) {
      setProviderDecisionNotice(result.blockers.join(" "));
      return;
    }

    setProviderJobs((currentJobs) => currentJobs.map((job) => (job.id === jobId ? result.job : job)));
    setSelectedProviderJobId(jobId);
    setProviderDecisionNotice(successMessage);
  }

  function markSelectedReportReady() {
    if (!selectedProviderJob) {
      return;
    }

    setProviderJobs((currentJobs) => currentJobs.map((job) => (
      job.id === selectedProviderJob.id
        ? {
          ...job,
          report: {
            notes: job.report?.notes || "Static demo service notes captured. Work performed and reviewed with customer.",
            photos: job.report?.photos?.length ? job.report.photos : ["demo-completion-photo.jpg"],
            checklist: (job.report?.checklist ?? []).map((item) => ({ ...item, completed: true })),
            invoice: { ...(job.report?.invoice ?? {}), placeholderReady: true, label: "Invoice placeholder ready" },
          },
        }
        : job
    )));
    setProviderDecisionNotice("Demo report fields and invoice placeholder filled. Customer approval still requires its explicit request/approval path.");
  }

  function approveSelectedChangeRequest() {
    if (!selectedProviderJob) {
      return;
    }

    if (!pendingSelectedCustomerApproval) {
      setProviderDecisionNotice("No pending customer approval is open for this job.");
      return;
    }

    if (selectedProviderJob.status !== PROVIDER_JOB_STATES.customerApprovalRequired) {
      setProviderDecisionNotice("Request customer approval before recording approval for scope or price changes.");
      return;
    }

    const approvedJob = {
      ...selectedProviderJob,
      changeRequest: { ...selectedProviderJob.changeRequest, approvalStatus: "approved" },
    };
    const approvalReturnStatus = selectedProviderJob.approvalReturnStatus ?? PROVIDER_JOB_STATES.inProgress;
    const result = transitionProviderJob(approvedJob, { type: "progress", nextStatus: approvalReturnStatus });

    if (!result.ok) {
      setProviderDecisionNotice(result.blockers.join(" "));
      return;
    }

    setProviderJobs((currentJobs) => currentJobs.map((job) => (job.id === selectedProviderJob.id ? result.job : job)));
    setProviderDecisionNotice(`Customer approval recorded explicitly; provider job returned to ${providerStatusLabel(result.job.status)}.`);
  }

  function statusTone(status) {
    if ([PROVIDER_JOB_STATES.completed, PROVIDER_JOB_STATES.reportSubmitted, PROVIDER_JOB_STATES.closed].includes(status)) return "green";
    if ([PROVIDER_JOB_STATES.inProgress, PROVIDER_JOB_STATES.arrived, PROVIDER_JOB_STATES.enRoute].includes(status)) return "blue";
    if ([PROVIDER_JOB_STATES.offered, PROVIDER_JOB_STATES.customerApprovalRequired].includes(status)) return "amber";
    return "slate";
  }

  function updateDraft(updater) {
    setBookingConfirmed(false);
    updater();
  }

  function handleServiceChange(serviceId) {
    updateDraft(() => {
      setSelectedServiceId(serviceId);
      const nextService = services.find((service) => service.id === serviceId) ?? null;
      const nextFulfillment = fulfillmentOptions.find((option) => option.id === fulfillmentId) ?? null;
      const nextSelection = deriveProviderSelection({
        providers,
        selectedProviderId,
        appointmentTime,
        request: { service: nextService, fulfillment: nextFulfillment },
      });
      setSelectedProviderId(nextSelection.selectedProviderId);
      setAppointmentTime(nextSelection.appointmentTime);
      if (!requiresPartsSelection(nextService)) {
        setSelectedOilId(DEFAULT_BOOKING_DRAFT.selectedOilId);
      }
    });
  }

  function handleFulfillmentChange(nextFulfillmentId) {
    updateDraft(() => {
      setFulfillmentId(nextFulfillmentId);
      const nextFulfillment = fulfillmentOptions.find((option) => option.id === nextFulfillmentId) ?? null;
      const nextSelection = deriveProviderSelection({
        providers,
        selectedProviderId,
        appointmentTime,
        request: { service: selectedService, fulfillment: nextFulfillment },
      });
      setSelectedProviderId(nextSelection.selectedProviderId);
      setAppointmentTime(nextSelection.appointmentTime);
    });
  }

  function stepEyebrow(state) {
    const step = stepByState[state];
    return step ? `Step ${step.number}` : "Step";
  }

  function handleConfirmAppointment() {
    const nextBooking = transitionBooking(bookingDraft, "confirm");
    setBookingConfirmed(nextBooking.confirmed === true);
  }

  function handleResetDraft() {
    skipNextDraftSave.current = true;
    clearBookingDraft();
    setSelectedServiceId(DEFAULT_BOOKING_DRAFT.selectedServiceId);
    setFulfillmentId(DEFAULT_BOOKING_DRAFT.fulfillmentId);
    setSelectedOilId(DEFAULT_BOOKING_DRAFT.selectedOilId);
    setSelectedProviderId(DEFAULT_BOOKING_DRAFT.selectedProviderId);
    setVehicle({ ...DEFAULT_BOOKING_DRAFT.vehicle });
    setAddress(DEFAULT_BOOKING_DRAFT.address);
    setAppointmentTime(DEFAULT_BOOKING_DRAFT.appointmentTime);
    setBookingConfirmed(false);
    setDraftNotice("Draft reset to the default MVP booking. Saved browser draft was cleared.");
  }

  return (
    <main className="min-h-screen bg-[#F7F8FB] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-blue-700">Mobile Mechanic</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Car care without losing your day.</h1>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              Book vetted mobile mechanics, nearby shops, or dealership service options from one flow. Start with the vehicle, choose the work, compare providers, and confirm a transparent estimate.
            </p>
          </div>
          <div className="grid min-w-[280px] grid-cols-3 gap-3 rounded-3xl bg-slate-950 p-4 text-white">
            <div>
              <div className="text-2xl font-black">4.8★</div>
              <div className="text-xs text-slate-300">avg provider</div>
            </div>
            <div>
              <div className="text-2xl font-black">90m</div>
              <div className="text-xs text-slate-300">typical arrival</div>
            </div>
            <div>
              <div className="text-2xl font-black">$0</div>
              <div className="text-xs text-slate-300">surprise fees</div>
            </div>
          </div>
        </div>
      </header>

      <nav className="mx-auto flex max-w-7xl gap-2 px-6 py-5">
        {["book", "roadside", "vehicle", "history", "provider", "dispatch"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-5 py-2 text-sm font-bold capitalize transition ${
              activeTab === tab ? "bg-blue-700 text-white shadow-lg" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab === "book" ? "Book service" : tab}
          </button>
        ))}
      </nav>

      {activeTab === "book" && (
        <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            {draftNotice && (
              <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
                {draftNotice}
              </div>
            )}
            <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-950 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-black uppercase tracking-[0.2em]">Urgent roadside?</p>
                  <p className="mt-1 font-semibold">Towing, lockout, fuel delivery, jump-start emergency, emergency flat tire, or unsafe-location requests are partner handoffs only. ReGo does not create a normal provider dispatch job for these services.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("roadside")}
                  className="rounded-full bg-red-700 px-5 py-3 text-sm font-black text-white transition hover:bg-red-800"
                >
                  Open partner handoff
                </button>
              </div>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">{stepEyebrow("select_service")}</p>
                  <h2 className="mt-1 text-2xl font-black">Choose a service</h2>
                </div>
                <Pill tone="blue">Vehicle-aware pricing</Pill>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => handleServiceChange(service.id)}
                    className={`rounded-2xl border p-5 text-left transition ${
                      selectedServiceId === service.id
                        ? "border-blue-700 bg-blue-50 shadow-md"
                        : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black">{service.name}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{service.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black">from {currency(service.price)}</div>
                        <div className="text-xs text-slate-500">{service.duration}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {service.includes.map((item) => <Pill key={item}>{item}</Pill>)}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">{stepEyebrow("select_fulfillment")}</p>
              <h2 className="mt-1 text-2xl font-black">Pick where the work happens</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {fulfillmentOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleFulfillmentChange(option.id)}
                    className={`rounded-2xl border p-5 text-left transition ${
                      fulfillmentId === option.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">{option.label}</p>
                    <h3 className="mt-2 text-lg font-black">{option.title}</h3>
                    <p className={`mt-2 text-sm leading-6 ${fulfillmentId === option.id ? "text-slate-200" : "text-slate-600"}`}>{option.description}</p>
                    <p className="mt-4 text-sm font-bold">{option.fee ? `${currency(option.fee)} coordination fee` : "No added fee"}</p>
                  </button>
                ))}
              </div>
            </section>

            {partsSelectionRequired && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">{stepEyebrow("select_parts")}</p>
                <h2 className="mt-1 text-2xl font-black">Oil preference</h2>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {oilOptions.map((oil) => (
                    <button
                      key={oil.id}
                      type="button"
                      onClick={() => updateDraft(() => setSelectedOilId(oil.id))}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedOilId === oil.id ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                    >
                      <div className="flex justify-between gap-3">
                        <h3 className="font-black">{oil.name}</h3>
                        <span className="font-black">
                          {formatEstimateAmount(oil.price, {
                            tbd: calculateEstimate({ service: selectedService, oil, fulfillment }).partsTbd,
                            formatter: currency,
                          })}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{oil.note}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">{stepEyebrow("select_provider")}</p>
              <h2 className="mt-1 text-2xl font-black">Compare available providers</h2>
              <div className="mt-5 space-y-4">
                {providerMatches.length === 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                    <p className="font-black">No eligible providers available</p>
                    <p className="mt-1 font-semibold">No provider can cover this service and fulfillment combination right now. Try another fulfillment option or adjust the service details before confirming.</p>
                    {providerMatchingResults.ineligible.length > 0 && (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs font-semibold">
                        {providerMatchingResults.ineligible.slice(0, 3).map((match) => (
                          <li key={match.providerId}>{match.provider.name}: {match.exclusions.join(", ")}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {providerMatches.map((match, index) => {
                  const provider = match.provider;

                  return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => {
                      updateDraft(() => {
                        setSelectedProviderId(provider.id);
                        setAppointmentTime(match.earliestSlot ?? provider.earliest);
                      });
                    }}
                    className={`w-full rounded-2xl border p-5 text-left transition ${
                      selectedProvider?.id === provider.id ? "border-green-600 bg-emerald-50 shadow-md" : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-black">{provider.name}</h3>
                          {index === 0 && <Pill tone="blue">Best match</Pill>}
                          <Pill tone="green">Score {Math.round(match.score)}</Pill>
                        </div>
                        <p className="text-sm font-semibold text-slate-600">{provider.type}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          {match.reasons.slice(0, 3).join(" · ")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {provider.specialties.map((specialty) => <Pill key={specialty} tone="green">{specialty}</Pill>)}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm md:text-right">
                        <div><div className="font-black">{provider.rating}★</div><div className="text-slate-500">{provider.reviews} reviews</div></div>
                        <div><div className="font-black">{provider.distance} mi</div><div className="text-slate-500">away</div></div>
                        <div><div className="font-black">{match.earliestSlot ?? provider.earliest}</div><div className="text-slate-500">earliest</div></div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-500 md:grid-cols-5">
                      <span>Availability +{Math.round(match.scoreComponents.availability ?? 0)}</span>
                      <span>Distance +{Math.round(match.scoreComponents.distance ?? 0)}</span>
                      <span>Rating +{Math.round(match.scoreComponents.rating ?? 0)}</span>
                      <span>Specialty +{Math.round(match.scoreComponents.specialty ?? 0)}</span>
                      <span>Trust +{Math.round(match.scoreComponents.compliance ?? 0)}</span>
                    </div>
                  </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Booking summary</p>
                  <h2 className="mt-2 text-2xl font-black">{selectedService.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-slate-600 transition hover:border-blue-700 hover:text-blue-700"
                >
                  Reset draft
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {steps.map((step) => (
                  <Pill key={step.id} tone={step.active ? "blue" : step.complete ? "green" : "slate"}>{step.number}. {step.label}</Pill>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="font-black">{vehicle.year} {vehicle.make} {vehicle.model}</div>
                <div className="mt-1 text-sm text-slate-600">{vehicle.mileage} miles · VIN ending {vehicle.vin.slice(-6)}</div>
              </div>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Location</dt><dd className="text-right font-semibold">{address}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Provider</dt><dd className="font-semibold">{selectedProvider?.name ?? "No eligible provider"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Time</dt><dd className="font-semibold">{selectedAppointmentTime ?? "Select an eligible provider"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Fulfillment</dt><dd className="font-semibold">{fulfillment.label}</dd></div>
              </dl>
              <div className="mt-6 border-t border-slate-200 pt-5">
                <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
                  <div className="font-black">{estimateCopy.label}</div>
                  <p className="mt-1 leading-6 font-semibold">{estimateCopy.summary}</p>
                </div>
                <div className="flex justify-between text-sm"><span>Labor estimate</span><strong>{currency(estimate.labor)}</strong></div>
                <div className="mt-2 flex justify-between text-sm"><span>{estimate.lineItems.find((item) => item.id === "parts")?.label ?? "Parts"}</span><strong>{formatEstimateAmount(estimate.parts, { tbd: estimate.partsTbd, formatter: currency })}</strong></div>
                <div className="mt-2 flex justify-between text-sm"><span>Travel / coordination</span><strong>{currency(estimate.travel)}</strong></div>
                <div className="mt-2 flex justify-between text-sm"><span>Platform fee</span><strong>{currency(estimate.platform)}</strong></div>
                <div className="mt-4 flex justify-between text-xl font-black"><span>{estimateCopy.totalLabel}</span><span>{formatEstimateAmount(estimate.total, { tbd: estimate.totalTbd, formatter: currency })}</span></div>
              </div>
              <button
                type="button"
                onClick={handleConfirmAppointment}
                disabled={!confirmationReady || bookingConfirmed}
                className={`mt-6 w-full rounded-2xl px-5 py-4 text-base font-black text-white shadow-lg transition ${
                  confirmationReady && !bookingConfirmed ? "bg-blue-700 hover:bg-blue-800" : "cursor-not-allowed bg-slate-400"
                }`}
              >
                {confirmationButtonLabel}
              </button>
              <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-center text-xs font-semibold text-slate-600">
                {bookingConfirmed ? (
                  <p>
                    Confirmed with {selectedProvider?.name} for {selectedAppointmentTime}. {estimateCopy.totalLabel}: {formatEstimateAmount(estimate.total, { tbd: estimate.totalTbd, formatter: currency })}. Provider confirmation is next; no charge has been captured.
                  </p>
                ) : (
                  <>
                    <p>{confirmationGuidance.message}</p>
                    {!confirmationGuidance.ready && confirmationGuidance.reasons.length > 1 && (
                      <p className="mt-1">Also needed: {confirmationGuidance.reasons.slice(1).join(" ")}</p>
                    )}
                  </>
                )}
              </div>
            </section>
          </aside>
        </section>
      )}

      {activeTab === "roadside" && (
        <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-600">Emergency roadside partner handoff</p>
                  <h2 className="mt-2 text-3xl font-black">Triage urgent roadside requests away from ReGo dispatch.</h2>
                  <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                    ReGo Mobile Mechanic does not directly operate towing, lockout, fuel delivery, emergency flat-tire response, emergency battery dispatch, or emergency response. Urgent roadside intents are handed off to third-party partners or safety guidance and do not create a ReGo booking/provider/dispatch job.
                  </p>
                </div>
                <Pill tone="red">Partner-routed only</Pill>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Triage intent</p>
                  <h3 className="mt-1 text-2xl font-black">What is happening now?</h3>
                </div>
                <select
                  value={roadsideMarket}
                  onChange={(event) => setRoadsideMarket(event.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold capitalize outline-none focus:border-red-600"
                >
                  {roadsideMarkets.map((market) => <option key={market.id} value={market.id}>{market.label}</option>)}
                </select>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {roadsideServiceTypes.map((intent) => {
                  const emergencyIntent = isEmergencyRoadsideIntent(intent.id);
                  return (
                    <button
                      key={intent.id}
                      type="button"
                      onClick={() => setRoadsideIntentId(intent.id)}
                      className={`rounded-2xl border p-5 text-left transition ${
                        roadsideIntentId === intent.id
                          ? emergencyIntent ? "border-red-600 bg-red-50 shadow-md" : "border-blue-700 bg-blue-50 shadow-md"
                          : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-lg font-black">{intent.label}</h4>
                        <Pill tone={emergencyIntent ? "red" : "blue"}>{emergencyIntent ? "Partner handoff" : "ReGo eligible"}</Pill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{intent.description}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Partner handoff options</p>
              <h3 className="mt-1 text-2xl font-black">{roadsideIntent?.label}</h3>
              <div className={`mt-4 rounded-2xl p-4 text-sm font-semibold leading-6 ${roadsideMustHandoff ? "bg-red-50 text-red-950" : "bg-blue-50 text-blue-950"}`}>
                {roadsideMustHandoff ? roadsideHandoffResult.guidance : "This selection is non-emergency/mobile-mechanic eligible. Use the normal Book service flow when the vehicle is parked safely and the work can be scheduled."}
              </div>
              {roadsideHandoffResult.partnerCandidates.length > 0 ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {roadsideHandoffResult.partnerCandidates.map((partner) => (
                    <article key={partner.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-xl font-black">{partner.name}</h4>
                          <p className="mt-1 text-sm font-semibold text-slate-600">{partner.coverage}</p>
                        </div>
                        <Pill tone="amber">{partner.slaEstimate}</Pill>
                      </div>
                      <dl className="mt-4 space-y-2 text-sm">
                        <div><dt className="font-black text-slate-500">Availability</dt><dd className="font-semibold">{partner.availability}</dd></div>
                        <div><dt className="font-black text-slate-500">Services</dt><dd className="font-semibold">{partner.serviceTypes.map((type) => type.replaceAll("_", " ")).join(", ")}</dd></div>
                      </dl>
                      <div className="mt-4 space-y-2">
                        {partner.contactChannels.map((channel) => (
                          <div key={`${partner.id}-${channel.type}-${channel.value}`} className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">
                            {channel.label}: {channel.value}
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">{partner.disclosure}</p>
                    </article>
                  ))}
                </div>
              ) : roadsideMustHandoff ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-950">
                  No partner card is available for this market/service in static MVP data. Use emergency services if unsafe, roadside membership/insurance if available, or ReGo support guidance. No ReGo dispatch job will be created.
                </div>
              ) : null}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Handoff audit placeholder</p>
              <h3 className="mt-2 text-2xl font-black">No ReGo dispatch</h3>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
                <p>{roadsideHandoffResult.disclosure}</p>
                <p className="mt-3">Audit placeholder stores only non-PII handoff metadata such as market, service type, timestamp, and partner candidate IDs. Do not store full address, VIN, or phone in localStorage or partner handoff data.</p>
              </div>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Route</dt><dd className="font-black">{roadsideHandoffResult.route.replaceAll("_", " ")}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Market</dt><dd className="font-black capitalize">{roadsideHandoffResult.market.replaceAll("_", " ")}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Booking allowed</dt><dd className="font-black">{roadsideHandoffResult.bookingAllowed ? "Yes" : "No"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Dispatch job</dt><dd className="font-black">None</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Provider assignment</dt><dd className="font-black">None</dd></div>
              </dl>
              {roadsideHandoffResult.auditEvent && (
                <div className="mt-5 rounded-2xl border border-slate-200 p-4 text-xs font-semibold leading-5 text-slate-600">
                  <div className="font-black text-slate-900">{roadsideHandoffResult.auditEvent.type}</div>
                  <div>ID: {roadsideHandoffResult.auditEvent.id}</div>
                  <div>Partner candidates: {roadsideHandoffResult.auditEvent.partnerCandidateIds.join(", ") || "none"}</div>
                  <div>PII stored: {String(roadsideHandoffResult.auditEvent.piiStored)}</div>
                </div>
              )}
              {!roadsideMustHandoff && (
                <button
                  type="button"
                  onClick={() => setActiveTab("book")}
                  className="mt-5 w-full rounded-2xl bg-blue-700 px-5 py-4 text-base font-black text-white shadow-lg transition hover:bg-blue-800"
                >
                  Continue to ReGo booking
                </button>
              )}
            </section>
          </aside>
        </section>
      )}

      {activeTab === "vehicle" && (
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Garage</p>
            <h2 className="mt-1 text-2xl font-black">Vehicle profile</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {Object.entries(vehicle).map(([key, value]) => (
                <label key={key} className="block">
                  <span className="text-sm font-bold capitalize text-slate-600">{key}</span>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-700"
                    value={value}
                    onChange={(event) => updateDraft(() => setVehicle((current) => ({ ...current, [key]: event.target.value })))}
                  />
                </label>
              ))}
              <label className="block md:col-span-2">
                <span className="text-sm font-bold text-slate-600">Service address</span>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-700"
                  value={address}
                  onChange={(event) => updateDraft(() => setAddress(event.target.value))}
                />
              </label>
            </div>
          </div>
        </section>
      )}

      {activeTab === "history" && (
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Records</p>
            <h2 className="mt-1 text-2xl font-black">Service history</h2>
            <div className="mt-6 space-y-4">
              {serviceHistory.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{item.date} · {item.provider}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-black">{currency(item.total)}</div>
                      <Pill tone="green">{item.status}</Pill>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === "dispatch" && selectedDispatchJob && (
        <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[1fr_400px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Dispatch operations</p>
                  <h2 className="mt-1 text-2xl font-black">Marketplace job queue</h2>
                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                    Dispatcher/admin MVP for assignment, SLA risk, blockers, action placeholders, margin visibility, and audit history. Customer addresses and VINs remain masked.
                  </p>
                </div>
                <Pill tone="blue">Static ops demo</Pill>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-5">
                <div className="rounded-2xl bg-slate-950 p-4 text-white"><div className="text-2xl font-black">{dispatchQueue.summary.total}</div><div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Active jobs</div></div>
                <div className="rounded-2xl bg-amber-50 p-4 text-amber-900"><div className="text-2xl font-black">{dispatchQueue.summary.unassigned}</div><div className="text-xs font-bold uppercase tracking-[0.16em]">Unassigned</div></div>
                <div className="rounded-2xl bg-rose-50 p-4 text-rose-900"><div className="text-2xl font-black">{dispatchQueue.summary.blocked}</div><div className="text-xs font-bold uppercase tracking-[0.16em]">Blocked</div></div>
                <div className="rounded-2xl bg-orange-50 p-4 text-orange-900"><div className="text-2xl font-black">{dispatchQueue.summary.atRisk}</div><div className="text-xs font-bold uppercase tracking-[0.16em]">At risk</div></div>
                <div className="rounded-2xl bg-blue-50 p-4 text-blue-900"><div className="text-2xl font-black">{Object.keys(visibleDispatchGroups).length}</div><div className="text-xs font-bold uppercase tracking-[0.16em]">Visible groups</div></div>
              </div>
              <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-900">{dispatchNotice}</div>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  ["exceptions", "Exceptions"],
                  ["all", "All jobs"],
                  ["unassigned", "Unassigned"],
                  ["blocked", "Blocked"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDispatchFilter(value)}
                    className={`rounded-full px-4 py-2 text-sm font-black transition ${dispatchFilter === value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  ["status", "Status", dispatchFilterOptions.status],
                  ["risk", "Risk", dispatchFilterOptions.risk],
                  ["market", "Market", dispatchFilterOptions.market],
                  ["fulfillment", "Fulfillment", dispatchFilterOptions.fulfillment],
                  ["providerId", "Provider", dispatchFilterOptions.providerId],
                ].map(([key, label, options]) => (
                  <label key={key} className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    {label}
                    <select
                      value={dispatchFilters[key]}
                      onChange={(event) => setDispatchFilters((current) => ({ ...current, [key]: event.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-blue-700"
                    >
                      <option value="all">All {String(label).toLowerCase()}</option>
                      {options.map((option) => <option key={option} value={option}>{String(option).replaceAll("_", " ")}</option>)}
                    </select>
                  </label>
                ))}
                <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Group queue by
                  <select
                    value={dispatchGroupBy}
                    onChange={(event) => setDispatchGroupBy(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-blue-700"
                  >
                    <option value="status">Status</option>
                    <option value="risk">Risk</option>
                    <option value="market">Market</option>
                    <option value="fulfillmentId">Fulfillment</option>
                    <option value="providerId">Provider</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Queue</p>
                  <h2 className="mt-1 text-2xl font-black">Jobs requiring operational attention</h2>
                </div>
                <Pill tone={visibleDispatchJobs.length ? "amber" : "green"}>{visibleDispatchJobs.length} shown</Pill>
              </div>
              <div className="mt-5 space-y-5">
                {Object.entries(visibleDispatchGroups).map(([groupName, jobs]) => (
                  <div key={groupName} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">{String(groupName).replaceAll("_", " ")}</h3>
                      <Pill>{jobs.length} jobs</Pill>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {jobs.map((job) => (
                        <button
                          key={job.id}
                          type="button"
                          onClick={() => setSelectedDispatchJobId(job.id)}
                          className={`rounded-2xl border p-5 text-left transition ${selectedDispatchJob.id === job.id ? "border-blue-700 bg-blue-50 shadow-md" : "border-slate-200 bg-white hover:border-slate-400"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-black">{job.serviceName}</h3>
                              <p className="mt-1 text-sm font-semibold text-slate-600">{job.bookingId} · {job.market} · {job.scheduledWindow}</p>
                            </div>
                            <Pill tone={job.risk.level === "low" ? "green" : job.risk.level === "medium" ? "amber" : job.risk.level === "high" ? "orange" : "red"}>{job.risk.level}</Pill>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Pill tone={job.isUnassigned ? "amber" : "green"}>{job.providerName ?? "Unassigned"}</Pill>
                            <Pill tone={job.isBlocked ? "amber" : "slate"}>{job.status.replaceAll("_", " ")}</Pill>
                            <Pill>{job.fulfillmentId}</Pill>
                          </div>
                          <p className="mt-4 text-sm font-semibold text-slate-600">{job.risk.reasons.join(" ")}</p>
                          <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-bold text-slate-600">
                            <span className="rounded-xl bg-slate-50 p-2">Customer {job.maskedCustomer.displayName}</span>
                            <span className="rounded-xl bg-slate-50 p-2">{job.maskedCustomer.addressSummary}</span>
                            <span className="rounded-xl bg-slate-50 p-2">{job.maskedVehicle.vinMasked}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {visibleDispatchJobs.length === 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-600">No jobs match this deterministic filter.</div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Dispatcher actions</p>
              <h2 className="mt-2 text-2xl font-black">{selectedDispatchJob.bookingId}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">{selectedDispatchJob.serviceName} · {selectedDispatchJob.maskedVehicle.year} {selectedDispatchJob.maskedVehicle.make} {selectedDispatchJob.maskedVehicle.model}</p>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                <p><strong>Status:</strong> {selectedDispatchJob.status.replaceAll("_", " ")}</p>
                <p className="mt-1"><strong>SLA:</strong> {selectedDispatchJob.sla?.label} · {selectedDispatchJob.risk.reasons.join(" ")}</p>
                <p className="mt-1"><strong>Masked contact:</strong> {selectedDispatchJob.maskedCustomer.displayName} · {selectedDispatchJob.maskedCustomer.phoneMasked} · {selectedDispatchJob.maskedCustomer.addressSummary}</p>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                <p className="font-black">Assignment candidates</p>
                <div className="mt-3 space-y-3">
                  {selectedDispatchCandidates.matches.map((match) => (
                    <div key={match.providerId} className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900">
                      <div className="flex items-start justify-between gap-2">
                        <strong>{match.provider.name}</strong>
                        <span className="font-black">Score {Math.round(match.score)}</span>
                      </div>
                      <p className="mt-1 font-semibold">{match.reasons.slice(0, 3).join(" · ")}</p>
                    </div>
                  ))}
                  {selectedDispatchCandidates.matches.length === 0 && <p className="text-sm font-semibold text-amber-700">No eligible providers for this service/fulfillment right now.</p>}
                  {selectedDispatchCandidates.ineligible.slice(0, 2).map((match) => (
                    <p key={match.providerId} className="rounded-xl bg-slate-50 p-2 text-xs font-semibold text-slate-600">{match.provider.name}: {match.exclusions.join(", ")}</p>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  disabled={!bestDispatchCandidate || Boolean(selectedDispatchJob.providerId)}
                  onClick={() => updateDispatchJob(selectedDispatchJob.id, { type: MANUAL_ACTIONS.assign, providerId: bestDispatchCandidate.providerId, providerName: bestDispatchCandidate.provider.name, reason: "Assign best eligible provider from static matching results." }, `Assigned ${bestDispatchCandidate.provider.name} with audit metadata.`)}
                  className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Assign best eligible provider
                </button>
                <button
                  type="button"
                  disabled={!reassignDispatchCandidate}
                  onClick={() => updateDispatchJob(selectedDispatchJob.id, { type: MANUAL_ACTIONS.reassign, providerId: reassignDispatchCandidate.providerId, providerName: reassignDispatchCandidate.provider.name, reason: "Escalated reassignment to protect SLA and service quality." }, `Reassigned to ${reassignDispatchCandidate.provider.name} with explicit escalation reason and audit metadata.`)}
                  className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-black text-blue-800 transition hover:border-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Reassign with escalation reason
                </button>
                <button type="button" onClick={() => updateDispatchJob(selectedDispatchJob.id, { type: MANUAL_ACTIONS.escalate, reason: "Dispatcher escalated exception for manual follow-up." }, "Escalation placeholder recorded in audit trail.")} className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-black text-amber-800 transition hover:border-amber-600">Escalate</button>
                <button type="button" onClick={() => updateDispatchJob(selectedDispatchJob.id, { type: MANUAL_ACTIONS.cancelReschedule, reason: "Cancel/reschedule placeholder selected; policy workflow pending backend." }, "Cancel/reschedule placeholder recorded in audit trail.")} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:border-slate-500">Cancel / reschedule placeholder</button>
                {canResolveSelectedDispatchBlocker && (
                  <button type="button" onClick={() => updateDispatchJob(selectedDispatchJob.id, { type: MANUAL_ACTIONS.resolveBlocker, reason: "Blocker resolution placeholder completed by dispatcher." }, "Resolve blocker placeholder recorded in audit trail.")} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-800 transition hover:border-emerald-600">Resolve blocker placeholder</button>
                )}
              </div>

              <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-sm text-white">
                <p className="font-black">Gross margin placeholder</p>
                <div className="mt-3 space-y-2 font-semibold text-slate-200">
                  <div className="flex justify-between"><span>Customer total</span><strong>{selectedDispatchJob.margin.customerTotal == null ? "TBD" : currency(selectedDispatchJob.margin.customerTotal)}</strong></div>
                  <div className="flex justify-between"><span>Provider payout</span><strong>{selectedDispatchJob.margin.providerPayout == null ? "TBD" : currency(selectedDispatchJob.margin.providerPayout)}</strong></div>
                  <div className="flex justify-between"><span>Platform fee</span><strong>{selectedDispatchJob.margin.platformFee == null ? "TBD" : currency(selectedDispatchJob.margin.platformFee)}</strong></div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                <p className="font-black">Audit trail</p>
                <div className="mt-3 space-y-3">
                  {selectedDispatchJob.auditTrail.map((entry) => (
                    <div key={entry.id} className="rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                      <div className="font-black text-slate-900">{entry.action.replaceAll("_", " ")} · {entry.actorName ?? entry.actorId}</div>
                      <div>{entry.createdAt}</div>
                      <div>{entry.oldState} → {entry.newState} · {entry.oldProviderId ?? "none"} → {entry.newProviderId ?? "none"}</div>
                      <div className="mt-1">{entry.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </aside>
        </section>
      )}

      {activeTab === "provider" && selectedProviderJob && (
        <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Provider workbench</p>
                  <h2 className="mt-1 text-2xl font-black">Incoming and assigned work</h2>
                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                    Static operations MVP for provider-side decisions, readiness checks, work progress, report completion, and payout queue copy. No backend, auth, payments, or localStorage PII is used here.
                  </p>
                </div>
                <Pill tone="blue">Demo provider: Maria</Pill>
              </div>
              <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-900">{providerDecisionNotice}</div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {providerJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedProviderJobId(job.id)}
                    className={`rounded-2xl border p-5 text-left transition ${
                      selectedProviderJob.id === job.id ? "border-blue-700 bg-blue-50 shadow-md" : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black">{job.service}</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-600">{job.bookingId} · {job.scheduledWindow}</p>
                      </div>
                      <Pill tone={statusTone(job.status)}>{providerStatusLabel(job.status)}</Pill>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-slate-50 p-3"><span className="text-slate-500">Vehicle</span><strong className="block">{job.vehicle.year} {job.vehicle.make} {job.vehicle.model}</strong></div>
                      <div className="rounded-2xl bg-slate-50 p-3"><span className="text-slate-500">Masked location</span><strong className="block">{job.customer.addressSummary}</strong></div>
                      <div className="rounded-2xl bg-slate-50 p-3"><span className="text-slate-500">VIN</span><strong className="block">{job.vehicle.vinMasked}</strong></div>
                      <div className="rounded-2xl bg-slate-50 p-3"><span className="text-slate-500">Earnings</span><strong className="block">{currency(job.estimate.providerEarnings)}</strong></div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Decision and readiness</p>
                  <h2 className="mt-1 text-2xl font-black">{selectedProviderJob.service}</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    Customer {selectedProviderJob.customer.displayName} · {selectedProviderJob.fulfillment} · {selectedProviderJob.customer.phoneMasked} · {selectedProviderJob.customer.addressSummary}
                  </p>
                </div>
                <Pill tone={statusTone(selectedProviderJob.status)}>{providerStatusLabel(selectedProviderJob.status)}</Pill>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Parts / fitment</p>
                  <p className="mt-2 font-black">{selectedProviderJob.readiness.partsFitmentReady ? "Ready" : "Needs check"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tools</p>
                  <p className="mt-2 font-black">{selectedProviderJob.readiness.toolsReady ? "Ready" : "Needs check"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Arrival window</p>
                  <p className="mt-2 font-black">{selectedProviderJob.readiness.arrivalWindow}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="font-black">Customer approval for changes</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{selectedProviderJob.readiness.customerApprovalForChanges}</p>
                {selectedProviderJob.changeRequest && (
                  <p className="mt-2 text-sm font-bold text-amber-700">
                    Open change: {selectedProviderJob.changeRequest.summary} · {currency(selectedProviderJob.changeRequest.priceDelta)} · approval {selectedProviderJob.changeRequest.approvalStatus}
                  </p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {selectedCanAccept && (
                  <button
                    type="button"
                    onClick={() => updateProviderJob(selectedProviderJob.id, { type: "accept" }, "Provider accepted after feasibility, tools, parts, and arrival readiness checks.")}
                    className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Accept feasible work
                  </button>
                )}
                {selectedCanDecline && (
                  <button
                    type="button"
                    onClick={() => updateProviderJob(selectedProviderJob.id, { type: "decline", reason: "Demo decline: provider capacity or fitment risk" }, "Provider declined with reason: capacity or fitment risk.")}
                    className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
                  >
                    Decline with reason
                  </button>
                )}
                {!selectedCanAccept && !selectedCanDecline && (
                  <p className="rounded-2xl bg-slate-50 px-5 py-3 text-sm font-bold text-slate-600">No decision actions are valid for this job state.</p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Job progress</p>
              <h2 className="mt-1 text-2xl font-black">Canonical-compatible flow</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {canRequestSelectedCustomerApproval && (
                  <button
                    type="button"
                    onClick={() => updateProviderJob(selectedProviderJob.id, { type: "progress", nextStatus: PROVIDER_JOB_STATES.customerApprovalRequired }, "Customer approval requested for the pending scope or price change.")}
                    className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-black text-amber-800 transition hover:border-amber-600"
                  >
                    Request customer approval
                  </button>
                )}
                {providerProgressActions.map((action) => (
                  <button
                    key={action.status}
                    type="button"
                    onClick={() => updateProviderJob(selectedProviderJob.id, { type: "progress", nextStatus: action.status }, `Provider job moved to ${providerStatusLabel(action.status)}.`)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-blue-700 hover:text-blue-700"
                  >
                    {action.label}
                  </button>
                ))}
                {pendingSelectedCustomerApproval && selectedProviderJob.status === PROVIDER_JOB_STATES.customerApprovalRequired && (
                  <button
                    type="button"
                    onClick={approveSelectedChangeRequest}
                    className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 transition hover:border-emerald-600"
                  >
                    Record customer approval
                  </button>
                )}
                {!canRequestSelectedCustomerApproval && providerProgressActions.length === 0 && !(pendingSelectedCustomerApproval && selectedProviderJob.status === PROVIDER_JOB_STATES.customerApprovalRequired) && (
                  <p className="rounded-2xl bg-slate-50 px-5 py-3 text-sm font-bold text-slate-600">No progress actions are valid for this job state.</p>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Completion gate</p>
              <h2 className="mt-2 text-2xl font-black">Service report required</h2>
              <div className="mt-4 space-y-3 text-sm font-semibold text-slate-700">
                <div className="rounded-2xl bg-slate-50 p-4"><strong>Notes:</strong> {selectedProviderJob.report.notes || "Required before completion"}</div>
                <div className="rounded-2xl bg-slate-50 p-4"><strong>Photos:</strong> {selectedProviderJob.report.photos.length} attached</div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <strong>Checklist:</strong>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {selectedProviderJob.report.checklist.map((item) => <li key={item.id}>{item.completed ? "✓" : "○"} {item.label}</li>)}
                  </ul>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4"><strong>Invoice:</strong> {selectedProviderJob.report.invoice.label}</div>
              </div>
              {!selectedCompletionReadiness.ready && (
                <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  <p className="font-black">Blocked until:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {selectedCompletionReadiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                  </ul>
                </div>
              )}
              <button
                type="button"
                onClick={markSelectedReportReady}
                className="mt-5 w-full rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-black text-blue-800 transition hover:border-blue-700"
              >
                Fill static report fields
              </button>
              <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-black">Payout / earnings</p>
                <p className="mt-1 font-semibold">{selectedProviderJob.payout.copy}</p>
                <p className="mt-2 font-black">Queued demo earnings: {currency(queuedEarnings)}</p>
              </div>
            </section>
          </aside>
        </section>
      )}
    </main>
  );
}
