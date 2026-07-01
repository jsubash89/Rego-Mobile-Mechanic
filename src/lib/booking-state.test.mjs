import assert from "node:assert/strict";
import test from "node:test";

import bookingState from "./booking-state.js";
import pricing from "./pricing.js";

const {
  BOOKING_STATES,
  canConfirmBooking,
  getBookingState,
  getBookingStepStates,
  getMissingBookingFields,
  requiresPartsSelection,
  transitionBooking,
} = bookingState;
const { calculateEstimate, QUOTE_TYPES } = pricing;

const oilChange = {
  id: "oil-change",
  name: "Oil change",
  price: 79,
  requiresFluidSpec: true,
  requiresPartsFitment: true,
  providerConfirmationRequired: true,
  quoteType: QUOTE_TYPES.tbdProviderConfirmed,
};

const inspection = {
  id: "inspection",
  name: "Pre-purchase inspection",
  price: 149,
  requiresFluidSpec: false,
  requiresPartsFitment: false,
  providerConfirmationRequired: false,
  quoteType: QUOTE_TYPES.fixed,
};

const fluidService = {
  id: "coolant-service",
  name: "Coolant service",
  price: 139,
  requiresFluidSpec: true,
  requiresPartsFitment: false,
  providerConfirmationRequired: true,
  quoteType: QUOTE_TYPES.tbdProviderConfirmed,
};

const fulfillment = { id: "mobile", label: "Mobile mechanic", fee: 24 };
const oil = { id: "0w20", name: "0W-20 full synthetic", price: 59 };
const provider = { id: "maria", name: "Maria" };
const vehicle = { year: "2021", make: "Toyota", model: "RAV4", vin: "2T3P1RFV1MW123456" };
const appointmentTime = "Today 2:30 PM";

function completeBooking(overrides = {}) {
  const service = overrides.service ?? oilChange;
  const selectedOil = Object.prototype.hasOwnProperty.call(overrides, "oil") ? overrides.oil : oil;
  const selectedFulfillment = overrides.fulfillment ?? fulfillment;

  return {
    service,
    fulfillment: selectedFulfillment,
    oil: selectedOil,
    provider,
    vehicle,
    appointmentTime,
    estimate: calculateEstimate({ service, oil: selectedOil, fulfillment: selectedFulfillment }),
    ...overrides,
  };
}

test("oil-change booking path includes parts selection before provider and review", () => {
  assert.equal(requiresPartsSelection(oilChange), true);
  assert.deepEqual(getBookingStepStates({ service: oilChange }), [
    BOOKING_STATES.selectService,
    BOOKING_STATES.selectFulfillment,
    BOOKING_STATES.selectParts,
    BOOKING_STATES.selectProvider,
    BOOKING_STATES.review,
    BOOKING_STATES.confirmed,
  ]);

  assert.equal(getBookingState({ service: oilChange, fulfillment }), BOOKING_STATES.selectParts);
  assert.equal(getBookingState({ service: oilChange, fulfillment, oil }), BOOKING_STATES.selectProvider);
});

test("non-oil service path skips parts selection", () => {
  assert.equal(requiresPartsSelection(inspection), false);
  assert.deepEqual(getBookingStepStates({ service: inspection }), [
    BOOKING_STATES.selectService,
    BOOKING_STATES.selectFulfillment,
    BOOKING_STATES.selectProvider,
    BOOKING_STATES.review,
    BOOKING_STATES.confirmed,
  ]);

  assert.equal(getBookingState({ service: inspection, fulfillment }), BOOKING_STATES.selectProvider);
});

test("fluid-spec services require parts selection even when they are not the oil-change service", () => {
  assert.equal(requiresPartsSelection(fluidService), true);
  assert.deepEqual(getBookingStepStates({ service: fluidService }), [
    BOOKING_STATES.selectService,
    BOOKING_STATES.selectFulfillment,
    BOOKING_STATES.selectParts,
    BOOKING_STATES.selectProvider,
    BOOKING_STATES.review,
    BOOKING_STATES.confirmed,
  ]);

  assert.equal(getBookingState({ service: fluidService, fulfillment }), BOOKING_STATES.selectParts);
  assert.equal(getBookingState({ service: fluidService, fulfillment, oil }), BOOKING_STATES.selectProvider);
});

test("review and confirmation require service, fulfillment, provider, vehicle, time, and estimate", () => {
  const booking = completeBooking();

  assert.equal(getBookingState(booking), BOOKING_STATES.review);
  assert.equal(canConfirmBooking(booking), true);
  assert.deepEqual(getMissingBookingFields(booking), []);

  assert.equal(canConfirmBooking({ ...booking, service: null }), false);
  assert.equal(canConfirmBooking({ ...booking, fulfillment: null }), false);
  assert.equal(canConfirmBooking({ ...booking, provider: null }), false);
  assert.equal(canConfirmBooking({ ...booking, vehicle: { ...vehicle, vin: "" } }), false);
  assert.equal(canConfirmBooking({ ...booking, appointmentTime: "" }), false);
  assert.equal(canConfirmBooking({ ...booking, estimate: null }), false);
});

test("oil-change confirmation requires oil or parts selection", () => {
  const booking = completeBooking({ oil: null, estimate: calculateEstimate({ service: oilChange, fulfillment }) });

  assert.equal(getBookingState(booking), BOOKING_STATES.selectParts);
  assert.equal(canConfirmBooking(booking), false);
  assert.deepEqual(getMissingBookingFields(booking), ["oil_parts"]);
});

test("valid booking transitions to confirmed only when ready", () => {
  const incomplete = { service: inspection, fulfillment };
  const confirmedIncomplete = transitionBooking(incomplete, "confirm");
  assert.equal(confirmedIncomplete.confirmed, false);
  assert.equal(getBookingState(confirmedIncomplete), BOOKING_STATES.selectProvider);

  const ready = completeBooking({ service: inspection, oil: undefined, estimate: calculateEstimate({ service: inspection, fulfillment }) });
  const confirmed = transitionBooking(ready, "confirm");
  assert.equal(confirmed.confirmed, true);
  assert.equal(getBookingState(confirmed), BOOKING_STATES.confirmed);
});
