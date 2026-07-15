import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  buildBookingRequestIntent,
  createInMemoryIntentKey,
  customerFormErrors,
  safeBookingRequestError,
} = require("./booking-request-client.js");

const validState = {
  customer: { name: " Ada Lovelace ", email: " ADA@example.com ", phone: "" },
  consentAccepted: true,
  serviceId: "oil-change",
  fulfillmentId: "mobile",
  oilOptionId: "5w30",
  vehicle: { year: "2024", make: "Toyota", model: "Camry", vinLast6: "654321", trim: "LE" },
  schedulePreference: "Earliest Available",
  location: { type: "Parking Lot", address: "100 W Randolph St", postalCode: "60601", notes: "Level 2" },
};

test("maps UI state to the allowlisted API contract and only sends a VIN suffix", () => {
  assert.deepEqual(buildBookingRequestIntent(validState), {
    customer: { name: "Ada Lovelace", email: "ADA@example.com" },
    consent: { accepted: true, source: "booking_request_form" },
    marketId: "chicago",
    serviceId: "oil-change",
    fulfillmentId: "mobile",
    oilOptionId: "5w30",
    vehicle: { year: 2024, make: "Toyota", model: "Camry", vinSuffix: "654321" },
    schedulePreference: "Earliest Available",
    location: { type: "parking_lot", address: "100 W Randolph St", postalCode: "60601", notes: "Level 2" },
  });
  assert.equal(JSON.stringify(buildBookingRequestIntent(validState)).includes("1HGCM82633A654321"), false);
});

test("omits non-applicable oil, provider demo selection, prices, and an unverified VIN suffix", () => {
  const intent = buildBookingRequestIntent({ ...validState, serviceId: "diagnostic", oilOptionId: "5w30", vehicle: { year: 2024, make: "Toyota", model: "Camry", vinLast6: "bad" } });
  assert.equal("oilOptionId" in intent, false);
  assert.equal("providerPreferenceId" in intent, false);
  assert.equal("vinSuffix" in intent.vehicle, false);
  for (const prohibited of ["status", "actor", "createdAt", "total", "price", "publicReference"]) assert.equal(prohibited in intent, false);
});

test("idempotency key stays stable for unchanged intent and rotates after a field changes", () => {
  let sequence = 0;
  const keys = createInMemoryIntentKey(() => `crypto-random-${++sequence}`);
  const first = buildBookingRequestIntent(validState);
  assert.equal(keys.forIntent(first), "crypto-random-1");
  assert.equal(keys.forIntent(structuredClone(first)), "crypto-random-1");
  assert.equal(keys.forIntent({ ...first, schedulePreference: "Flexible Days and Time" }), "crypto-random-2");
});

test("a used key rotates after an edit even when intent returns A to B to A", () => {
  let sequence = 0;
  const keys = createInMemoryIntentKey(() => `crypto-random-${++sequence}`);
  const intent = buildBookingRequestIntent(validState);
  assert.equal(keys.forIntent(intent), "crypto-random-1");
  keys.invalidate();
  keys.invalidate();
  assert.equal(keys.forIntent(intent), "crypto-random-2");
  assert.equal(keys.forIntent(intent), "crypto-random-2");
});

test("validates name, one contact channel, consent, Chicago ZIP, and supported availability", () => {
  assert.deepEqual(customerFormErrors({ ...validState, customer: { name: "", email: "bad", phone: "" }, consentAccepted: false, location: { ...validState.location, address: "Chicago words are not authority", postalCode: "60699" }, available: false }), {
    name: "Enter a name of 100 characters or fewer.",
    contact: "Enter a valid email or phone number.",
    consent: "Consent is required to send this service request.",
    address: "Enter a customer-provided Chicago, IL service address.",
    postalCode: "Enter a Chicago pilot ZIP code (60601–60661).",
    availability: "This service and fulfillment combination is not currently available in the Chicago pilot. Choose another service option.",
  });
});

test("requires every ZIP token in the address to match the structured postal code", () => {
  const mismatch = { ...validState, location: { ...validState.location, address: "123 Main St, Chicago, IL 60699", postalCode: "60601" } };
  assert.equal(customerFormErrors(mismatch).postalCode, "Address ZIP must match the service ZIP code.");
  for (const address of ["123 Main St, Chicago, IL 60601", "123 Main St, Chicago, IL 60601-1234", "123 Main St, Chicago, IL"]) {
    assert.equal(customerFormErrors({ ...validState, location: { ...validState.location, address, postalCode: "60601" } }).postalCode, undefined);
  }
});

test("maps failures to safe actionable copy without exposing response bodies", () => {
  assert.match(safeBookingRequestError(400), /review your entries/i);
  assert.match(safeBookingRequestError(409), /changed request/i);
  assert.match(safeBookingRequestError(429), /wait.*try again/i);
  assert.match(safeBookingRequestError(503), /could not save/i);
  assert.match(safeBookingRequestError(null), /connection/i);
  assert.equal(safeBookingRequestError(503).includes("database"), false);
});
