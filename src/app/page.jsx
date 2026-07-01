"use client";

import React, { useMemo, useState } from "react";

import { fulfillmentOptions } from "@/data/fulfillment";
import { serviceHistory } from "@/data/history";
import { providers } from "@/data/providers";
import { oilOptions, services } from "@/data/services";
import { initialVehicle } from "@/data/vehicles";
import bookingState from "@/lib/booking-state";
import matching from "@/lib/provider-matching";
import pricing from "@/lib/pricing";

const { chooseSelectedProvider, getProviderMatchingResults } = matching;
const { calculateEstimate, formatEstimateAmount } = pricing;
const { canConfirmBooking, getBookingState, getBookingSteps, requiresPartsSelection, transitionBooking } = bookingState;

function currency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export default function MobileMechanicMarketplace() {
  const [activeTab, setActiveTab] = useState("book");
  const [selectedServiceId, setSelectedServiceId] = useState("oil-change");
  const [fulfillmentId, setFulfillmentId] = useState("mobile");
  const [selectedOilId, setSelectedOilId] = useState("recommended");
  const [selectedProviderId, setSelectedProviderId] = useState("maria");
  const [vehicle, setVehicle] = useState(initialVehicle);
  const [address, setAddress] = useState("Home · 220 W Kinzie St, Chicago, IL");
  const [appointmentTime, setAppointmentTime] = useState("Today 2:30 PM");
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? services[0];
  const fulfillment = fulfillmentOptions.find((option) => option.id === fulfillmentId) ?? fulfillmentOptions[0];
  const selectedOil = oilOptions.find((oil) => oil.id === selectedOilId) ?? oilOptions[0];
  const partsSelectionRequired = requiresPartsSelection(selectedService);
  const matchingRequest = useMemo(() => ({ service: selectedService, fulfillment }), [selectedService, fulfillment]);
  const providerMatchingResults = useMemo(() => getProviderMatchingResults(providers, matchingRequest), [matchingRequest]);
  const providerMatches = providerMatchingResults.matches;
  const selectedProviderMatch = chooseSelectedProvider({ providers, selectedProviderId, request: matchingRequest });
  const selectedProvider = selectedProviderMatch?.provider ?? null;
  const selectedAppointmentTime = selectedProviderMatch ? (selectedProviderMatch.earliestSlot ?? appointmentTime) : null;

  const estimate = useMemo(() => {
    return calculateEstimate({ service: selectedService, oil: selectedOil, fulfillment });
  }, [selectedService, selectedOil, fulfillment]);

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
  const currentBookingState = getBookingState(bookingDraft);
  const confirmationReady = canConfirmBooking(bookingDraft);
  const confirmationButtonLabel = bookingConfirmed ? "Appointment confirmed" : confirmationReady ? "Confirm appointment" : "Complete booking details";

  function updateDraft(updater) {
    setBookingConfirmed(false);
    updater();
  }

  function stepEyebrow(state) {
    const step = stepByState[state];
    return step ? `Step ${step.number}` : "Step";
  }

  function handleConfirmAppointment() {
    const nextBooking = transitionBooking(bookingDraft, "confirm");
    setBookingConfirmed(nextBooking.confirmed === true);
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
        {["book", "vehicle", "history"].map((tab) => (
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
                    onClick={() => updateDraft(() => setSelectedServiceId(service.id))}
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
                    onClick={() => updateDraft(() => setFulfillmentId(option.id))}
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
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Booking summary</p>
              <h2 className="mt-2 text-2xl font-black">{selectedService.name}</h2>
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
                <div className="flex justify-between text-sm"><span>Labor estimate</span><strong>{currency(estimate.labor)}</strong></div>
                <div className="mt-2 flex justify-between text-sm"><span>{estimate.lineItems.find((item) => item.id === "parts")?.label ?? "Parts"}</span><strong>{formatEstimateAmount(estimate.parts, { tbd: estimate.partsTbd, formatter: currency })}</strong></div>
                <div className="mt-2 flex justify-between text-sm"><span>Travel / coordination</span><strong>{currency(estimate.travel)}</strong></div>
                <div className="mt-2 flex justify-between text-sm"><span>Platform fee</span><strong>{currency(estimate.platform)}</strong></div>
                <div className="mt-4 flex justify-between text-xl font-black"><span>Due today</span><span>{formatEstimateAmount(estimate.total, { tbd: estimate.totalTbd, formatter: currency })}</span></div>
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
              <p className="mt-3 text-center text-xs text-slate-500">
                {currentBookingState === "confirmed" ? "Provider confirmation is next; no charge has been captured." : "No charge until provider confirms parts and arrival window."}
              </p>
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
    </main>
  );
}
