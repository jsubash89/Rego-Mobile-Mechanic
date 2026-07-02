const { vehicleIdentityIsComplete } = require("./vehicle-identity.js");

const BOOKING_STATES = {
  selectService: "select_service",
  selectFulfillment: "select_fulfillment",
  selectParts: "select_parts",
  selectProvider: "select_provider",
  review: "review",
  confirmed: "confirmed",
};

const BOOKING_STEP_LABELS = {
  [BOOKING_STATES.selectService]: "Choose a service",
  [BOOKING_STATES.selectFulfillment]: "Pick where the work happens",
  [BOOKING_STATES.selectParts]: "Choose oil / parts",
  [BOOKING_STATES.selectProvider]: "Compare available providers",
  [BOOKING_STATES.review]: "Review booking",
  [BOOKING_STATES.confirmed]: "Confirmed",
};

const REQUIRED_VEHICLE_FIELDS = ["year", "make", "model"];

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function requiresPartsSelection(service) {
  return service?.id === "oil-change" || service?.requiresFluidSpec === true;
}

function vehicleIsComplete(vehicle) {
  return vehicleIdentityIsComplete(vehicle);
}

function estimateIsComplete(estimate) {
  if (!estimate) {
    return false;
  }

  return Number.isFinite(estimate.total) && Array.isArray(estimate.lineItems) && estimate.lineItems.length > 0;
}

function getMissingBookingFields({ service, fulfillment, oil, provider, vehicle, appointmentTime, estimate } = {}) {
  const missing = [];

  if (!service) {
    missing.push("service");
  }

  if (!fulfillment) {
    missing.push("fulfillment");
  }

  if (requiresPartsSelection(service) && !oil) {
    missing.push("oil_parts");
  }

  if (!provider) {
    missing.push("provider");
  }

  if (!vehicleIsComplete(vehicle)) {
    missing.push("vehicle");
  }

  if (!hasValue(appointmentTime)) {
    missing.push("appointment_time");
  }

  if (!estimateIsComplete(estimate)) {
    missing.push("estimate");
  }

  return missing;
}

const MISSING_FIELD_COPY = {
  service: "Choose a service.",
  fulfillment: "Pick mobile, shop, or dealership fulfillment.",
  oil_parts: "Choose an oil preference before comparing providers.",
  provider: "Select an eligible provider for this service and fulfillment.",
  vehicle: "Complete vehicle year, make, and model, or enter a VIN.",
  appointment_time: "Choose an appointment time from an eligible provider.",
  estimate: "Review a valid estimate before confirming.",
};

function getConfirmationGuidance(booking = {}) {
  const missing = getMissingBookingFields(booking);

  if (missing.length === 0) {
    return {
      ready: true,
      message: "Ready to confirm. Provider confirmation happens next; no charge is captured in this MVP.",
      reasons: [],
    };
  }

  return {
    ready: false,
    message: MISSING_FIELD_COPY[missing[0]] ?? "Complete the required booking details before confirming.",
    reasons: missing.map((field) => MISSING_FIELD_COPY[field] ?? field),
  };
}

function canReviewBooking(booking = {}) {
  return getMissingBookingFields(booking).length === 0;
}

function canConfirmBooking(booking = {}) {
  return canReviewBooking(booking);
}

function getBookingStepStates({ service } = {}) {
  const states = [BOOKING_STATES.selectService, BOOKING_STATES.selectFulfillment];

  if (requiresPartsSelection(service)) {
    states.push(BOOKING_STATES.selectParts);
  }

  states.push(BOOKING_STATES.selectProvider, BOOKING_STATES.review, BOOKING_STATES.confirmed);
  return states;
}

function getBookingSteps(booking = {}) {
  const currentState = getBookingState(booking);

  return getBookingStepStates(booking).map((state, index) => ({
    id: state,
    state,
    number: index + 1,
    label: BOOKING_STEP_LABELS[state],
    active: state === currentState,
    complete: getBookingStepIsComplete(state, booking),
  }));
}

function getBookingStepIsComplete(state, booking = {}) {
  const { service, fulfillment, oil, provider, vehicle, appointmentTime, estimate, confirmed } = booking;

  switch (state) {
    case BOOKING_STATES.selectService:
      return Boolean(service);
    case BOOKING_STATES.selectFulfillment:
      return Boolean(service && fulfillment);
    case BOOKING_STATES.selectParts:
      return Boolean(service && fulfillment && (!requiresPartsSelection(service) || oil));
    case BOOKING_STATES.selectProvider:
      return Boolean(service && fulfillment && (!requiresPartsSelection(service) || oil) && provider && hasValue(appointmentTime));
    case BOOKING_STATES.review:
      return canReviewBooking({ service, fulfillment, oil, provider, vehicle, appointmentTime, estimate });
    case BOOKING_STATES.confirmed:
      return Boolean(confirmed) && canConfirmBooking({ service, fulfillment, oil, provider, vehicle, appointmentTime, estimate });
    default:
      return false;
  }
}

function getBookingState(booking = {}) {
  const { service, fulfillment, oil, provider, vehicle, appointmentTime, estimate, confirmed } = booking;

  if (!service) {
    return BOOKING_STATES.selectService;
  }

  if (!fulfillment) {
    return BOOKING_STATES.selectFulfillment;
  }

  if (requiresPartsSelection(service) && !oil) {
    return BOOKING_STATES.selectParts;
  }

  if (!provider || !hasValue(appointmentTime)) {
    return BOOKING_STATES.selectProvider;
  }

  if (!canReviewBooking({ service, fulfillment, oil, provider, vehicle, appointmentTime, estimate })) {
    return BOOKING_STATES.review;
  }

  if (confirmed) {
    return BOOKING_STATES.confirmed;
  }

  return BOOKING_STATES.review;
}

function transitionBooking(booking = {}, event) {
  const type = typeof event === "string" ? event : event?.type;

  if (type === "confirm" || type === "CONFIRM") {
    if (!canConfirmBooking(booking)) {
      return { ...booking, confirmed: false };
    }

    return { ...booking, confirmed: true };
  }

  if (type === "edit" || type === "EDIT") {
    return { ...booking, confirmed: false };
  }

  return { ...booking };
}

module.exports = {
  BOOKING_STATES,
  BOOKING_STEP_LABELS,
  REQUIRED_VEHICLE_FIELDS,
  canConfirmBooking,
  canReviewBooking,
  getBookingState,
  getBookingSteps,
  getBookingStepStates,
  getConfirmationGuidance,
  getMissingBookingFields,
  requiresPartsSelection,
  transitionBooking,
  vehicleIsComplete,
};
