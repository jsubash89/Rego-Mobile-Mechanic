"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { fulfillmentOptions } from "@/data/fulfillment";
import { CREATE_XYZ_HERO_ASSET, CUSTOMER_NAV_ITEMS, HERO_SERVICES, LOCATION_TYPES, SCHEDULE_OPTIONS } from "@/data/createxyz-ux";
import { providerJobs as seededProviderJobs } from "@/data/provider-jobs";
import { dispatchJobs as seededDispatchJobs } from "@/data/dispatch-jobs";
import { providers } from "@/data/providers";
import { roadsidePartners, roadsideServiceTypes } from "@/data/roadside-partners";
import { oilOptions, services } from "@/data/services";
import { initialVehicle } from "@/data/vehicles";
import bookingState from "@/lib/booking-state";
import dispatchOperations from "@/lib/dispatch-operations";
import localStorageHelpers from "@/lib/local-storage";
import matching from "@/lib/provider-matching";
import pricing from "@/lib/pricing";
import providerOperations from "@/lib/provider-operations";
import roadsideHandoff from "@/lib/roadside-handoff";
import vehicleIdentity from "@/lib/vehicle-identity";

const { getBookingSteps, getConfirmationGuidance, transitionBooking } = bookingState;
const { DISPATCH_JOB_STATES, MANUAL_ACTIONS, applyDispatchAction, deriveDispatchQueue, getAssignmentCandidates, getReassignCandidate } = dispatchOperations;
const { loadBookingDraft, normalizeBookingDraft, saveBookingDraft } = localStorageHelpers;
const { deriveProviderSelection, getProviderMatchingResults } = matching;
const { calculateEstimate, formatEstimateAmount, getEstimateStatusCopy } = pricing;
const { getAllowedProviderJobTransitions, getCompletionReadiness, transitionProviderJob } = providerOperations;
const { buildRoadsideHandoff, isEmergencyRoadsideIntent } = roadsideHandoff;
const { minimizeVehicleIdentity, setExplicitVehicleVin, updateVehicleIdentity } = vehicleIdentity;

const DEFAULT_BOOKING_DRAFT = {
  selectedServiceId: "oil-change",
  fulfillmentId: "mobile",
  selectedOilId: "5w30",
  selectedProviderId: "maria",
  vehicle: { ...minimizeVehicleIdentity(initialVehicle), year: "2024", model: "Camry", trim: "LE", engine: "2.5L 4-Cylinder", transmission: "Automatic" },
  appointmentTime: "Today 2:30 PM",
};

const DEFAULT_MARKET = "chicago";

const ADD_ONS = [
  { id: "oil-filter", name: "Oil and Filter Change - Add On", price: 82.62 },
  { id: "front-wipers", name: "Front Windshield Wipers - Add On", price: 39.99 },
  { id: "rear-wiper", name: "Rear Windshield Wiper - Add On", price: 24.99 },
  { id: "cabin-filter", name: "Cabin Air Filter - Add On", price: 49.99 },
  { id: "engine-filter", name: "Engine Air Filter - Add On", price: 39.99 },
  { id: "tire-rotation", name: "Tire Rotation - Add On", price: 29.99 },
];

const VEHICLE_OPTIONS = {
  year: ["2026", "2025", "2024", "2023", "2022", "2021"],
  make: ["Toyota", "Honda", "Ford", "Chevrolet", "Nissan", "Hyundai"],
  model: ["Camry", "RAV4", "Accord", "F-150", "Altima", "Tucson"],
  trim: ["LE", "SE", "XLE", "Sport", "Limited"],
  engine: ["2.5L 4-Cylinder", "1.5L Turbo", "3.5L V6", "Hybrid"],
  transmission: ["Automatic", "CVT", "Manual"],
};

function money(amount, digits = 2) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number.isFinite(amount) ? amount : 0);
}

function serviceById(id) {
  return services.find((service) => service.id === id) ?? services[0];
}

function ModalShell({ children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-2 sm:p-4">
      <div className={`relative w-full ${wide ? "max-w-[760px]" : "max-w-[512px]"} rounded bg-white text-black shadow-2xl`}>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 text-xl leading-none text-slate-700 hover:text-black" aria-label="Close">×</button>
        {children}
      </div>
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="h-[31px] w-full rounded-sm border border-[#d9dee8] bg-white px-3 text-[12px] text-black outline-none focus:border-black">
        <option value="">Select {label}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function DemoAccess({
  activeDemo,
  setActiveDemo,
  providerJobs,
  dispatchJobs,
  activeProviderJobId,
  setActiveProviderJobId,
  activeDispatchJobId,
  setActiveDispatchJobId,
  onProviderEvent,
  onDispatchAction,
  providerDemoNotice,
  dispatchDemoNotice,
}) {
  const dispatchQueue = deriveDispatchQueue(dispatchJobs);
  const openProviderJobs = providerJobs.filter((job) => job.status !== "closed");
  const activeProviderJob = providerJobs.find((job) => job.id === activeProviderJobId) ?? providerJobs[0];
  const activeDispatchJob = dispatchQueue.jobs.find((job) => job.id === activeDispatchJobId) ?? dispatchQueue.jobs[0];
  const providerReadiness = getCompletionReadiness(activeProviderJob);
  const providerNextStatuses = getAllowedProviderJobTransitions(activeProviderJob?.status);
  const providerProgressStatuses = providerNextStatuses.filter((status) => !["accepted", "declined"].includes(status));

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 text-slate-800">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Internal demo access</p>
            <h3 className="mt-1 text-xl font-black">Provider and dispatch engines are preserved off the customer nav.</h3>
          </div>
          <div className="flex gap-2">
            {["provider", "dispatch"].map((demo) => (
              <button key={demo} type="button" onClick={() => setActiveDemo(activeDemo === demo ? null : demo)} className={`rounded-full px-4 py-2 text-sm font-black capitalize ${activeDemo === demo ? "bg-black text-white" : "bg-slate-100 text-slate-700"}`}>{demo}</button>
            ))}
          </div>
        </div>
        {activeDemo === "provider" && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.5fr]">
            <div className="space-y-2">
              {providerJobs.map((job) => (
                <button key={job.id} type="button" onClick={() => setActiveProviderJobId(job.id)} className={`w-full rounded-xl border p-3 text-left text-sm ${activeProviderJob?.id === job.id ? "border-black bg-slate-50" : "border-slate-200 bg-white"}`}>
                  <strong>{job.bookingId}</strong>
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase">{job.status}</span>
                  <p className="mt-1 text-xs text-slate-600">{job.service} · {job.scheduledWindow}</p>
                </button>
              ))}
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Provider workbench</p>
                  <h4 className="mt-1 text-lg font-black">{activeProviderJob?.bookingId} · {activeProviderJob?.status}</h4>
                  <p className="mt-1 text-sm text-slate-600">{activeProviderJob?.vehicle?.year} {activeProviderJob?.vehicle?.make} {activeProviderJob?.vehicle?.model} · {activeProviderJob?.customer?.addressSummary}</p>
                </div>
                <div className="rounded-lg bg-white px-3 py-2 text-xs font-black">{openProviderJobs.length} open jobs</div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => onProviderEvent(activeProviderJob.id, { type: "accept" })} disabled={activeProviderJob?.status !== "offered"} className="rounded bg-black px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">Accept offer</button>
                <button type="button" onClick={() => onProviderEvent(activeProviderJob.id, { type: "decline", reason: "Demo provider capacity conflict" })} disabled={!providerNextStatuses.includes("declined")} className="rounded bg-white px-3 py-2 text-xs font-black text-slate-900 disabled:text-slate-300">Decline with reason</button>
                {providerProgressStatuses.map((status) => (
                  <button key={status} type="button" onClick={() => onProviderEvent(activeProviderJob.id, { type: "progress", nextStatus: status })} className="rounded bg-white px-3 py-2 text-xs font-black text-slate-900">Progress to {status.replaceAll("_", " ")}</button>
                ))}
              </div>
              <div className="mt-4 rounded-lg bg-white p-3 text-xs text-slate-700">
                <strong>Completion readiness:</strong> {providerReadiness.ready ? "Ready to complete" : providerReadiness.blockers.join(" ")}
              </div>
              {providerDemoNotice && <p className="mt-3 rounded bg-amber-50 p-2 text-xs font-bold text-amber-900">{providerDemoNotice}</p>}
            </div>
          </div>
        )}
        {activeDemo === "dispatch" && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.5fr]">
            <div className="space-y-2">
              {dispatchQueue.jobs.map((job) => (
                <button key={job.id} type="button" onClick={() => setActiveDispatchJobId(job.id)} className={`w-full rounded-xl border p-3 text-left text-sm ${activeDispatchJob?.id === job.id ? "border-black bg-slate-50" : "border-slate-200 bg-white"}`}>
                  <strong>{job.bookingId}</strong>
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase">{job.status}</span>
                  <p className="mt-1 text-xs text-slate-600">{job.serviceName} · risk {job.risk.level}</p>
                </button>
              ))}
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="rounded-lg bg-white p-3"><strong>{dispatchQueue.summary.total}</strong><p className="text-xs text-slate-600">active</p></div>
                <div className="rounded-lg bg-white p-3"><strong>{dispatchQueue.summary.unassigned}</strong><p className="text-xs text-slate-600">unassigned</p></div>
                <div className="rounded-lg bg-white p-3"><strong>{dispatchQueue.summary.blocked}</strong><p className="text-xs text-slate-600">blocked</p></div>
                <div className="rounded-lg bg-white p-3"><strong>{dispatchQueue.summary.atRisk}</strong><p className="text-xs text-slate-600">at risk</p></div>
              </div>
              <h4 className="mt-4 text-lg font-black">{activeDispatchJob?.bookingId} · {activeDispatchJob?.status}</h4>
              <p className="mt-1 text-sm text-slate-600">{activeDispatchJob?.maskedCustomer?.addressSummary} · provider {activeDispatchJob?.providerName ?? "unassigned"}</p>
              <p className="mt-2 rounded bg-white p-2 text-xs font-semibold text-slate-700">{activeDispatchJob?.risk?.reasons?.join(" ")}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => onDispatchAction(activeDispatchJob.id, MANUAL_ACTIONS.assign)} disabled={activeDispatchJob?.providerId != null || ![DISPATCH_JOB_STATES.offered, DISPATCH_JOB_STATES.confirmed].includes(activeDispatchJob?.status)} className="rounded bg-black px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">Assign best provider</button>
                <button type="button" onClick={() => onDispatchAction(activeDispatchJob.id, MANUAL_ACTIONS.reassign)} disabled={!activeDispatchJob?.providerId} className="rounded bg-white px-3 py-2 text-xs font-black text-slate-900 disabled:text-slate-300">Reassign with override</button>
                <button type="button" onClick={() => onDispatchAction(activeDispatchJob.id, MANUAL_ACTIONS.escalate)} className="rounded bg-white px-3 py-2 text-xs font-black text-slate-900">Escalate</button>
                <button type="button" onClick={() => onDispatchAction(activeDispatchJob.id, MANUAL_ACTIONS.resolveBlocker)} disabled={activeDispatchJob?.status !== DISPATCH_JOB_STATES.blocked && !activeDispatchJob?.blocker} className="rounded bg-white px-3 py-2 text-xs font-black text-slate-900 disabled:text-slate-300">Resolve blocker</button>
              </div>
              {dispatchDemoNotice && <p className="mt-3 rounded bg-amber-50 p-2 text-xs font-bold text-amber-900">{dispatchDemoNotice}</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function ReGoCustomerShell() {
  const addressInputRef = useRef(null);
  const [selectedHeroServiceId, setSelectedHeroServiceId] = useState("oil-change");
  const [selectedServiceId, setSelectedServiceId] = useState(DEFAULT_BOOKING_DRAFT.selectedServiceId);
  const [fulfillmentId, setFulfillmentId] = useState(DEFAULT_BOOKING_DRAFT.fulfillmentId);
  const [selectedOilId, setSelectedOilId] = useState(DEFAULT_BOOKING_DRAFT.selectedOilId);
  const [selectedProviderId, setSelectedProviderId] = useState(DEFAULT_BOOKING_DRAFT.selectedProviderId);
  const [vehicle, setVehicle] = useState(DEFAULT_BOOKING_DRAFT.vehicle);
  const [vinInput, setVinInput] = useState("");
  const [address, setAddress] = useState("123 Main St, Anytown, USA");
  const [locationNotes, setLocationNotes] = useState("");
  const [locationType, setLocationType] = useState("Home");
  const [appointmentTime, setAppointmentTime] = useState(DEFAULT_BOOKING_DRAFT.appointmentTime);
  const [schedulePreference, setSchedulePreference] = useState("");
  const [activeModal, setActiveModal] = useState(null);
  const [vehicleTab, setVehicleTab] = useState("make-model");
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [addressEditing, setAddressEditing] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftNotice, setDraftNotice] = useState("Draft saves locally with VIN and address minimized.");
  const [providerJobs, setProviderJobs] = useState(seededProviderJobs);
  const [dispatchJobs, setDispatchJobs] = useState(seededDispatchJobs);
  const [activeDemo, setActiveDemo] = useState(null);
  const [activeProviderJobId, setActiveProviderJobId] = useState(seededProviderJobs[0]?.id);
  const [activeDispatchJobId, setActiveDispatchJobId] = useState(seededDispatchJobs[0]?.id);
  const [providerDemoNotice, setProviderDemoNotice] = useState("");
  const [dispatchDemoNotice, setDispatchDemoNotice] = useState("");
  const [roadsideMarket, setRoadsideMarket] = useState("chicago");

  const selectedHeroService = HERO_SERVICES.find((service) => service.id === selectedHeroServiceId) ?? HERO_SERVICES[0];
  const selectedService = serviceById(selectedServiceId);
  const fulfillment = fulfillmentOptions.find((option) => option.id === fulfillmentId) ?? fulfillmentOptions[0];
  const selectedOil = oilOptions.find((oil) => oil.id === selectedOilId) ?? oilOptions[0];
  const providerSelection = useMemo(() => deriveProviderSelection({
    providers,
    selectedProviderId,
    appointmentTime,
    request: { service: selectedService, fulfillment, market: DEFAULT_MARKET },
  }), [appointmentTime, fulfillment, selectedProviderId, selectedService]);
  const selectedProvider = providerSelection.provider;
  const effectiveProviderId = providerSelection.selectedProviderId;
  const effectiveAppointmentTime = providerSelection.appointmentTime;
  const providerMatches = useMemo(() => getProviderMatchingResults(providers, { service: selectedService, fulfillment, market: DEFAULT_MARKET }).matches, [fulfillment, selectedService]);
  const estimate = useMemo(() => calculateEstimate({ service: selectedService, oil: selectedOil, fulfillment }), [fulfillment, selectedOil, selectedService]);
  const estimateCopy = getEstimateStatusCopy(estimate, { service: selectedService, provider: selectedProvider });
  const addOnTotal = selectedAddOns.reduce((sum, addOnId) => sum + (ADD_ONS.find((addOn) => addOn.id === addOnId)?.price ?? 0), 0);
  const subtotal = estimate.total + addOnTotal;
  const tax = Math.round(subtotal * 0.03 * 100) / 100;
  const total = subtotal + tax;
  const roadsideIntent = roadsideServiceTypes.find((intent) => intent.id === "tow") ?? roadsideServiceTypes[0];
  const roadsideHandoffResult = useMemo(() => buildRoadsideHandoff({
    market: roadsideMarket,
    serviceType: "tow",
    summary: roadsideIntent?.label ?? "Tow",
    partners: roadsidePartners,
  }), [roadsideIntent?.label, roadsideMarket]);
  const bookingDraft = useMemo(() => ({
    service: selectedService,
    fulfillment,
    oil: selectedOil,
    provider: selectedProvider,
    vehicle,
    appointmentTime: effectiveAppointmentTime,
    estimate,
    confirmed: bookingConfirmed,
  }), [bookingConfirmed, effectiveAppointmentTime, estimate, fulfillment, selectedOil, selectedProvider, selectedService, vehicle]);
  const steps = getBookingSteps(bookingDraft);
  const confirmationGuidance = getConfirmationGuidance(bookingDraft);
  const isOilService = selectedService.id === "oil-change";

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
        market: DEFAULT_MARKET,
      });
      if (normalizedDraft) {
        // Loading after mount avoids server/client hydration mismatches for browser-only localStorage.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedServiceId(normalizedDraft.selectedServiceId);
        setSelectedOilId(normalizedDraft.selectedOilId);
        setFulfillmentId(normalizedDraft.fulfillmentId);
        setSelectedProviderId(normalizedDraft.selectedProviderId);
        setVehicle(normalizedDraft.vehicle);
        setAppointmentTime(normalizedDraft.appointmentTime ?? DEFAULT_BOOKING_DRAFT.appointmentTime);
        setDraftNotice(changed ? "Restored your booking draft and refreshed stale selections. Full VIN and address were not stored." : "Restored your booking draft. Full VIN and address were not stored.");
      }
    }
    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    saveBookingDraft({ vehicle, selectedServiceId, fulfillmentId, selectedProviderId: effectiveProviderId, selectedOilId, appointmentTime: effectiveAppointmentTime });
  }, [draftHydrated, effectiveAppointmentTime, effectiveProviderId, fulfillmentId, selectedOilId, selectedServiceId, vehicle]);

  function chooseHeroService(heroService) {
    setSelectedHeroServiceId(heroService.id);
    setBookingConfirmed(false);
    if (heroService.id === "tow") {
      setActiveModal("roadside");
      return;
    }
    if (heroService.engineServiceId) {
      setSelectedServiceId(heroService.engineServiceId);
    }
  }

  function startScheduling() {
    if (selectedHeroServiceId === "tow") {
      setActiveModal("roadside");
      return;
    }
    setActiveModal("vehicle");
  }

  function updateVehicle(field, value) {
    setBookingConfirmed(false);
    setVehicle((current) => updateVehicleIdentity(current, field, value));
  }

  function continueFromVehicle() {
    if (vehicleTab === "vin" && vinInput.trim()) {
      setVehicle((current) => setExplicitVehicleVin(current, vinInput));
    }
    setActiveModal("schedule");
  }

  function continueFromSchedule(preference) {
    setSchedulePreference(preference);
    const nextTime = preference === "Earliest Available" ? (providerMatches[0]?.earliestSlot ?? "Earliest available") : preference;
    setAppointmentTime(nextTime);
    setSelectedProviderId(providerMatches[0]?.providerId ?? selectedProviderId);
    setActiveModal("details");
  }

  function toggleAddOn(addOnId) {
    setSelectedAddOns((current) => current.includes(addOnId) ? current.filter((id) => id !== addOnId) : [...current, addOnId]);
  }

  function proceedToCheckout() {
    setActiveModal("location");
  }

  function finishLocation() {
    const nextBooking = transitionBooking(bookingDraft, "confirm");
    setBookingConfirmed(nextBooking.confirmed === true);
    if (nextBooking.confirmed === true) {
      setActiveModal(null);
    }
  }

  function toggleAddressEditing() {
    setAddressEditing((current) => !current);
    window.requestAnimationFrame(() => {
      addressInputRef.current?.focus();
      addressInputRef.current?.select();
    });
  }

  function handleProviderEvent(jobId, event) {
    const job = providerJobs.find((candidate) => candidate.id === jobId);
    if (!job) return;

    const result = transitionProviderJob(job, event);
    setProviderJobs((currentJobs) => currentJobs.map((currentJob) => (currentJob.id === jobId ? result.job : currentJob)));
    setProviderDemoNotice(result.ok ? `Provider job ${job.bookingId} moved to ${result.job.status}.` : result.blockers.join(" "));
  }

  function handleDispatchAction(jobId, actionType) {
    const job = dispatchJobs.find((candidate) => candidate.id === jobId);
    if (!job) return;

    const candidates = getAssignmentCandidates(job, providers).matches;
    const assignmentCandidate = actionType === MANUAL_ACTIONS.reassign ? getReassignCandidate(job, candidates) : candidates[0];
    const action = {
      type: actionType,
      actor: { type: "dispatcher", id: "ops-demo", name: "Ops demo dispatcher" },
      reason: "Internal demo state-machine action from the customer shell.",
      timestamp: new Date().toISOString(),
    };

    if ([MANUAL_ACTIONS.assign, MANUAL_ACTIONS.reassign].includes(actionType)) {
      action.providerId = assignmentCandidate?.providerId;
      action.providerName = assignmentCandidate?.provider?.name ?? assignmentCandidate?.providerId;
      action.override = actionType === MANUAL_ACTIONS.reassign;
    }

    const result = applyDispatchAction(job, action, providers);
    setDispatchJobs((currentJobs) => currentJobs.map((currentJob) => (currentJob.id === jobId ? result.job : currentJob)));
    setDispatchDemoNotice(result.ok ? `Dispatch job ${job.bookingId} action applied: ${actionType}.` : result.blockers.join(" "));
  }

  return (
    <main className="min-h-screen bg-white font-sans text-black">
      <header className="h-[49px] bg-black text-white">
        <div className="mx-auto flex h-full max-w-[1063px] items-center justify-between px-5">
          <div className="flex items-center gap-3 text-[13px] font-bold">
            <span className="text-[18px] font-black tracking-tight">REG<span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[8px]">O</span></span>
            <span className="h-5 w-px bg-white/70" />
            <span>Mobile Mechanic</span>
          </div>
          <nav className="hidden items-center gap-7 text-[12px] font-bold md:flex">
            {CUSTOMER_NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-[#ffd400]">{item.label}</a>
            ))}
            <button type="button" className="hover:text-[#ffd400]">Login</button>
            <button type="button" className="rounded-md bg-[#ffd400] px-4 py-2 text-black hover:bg-[#e9c000]">Sign Up</button>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-[860px] gap-8 px-6 pb-10 pt-9 lg:grid-cols-[390px_390px] lg:items-start">
        <div>
          <h1 className="text-[40px] font-black leading-[1.02] tracking-tight">On-Demand Auto<br />Service</h1>
          <h2 className="mt-2 text-[28px] font-black leading-tight text-[#6b7280]">Right Where You Are</h2>
          <p className="mt-4 max-w-[390px] text-[13px] leading-5 text-[#243044]">Professional mechanics ready to service your vehicle wherever you are</p>

          <div className="mt-5 grid grid-cols-3 gap-[10px]">
            {HERO_SERVICES.map((service) => {
              const selected = selectedHeroServiceId === service.id;
              return (
                <button key={service.id} type="button" onClick={() => chooseHeroService(service)} className={`h-[82px] rounded-lg border text-center transition ${selected ? "border-black bg-black text-white shadow-lg" : "border-[#e5e7eb] bg-white text-black hover:border-black"}`}>
                  <div className="text-[24px] font-black leading-8">{service.icon}</div>
                  <div className="mt-1 text-[11px] font-bold">{service.name}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-[22px] flex h-[42px] items-center rounded-lg border border-[#eef0f4] bg-[#f8f9fb] px-3">
            <span className="mr-3 text-[#9aa3b2]">●</span>
            <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Where will we service your vehicle?" className="w-full bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-[#9ca3af]" />
          </div>
          <button type="button" onClick={startScheduling} className="mt-4 h-[40px] w-full rounded-lg bg-black text-[13px] font-black text-white shadow-lg transition hover:bg-slate-800">Schedule Now</button>
          {bookingConfirmed && (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center text-[12px] font-black text-emerald-800">Booking confirmed for {effectiveAppointmentTime} with {selectedProvider?.name ?? "your provider"}. We&apos;ll keep this compact confirmation visible after checkout.</p>
          )}
          <p className="mt-3 text-center text-[11px] font-semibold text-slate-500">{draftNotice}</p>
        </div>

        <div
          aria-label="Smiling ReGo mechanic ready for mobile service"
          className="relative h-[467px] overflow-hidden rounded-[10px] bg-[#d8d8d8] bg-cover bg-center shadow-xl"
          role="img"
          style={{ backgroundImage: `url(${CREATE_XYZ_HERO_ASSET})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/5" />
          <div className="absolute bottom-5 right-5 rounded-full bg-white px-4 py-2 text-xs font-black text-black shadow-lg">4.9 ★ trusted</div>
        </div>
      </section>

      <section id="about" className="bg-[#f5f6f8] px-6 py-[60px] text-center">
        <h2 className="mx-auto max-w-[980px] text-[40px] font-black leading-[1.02] text-[#2b2d31]">ReGo Mobile Mechanic is the most convenient basic<br className="hidden md:block" /> auto service around</h2>
        <p className="mx-auto mt-5 max-w-[520px] text-[14px] leading-5 text-[#26364f]">Your time is precious, so why waste it sitting around at a shop that tries to sell you repairs you don&apos;t actually need?</p>
      </section>

      <section id="service-area" className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-4 md:grid-cols-3">
          {steps.slice(0, 3).map((step) => <div key={step.id} className="rounded-2xl border border-slate-200 p-5"><strong>{step.number}. {step.label}</strong><p className="mt-2 text-sm text-slate-600">{step.complete ? "Ready" : step.active ? "Current step" : "Upcoming"}</p></div>)}
        </div>
        <div id="mechanic-signup-info" className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Mechanic Sign Up</p>
          <h3 className="mt-2 text-xl font-black text-slate-900">Interested in servicing ReGo customers?</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Provider onboarding remains separated from the customer booking path. This customer-nav link preserves the create.xyz label while keeping internal provider and dispatch demo controls out of top-level customer navigation.</p>
        </div>
      </section>

      <div id="demo-access">
        <DemoAccess
          activeDemo={activeDemo}
          setActiveDemo={setActiveDemo}
          providerJobs={providerJobs}
          dispatchJobs={dispatchJobs}
          activeProviderJobId={activeProviderJobId}
          setActiveProviderJobId={setActiveProviderJobId}
          activeDispatchJobId={activeDispatchJobId}
          setActiveDispatchJobId={setActiveDispatchJobId}
          onProviderEvent={handleProviderEvent}
          onDispatchAction={handleDispatchAction}
          providerDemoNotice={providerDemoNotice}
          dispatchDemoNotice={dispatchDemoNotice}
        />
      </div>

      {activeModal === "vehicle" && (
        <ModalShell onClose={() => setActiveModal(null)}>
          <div className="p-4">
            <h2 className="text-[18px] font-black">Let&apos;s get some information about your vehicle</h2>
            <p className="mt-2 text-[12px] text-slate-600">Enter your vehicle&apos;s make and model or VIN number</p>
            <div className="mt-4 flex gap-1">
              <button type="button" onClick={() => setVehicleTab("make-model")} className={`rounded-sm px-3 py-2 text-[12px] ${vehicleTab === "make-model" ? "bg-[#e5e7eb]" : "bg-[#f4f5f7]"}`}>Make &amp; Model</button>
              <button type="button" onClick={() => setVehicleTab("vin")} className={`rounded-sm px-3 py-2 text-[12px] ${vehicleTab === "vin" ? "bg-[#e5e7eb]" : "bg-[#f4f5f7]"}`}>VIN</button>
            </div>
            {vehicleTab === "make-model" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <SelectField label="Year" value={vehicle.year} options={VEHICLE_OPTIONS.year} onChange={(value) => updateVehicle("year", value)} />
                <SelectField label="Make" value={vehicle.make} options={VEHICLE_OPTIONS.make} onChange={(value) => updateVehicle("make", value)} />
                <SelectField label="Model" value={vehicle.model} options={VEHICLE_OPTIONS.model} onChange={(value) => updateVehicle("model", value)} />
                <SelectField label="Trim" value={vehicle.trim} options={VEHICLE_OPTIONS.trim} onChange={(value) => updateVehicle("trim", value)} />
                <SelectField label="Engine" value={vehicle.engine} options={VEHICLE_OPTIONS.engine} onChange={(value) => updateVehicle("engine", value)} />
                <SelectField label="Transmission" value={vehicle.transmission} options={VEHICLE_OPTIONS.transmission} onChange={(value) => updateVehicle("transmission", value)} />
              </div>
            ) : (
              <input value={vinInput} onChange={(event) => setVinInput(event.target.value)} placeholder="Enter VIN" className="mt-3 h-[36px] w-full rounded-sm border border-[#d9dee8] px-3 text-[12px] outline-none focus:border-black" />
            )}
            <div className="mt-4 flex justify-between">
              <button type="button" onClick={() => setActiveModal(null)} className="rounded bg-[#e5e7eb] px-4 py-2 text-[12px] font-bold">Back</button>
              <button type="button" onClick={continueFromVehicle} className="rounded bg-black px-5 py-2 text-[12px] font-bold text-white">Next</button>
            </div>
          </div>
        </ModalShell>
      )}

      {activeModal === "schedule" && (
        <ModalShell onClose={() => setActiveModal(null)}>
          <div className="p-4">
            <h2 className="text-[16px] font-black">How would you like to schedule?</h2>
            <div className="mt-4 space-y-3">
              {SCHEDULE_OPTIONS.map((option) => (
                <button key={option.label} type="button" onClick={() => continueFromSchedule(option.label)} className={`flex min-h-[72px] w-full items-center gap-3 rounded border px-4 py-3 text-left ${schedulePreference === option.label ? "border-black bg-slate-50" : "border-[#d9dee8] bg-white"}`}>
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[16px] font-black">●</span>
                  <span><strong className="block text-[13px]">{option.label}</strong><span className="mt-1 block text-[11px] font-semibold leading-4 text-slate-500">{option.helper}</span></span>
                </button>
              ))}
            </div>
          </div>
        </ModalShell>
      )}

      {activeModal === "details" && (
        <ModalShell onClose={() => setActiveModal(null)} wide>
          <div className="bg-[#f4f5f7] pb-4">
            <div className="rounded-t bg-black p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[24px] font-black">Service Details</h2>
                <button type="button" onClick={() => setActiveModal("vehicle")} className="rounded bg-white px-3 py-2 text-[11px] font-black text-black">Change Service</button>
              </div>
              <p className="mt-2 text-[12px] font-bold">▣ {vehicle.year} {vehicle.make} {vehicle.model}</p>
              <p className="mt-1 text-[12px] font-bold">▰ {selectedHeroService.name} Service</p>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <section className="min-h-[492px] rounded bg-white p-4 shadow-sm">
                <h3 className="text-[16px] font-black">Price Breakdown</h3>
                <p className="mt-4 text-[12px] font-bold">Labor</p>
                <div className="mt-2 flex justify-between text-[11px]"><span>Labor Fees</span><span>{formatEstimateAmount(estimate.labor, { formatter: money })}</span></div>
                {isOilService ? (
                  <>
                    <p className="mt-5 text-[12px] font-bold">Parts</p>
                    <div className="mt-2 space-y-2 text-[11px]">
                      <div className="flex justify-between"><span>Oil Drain Plug Gasket</span><span>$5.99</span></div>
                      <div className="flex justify-between"><span>Oil Filter</span><span>$15.99</span></div>
                      <div className="flex justify-between"><span>Synthetic Engine Oil - 1Qt</span><span>$8.00</span></div>
                      <div className="flex justify-between"><span>Synthetic Engine Oil - 5Qt</span><span>{formatEstimateAmount(estimate.parts, { tbd: estimate.partsTbd, formatter: money })}</span></div>
                    </div>
                    {["Synthetic Engine Oil", "Oil Filter"].map((title) => (
                      <details key={title} open className="mt-5 rounded border border-[#d9dee8] p-3">
                        <summary className="cursor-pointer text-[12px] font-black">{title}</summary>
                        <p className="mt-2 text-[10px] leading-4 text-slate-600">{title === "Synthetic Engine Oil" ? "We use high quality Mobile 1 Synthetic oil. It&apos;s imperative to choose quality oil such as Mobile 1 because it has been developed to provide your vehicle with premium protection and performance." : "An oil filter keeps the oil clean and free of debris. If the filter is not replaced on a regular basis, it will get clogged and will not be able to pass oil into the engine."}</p>
                      </details>
                    ))}
                  </>
                ) : (
                  <div className="mt-5 rounded border border-[#d9dee8] p-3 text-[12px]">
                    <p className="font-black">Service estimate</p>
                    <div className="mt-2 flex justify-between text-[11px]"><span>{selectedService.name} parts/materials</span><span>{formatEstimateAmount(estimate.parts, { tbd: estimate.partsTbd, formatter: money })}</span></div>
                    <p className="mt-3 text-[10px] leading-4 text-slate-600">Exact parts are finalized by fitment and provider confirmation, so this view avoids oil-specific line items for non-oil services.</p>
                  </div>
                )}
              </section>
              <div className="space-y-4">
                <section className="rounded bg-white p-4 shadow-sm">
                  <h3 className="text-[16px] font-black">Add-ons</h3>
                  <div className="mt-4 space-y-2">
                    {ADD_ONS.map((addOn) => (
                      <button key={addOn.id} type="button" onClick={() => toggleAddOn(addOn.id)} className={`flex w-full items-center justify-between rounded border px-2 py-2 text-left text-[11px] ${selectedAddOns.includes(addOn.id) ? "border-black bg-slate-50" : "border-[#d9dee8] bg-white"}`}>
                        <span><span className="mr-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-slate-400 text-[9px] text-white">+</span>{addOn.name}</span>
                        <span className="text-blue-700">{money(addOn.price)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 border-t border-slate-200 pt-3 text-[11px]">
                    <p className="font-black">Selected Add-ons</p>
                    <p className="mt-2 text-slate-500">{selectedAddOns.length ? selectedAddOns.map((id) => ADD_ONS.find((addOn) => addOn.id === id)?.name).filter(Boolean).join(", ") : "No add-ons selected"}</p>
                    <div className="mt-3 flex justify-between font-black"><span>Add-on Total:</span><span>{money(addOnTotal)}</span></div>
                  </div>
                </section>
                <section className="rounded bg-white p-4 shadow-sm">
                  <div className="space-y-3 text-[12px]"><div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between"><span>Tax</span><span>{money(tax)}</span></div><div className="flex justify-between text-[14px] font-black"><span>Total</span><span>{money(total)}</span></div></div>
                  <p className="mt-3 rounded bg-slate-50 p-2 text-[10px] font-semibold text-slate-600">{estimateCopy.summary}</p>
                  <button type="button" onClick={proceedToCheckout} className="mt-3 h-[29px] w-full rounded bg-black text-[12px] font-black text-white">Proceed to Checkout</button>
                </section>
              </div>
            </div>
          </div>
        </ModalShell>
      )}

      {activeModal === "location" && (
        <ModalShell onClose={() => setActiveModal(null)}>
          <div className="p-4">
            <h2 className="text-[16px] font-black">Where will we service the vehicle?</h2>
            <div className="mt-4 flex h-[32px] items-center justify-between rounded border border-[#d9dee8] px-2 text-[12px]">
              <input ref={addressInputRef} value={address} readOnly={!addressEditing} onChange={(event) => setAddress(event.target.value)} className={`w-full outline-none ${addressEditing ? "bg-white" : "bg-transparent"}`} />
              <button type="button" onClick={toggleAddressEditing} className="shrink-0 text-[11px] text-blue-700">{addressEditing ? "Done" : "Change Address"}</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-3">
              {LOCATION_TYPES.map((type) => (
                <label key={type} className={`inline-flex h-9 items-center gap-2 rounded border px-3 font-semibold ${locationType === type ? "border-black bg-slate-50" : "border-[#d9dee8] bg-white"}`}><input type="radio" checked={locationType === type} onChange={() => setLocationType(type)} />{type}</label>
              ))}
            </div>
            <label className="mt-4 block text-[12px]">Location Notes
              <textarea value={locationNotes} maxLength={1000} onChange={(event) => setLocationNotes(event.target.value)} placeholder="Let us know details of how to find your car." className="mt-2 h-[78px] w-full rounded border border-[#d9dee8] p-3 text-[12px] outline-none focus:border-black" />
            </label>
            <p className="mt-2 text-[11px] text-slate-500">1000 character maximum · {1000 - locationNotes.length} characters left</p>
            <div className="mt-4 flex justify-between"><button type="button" onClick={() => setActiveModal("details")} className="rounded bg-[#e5e7eb] px-4 py-2 text-[12px] font-bold">Back</button><button type="button" onClick={finishLocation} className="rounded bg-black px-5 py-2 text-[12px] font-bold text-white">Next</button></div>
            {bookingConfirmed && <p className="mt-3 rounded bg-emerald-50 p-2 text-[12px] font-bold text-emerald-800">Booking ready. Confirmation is in memory only and is not persisted.</p>}
            {!confirmationGuidance.ready && <p className="mt-3 rounded bg-amber-50 p-2 text-[12px] font-bold text-amber-800">{confirmationGuidance.message}</p>}
          </div>
        </ModalShell>
      )}

      {activeModal === "roadside" && (
        <ModalShell onClose={() => setActiveModal(null)}>
          <div className="p-5">
            <h2 className="text-[20px] font-black">Partner handoff for Car Tow</h2>
            <p className="mt-2 text-[13px] font-semibold leading-5 text-slate-700">Towing and urgent roadside requests are partner-routed only. ReGo will not create a normal mechanic booking, provider assignment, or dispatch job for this request.</p>
            <label className="mt-4 block text-[12px] font-bold">Market
              <select value={roadsideMarket} onChange={(event) => setRoadsideMarket(event.target.value)} className="mt-2 h-9 w-full rounded border border-slate-200 px-3 text-[12px]">
                {["chicago", "detroit", "indianapolis", "milwaukee", "national_fallback", "boise"].map((market) => <option key={market} value={market}>{market.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <div className="mt-4 rounded bg-red-50 p-3 text-[12px] font-semibold text-red-950">{isEmergencyRoadsideIntent("tow") ? roadsideHandoffResult.guidance : "This roadside selection may be eligible for normal booking when non-emergency."}</div>
            <div className="mt-4 space-y-3">
              {roadsideHandoffResult.partnerCandidates.length ? roadsideHandoffResult.partnerCandidates.map((partner) => (
                <article key={partner.id} className="rounded border border-slate-200 p-3 text-[12px]"><strong className="text-[14px]">{partner.name}</strong><p className="mt-1 text-slate-600">{partner.coverage} · {partner.slaEstimate}</p><p className="mt-2 font-semibold">{partner.contactChannels.map((channel) => `${channel.label}: ${channel.value}`).join(" · ")}</p></article>
              )) : <p className="rounded bg-amber-50 p-3 text-[12px] font-bold text-amber-900">No static partner card for this market; no ReGo booking will be created.</p>}
            </div>
            <button type="button" onClick={() => setActiveModal(null)} className="mt-4 w-full rounded bg-black px-5 py-3 text-[12px] font-black text-white">Back to ReGo</button>
          </div>
        </ModalShell>
      )}
    </main>
  );
}
