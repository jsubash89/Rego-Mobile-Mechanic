function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalLocationType(value) {
  return trimmed(value).toLowerCase().replaceAll(" ", "_");
}

function validVinLast6(value) {
  const suffix = trimmed(value).toUpperCase();
  return /^[A-Z0-9]{6}$/.test(suffix) ? suffix : undefined;
}

function isChicagoPilotPostalCode(value) {
  const postalCode = trimmed(value);
  return /^606\d{2}$/.test(postalCode) && Number(postalCode) >= 60601 && Number(postalCode) <= 60661;
}

function addressPostalCodesMatch(address, postalCode) {
  const tokens = trimmed(address).match(/(?<!\d)\d{5}(?:-\d{4})?(?!\d)/g) ?? [];
  return tokens.every((token) => token.slice(0, 5) === trimmed(postalCode));
}

function isExplicitChicagoIllinoisAddress(value) {
  const address = trimmed(value);
  if (!address || address.length > 300 || /[\r\n]/.test(address) || /\bdetroit\b|\bmichigan\b/i.test(address)) return false;
  // Customer-entered consistency check only; this is not geocoding or boundary proof.
  return /(?:^|,)\s*chicago\s*,\s*(?:il|illinois)(?:\s+606\d{2}(?:-\d{4})?)?(?:\s*,\s*(?:usa|united states))?\s*$/i.test(address);
}

function buildBookingRequestIntent(state) {
  const customer = { name: trimmed(state.customer?.name) };
  const email = trimmed(state.customer?.email);
  const phone = trimmed(state.customer?.phone);
  if (email) customer.email = email;
  if (phone) customer.phone = phone;

  const vehicle = {
    year: Number(state.vehicle?.year),
    make: trimmed(state.vehicle?.make),
    model: trimmed(state.vehicle?.model),
  };
  const vinSuffix = validVinLast6(state.vehicle?.vinLast6);
  if (vinSuffix) vehicle.vinSuffix = vinSuffix;

  const intent = {
    customer,
    consent: { accepted: state.consentAccepted === true, source: "booking_request_form" },
    marketId: "chicago",
    serviceId: state.serviceId,
    fulfillmentId: state.fulfillmentId,
    vehicle,
    schedulePreference: trimmed(state.schedulePreference),
    location: {
      type: canonicalLocationType(state.location?.type),
      address: trimmed(state.location?.address),
      postalCode: trimmed(state.location?.postalCode),
      notes: trimmed(state.location?.notes),
    },
  };
  if (state.serviceId === "oil-change" && state.oilOptionId) intent.oilOptionId = state.oilOptionId;
  return intent;
}

function createInMemoryIntentKey(randomKey = () => globalThis.crypto.randomUUID()) {
  let fingerprint;
  let key;
  return {
    forIntent(intent) {
      const nextFingerprint = JSON.stringify(intent);
      if (!key || nextFingerprint !== fingerprint) {
        fingerprint = nextFingerprint;
        key = randomKey();
      }
      return key;
    },
    invalidate() {
      fingerprint = undefined;
      key = undefined;
    },
  };
}

function emailValid(value) {
  return !value || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254);
}
function phoneValid(value) {
  if (!value) return true;
  if (value.length > 32 || !/^\+?[0-9 ()-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return value.startsWith("+") ? /^[1-9]\d{7,14}$/.test(digits) : digits.length === 10;
}

function customerFormErrors(state) {
  const errors = {};
  const name = trimmed(state.customer?.name);
  const email = trimmed(state.customer?.email);
  const phone = trimmed(state.customer?.phone);
  if (!name || name.length > 100) errors.name = "Enter a name of 100 characters or fewer.";
  if ((!email && !phone) || !emailValid(email) || !phoneValid(phone)) errors.contact = "Enter a valid email or phone number.";
  if (state.consentAccepted !== true) errors.consent = "Consent is required to send this service request.";
  const address = trimmed(state.location?.address);
  if (!isExplicitChicagoIllinoisAddress(address)) errors.address = "Enter a customer-provided Chicago, IL service address.";
  if (!isChicagoPilotPostalCode(state.location?.postalCode)) errors.postalCode = "Enter a Chicago pilot ZIP code (60601–60661).";
  else if (!addressPostalCodesMatch(address, state.location?.postalCode)) errors.postalCode = "Address ZIP must match the service ZIP code.";
  if (trimmed(state.location?.notes).length > 500) errors.notes = "Location notes must be 500 characters or fewer.";
  if (trimmed(state.schedulePreference).length > 200) errors.schedulePreference = "Schedule preference must be 200 characters or fewer.";
  if (state.available === false) errors.availability = "This service and fulfillment combination is not currently available in the Chicago pilot. Choose another service option.";
  return errors;
}

const FIELD_ERROR_CODES = Object.freeze({
  invalid_postal_code: { postalCode: "Enter a Chicago pilot ZIP code (60601–60661)." },
  invalid_address: { address: "Enter a valid service address." },
  invalid_contact: { contact: "Enter a valid email or phone number." },
  invalid_name: { name: "Enter a valid customer name." },
  invalid_consent: { consent: "Consent is required to send this service request." },
  invalid_vin_suffix: { vinLast6: "VIN last 6 must be exactly six letters or numbers." },
});
function safeBookingRequestFieldErrors(code) {
  return { ...(FIELD_ERROR_CODES[code] ?? {}) };
}

function safeBookingRequestError(status) {
  const messages = {
    400: "We could not submit this request. Review your entries and try again.",
    409: "This request changed while it was being retried. Review the changed request and submit again.",
    413: "The request is too long. Shorten the location notes and try again.",
    415: "Your browser could not send this request correctly. Refresh the page and try again.",
    429: "Too many attempts were made. Please wait a moment and try again.",
    503: "We could not save your request right now. Your entries are still here; please try again.",
  };
  return messages[status] ?? "A connection problem prevented us from saving your request. Check your connection and try again.";
}

module.exports = {
  buildBookingRequestIntent,
  createInMemoryIntentKey,
  customerFormErrors,
  isChicagoPilotPostalCode,
  isExplicitChicagoIllinoisAddress,
  safeBookingRequestError,
  safeBookingRequestFieldErrors,
  validVinLast6,
};
