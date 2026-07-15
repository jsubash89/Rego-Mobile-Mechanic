import assert from "node:assert/strict";
import test from "node:test";

import {
  BookingRequestValidationError,
  createBookingRequestService,
  validateBookingRequestInput,
} from "./booking-request.mjs";

const validInput = Object.freeze({
  customer: { name: "Ada Lovelace", email: "ada@example.com", phone: "+1 312 555 0199" },
  consent: { accepted: true, source: "booking_request_form" },
  marketId: "chicago",
  serviceId: "diagnostic",
  fulfillmentId: "mobile",
  providerPreferenceId: "maria",
  vehicle: { year: 2020, make: "Subaru", model: "Outback", vinSuffix: "H4P220" },
  schedulePreference: "Weekday mornings",
  location: { type: "driveway", address: "123 Main St, Chicago, IL", postalCode: "60601", notes: "Blue house" },
});

function clone(value) {
  return structuredClone(value);
}

test("validates and normalizes a public booking request using canonical IDs", () => {
  const result = validateBookingRequestInput(clone(validInput));
  assert.equal(result.customer.name, "Ada Lovelace");
  assert.equal(result.service.id, "diagnostic");
  assert.equal(result.fulfillment.id, "mobile");
  assert.equal(result.providerPreference.id, "maria");
  assert.equal(result.marketId, "chicago");
  assert.equal(result.vehicle.vinSuffix, "H4P220");
  assert.equal(result.estimateSnapshot.source, "server_catalog");
  assert.equal(result.estimateSnapshot.total, 102);
});

test("rejects non-Chicago and out-of-range ZIPs regardless of address text", () => {
  for (const postalCode of [undefined, "60600", "60662", "60699", "48201", "Chicago"]) {
    const input = clone(validInput);
    input.location.postalCode = postalCode;
    input.location.address = "123 Main St, Chicago, IL";
    assert.throws(() => validateBookingRequestInput(input), (error) => error?.code === "invalid_postal_code");
  }
});

test("requires explicit customer-entered Chicago, IL address text and rejects market bypass strings", () => {
  for (const address of [
    "123 Main St", "Chicago Chicago Chicago", "1 Woodward Ave, Detroit, MI 60601",
    "1 Woodward Ave, Detroit, MI, Chicago", "1 Woodward Ave, Detroit, MI, Chicago, IL", "1 Woodward Ave, Detroit, MI, Chicago, IL, Detroit, MI",
    "1 Main St, Chicago, IN", "1 Main St, Chicago, IL\nDetroit, MI", "Chicago, IL is mentioned here",
  ]) {
    const input = clone(validInput);
    input.location.address = address;
    assert.throws(() => validateBookingRequestInput(input), (error) => error?.code === "invalid_address", address);
  }
  for (const address of ["100 W Randolph St, Chicago, IL", "100 W Randolph St, Chicago, Illinois 60601", "Chicago, IL"]) {
    const input = clone(validInput);
    input.location.address = address;
    assert.doesNotThrow(() => validateBookingRequestInput(input));
  }
});

test("rejects an address ZIP token that differs from the structured postal code", () => {
  for (const address of ["123 Main St, Chicago, IL 60699", "123 Main St 60601, Chicago, IL 60602-1234"]) {
    const input = clone(validInput);
    input.location.address = address;
    assert.throws(() => validateBookingRequestInput(input), (error) => error?.code === "invalid_postal_code");
  }
  for (const address of ["123 Main St, Chicago, IL 60601", "123 Main St, Chicago, IL 60601-1234", "123 Main St, Chicago, IL"]) {
    const input = clone(validInput);
    input.location.address = address;
    assert.doesNotThrow(() => validateBookingRequestInput(input));
  }
});

test("fails closed on market, service/fulfillment, provider, and partner-only eligibility", () => {
  const accepted = [
    { serviceId: "diagnostic", fulfillmentId: "mobile", providerPreferenceId: "maria" },
    { serviceId: "brakes", fulfillmentId: "shop", providerPreferenceId: "oak" },
    { serviceId: "inspection", fulfillmentId: "dealer", providerPreferenceId: "david" },
  ];
  for (const changes of accepted) assert.doesNotThrow(() => validateBookingRequestInput({ ...clone(validInput), ...changes }));

  const rejected = [
    { marketId: undefined },
    { marketId: "boise" },
    { serviceId: "brakes", fulfillmentId: "mobile", providerPreferenceId: null },
    { serviceId: "brakes", fulfillmentId: "mobile", providerPreferenceId: "oak" },
    { serviceId: "tow", providerPreferenceId: null },
  ];
  for (const changes of rejected) {
    assert.throws(() => validateBookingRequestInput({ ...clone(validInput), ...changes }), BookingRequestValidationError);
  }
});

test("marks provider-confirmed services as quote required from trusted catalog data", () => {
  const input = clone(validInput);
  input.serviceId = "oil-change";
  input.oilOptionId = "recommended";
  const result = validateBookingRequestInput(input);
  assert.equal(result.quoteRequired, true);
  assert.equal(result.estimateSnapshot, null);
});

test("requires an actionable name, email or phone, and explicit consent", () => {
  for (const mutate of [
    (input) => { input.customer.name = " "; },
    (input) => { delete input.customer.email; delete input.customer.phone; },
    (input) => { input.customer.email = "not-an-email"; },
    (input) => { input.customer.phone = "123"; delete input.customer.email; },
    (input) => { input.consent.accepted = false; },
    (input) => { input.consent.source = "unknown"; },
  ]) {
    const input = clone(validInput);
    mutate(input);
    assert.throws(() => validateBookingRequestInput(input), BookingRequestValidationError);
  }
});

test("rejects unknown catalog IDs, oversized strings, full VIN, and incompatible provider preference", () => {
  const cases = [
    { serviceId: "made-up" },
    { fulfillmentId: "teleport" },
    { providerPreferenceId: "unknown" },
    { schedulePreference: "x".repeat(201) },
    { vehicle: { ...validInput.vehicle, vinSuffix: "1HGCM82633A004352" } },
    { serviceId: "brakes", providerPreferenceId: "maria" },
  ];
  for (const changes of cases) {
    assert.throws(() => validateBookingRequestInput({ ...clone(validInput), ...changes }), BookingRequestValidationError);
  }
});

test("rejects server-owned fields instead of silently accepting them", () => {
  for (const field of ["status", "price", "total", "actor", "timestamp", "publicReference"]) {
    assert.throws(
      () => validateBookingRequestInput({ ...clone(validInput), [field]: "client value" }),
      (error) => error instanceof BookingRequestValidationError && error.code === "forbidden_field",
    );
  }
});

test("uses exact nested allowlists and rejects full VIN and server-owned fields at every depth", () => {
  const adversarial = [
    (input) => { input.customer.role = "admin"; },
    (input) => { input.consent.acceptedAt = "2026-01-01"; },
    (input) => { input.vehicle.vin = "1HGCM82633A004352"; },
    (input) => { input.vehicle.status = "approved"; },
    (input) => { input.location.price = 1; },
    (input) => { input.location.geo = { actor: "customer" }; },
  ];
  for (const mutate of adversarial) {
    const input = clone(validInput);
    mutate(input);
    assert.throws(() => validateBookingRequestInput(input), BookingRequestValidationError);
  }
});

test("normalizes complete phone input to E.164-compatible form and rejects malformed numbers", () => {
  assert.equal(validateBookingRequestInput(clone(validInput)).customer.phone, "+13125550199");
  for (const phone of ["+1 (312) CALL-NOW", "+0123456789", "+1 312 555 0199 ext 2", "1234567"]) {
    const input = clone(validInput);
    input.customer.phone = phone;
    delete input.customer.email;
    assert.throws(() => validateBookingRequestInput(input), BookingRequestValidationError);
  }
});

test("service delegates persistence and returns only the safe public response", async () => {
  const calls = [];
  const createdAt = new Date("2026-07-14T12:00:00.000Z");
  const service = createBookingRequestService({
    repository: {
      create: async (record) => {
        calls.push(record);
        return { publicReference: "BR_2ZQW8B4N7K", createdAt, responseSummary: record.responseSummary };
      },
    },
    now: () => createdAt,
  });
  const result = await service.create(clone(validInput), "idem-1234567890");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, "new");
  assert.equal(calls[0].consentedAt.toISOString(), createdAt.toISOString());
  assert.match(calls[0].requestFingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(result).sort(), ["createdAt", "publicReference", "status", "summary"]);
  assert.equal(result.status, "pending_review");
  assert.equal(result.summary.customerName, "Ada Lovelace");
  assert.equal(result.summary.address, undefined);
  assert.equal(JSON.stringify(result).includes("ada@example.com"), false);
});

test("canonical equivalent payloads have the same fingerprint", async () => {
  const calls = [];
  const repository = { create: async (record) => {
    calls.push(record);
    return { publicReference: "BR_2ZQW8B4N7K", createdAt: record.createdAt, responseSummary: record.responseSummary };
  } };
  const service = createBookingRequestService({ repository, now: () => new Date("2026-07-14T12:00:00Z") });
  const padded = clone(validInput);
  padded.customer.name = "  Ada Lovelace ";
  padded.customer.email = "ADA@EXAMPLE.COM";
  await service.create(clone(validInput), "idem-1234567890");
  await service.create(padded, "idem-1234567891");
  assert.equal(calls[0].requestFingerprint, calls[1].requestFingerprint);
});

test("replays by canonical client intent before mutable catalog resolution", async () => {
  let stored;
  const repository = {
    findByIdempotencyKey: async (key) => stored?.idempotencyKey === key ? stored : null,
    create: async (record) => {
      stored = { ...record, publicReference: "BR_2ZQW8B4N7K", createdAt: record.createdAt };
      return stored;
    },
  };
  const mutableCatalog = {
    services: [{ id: "diagnostic", name: "Original diagnostic", price: 69, quoteType: "fixed", providerConfirmationRequired: true }],
    fulfillmentOptions: [{ id: "mobile", label: "Original mobile", fee: 24 }],
    providers: [{ id: "maria", name: "Original Maria", serviceIds: ["diagnostic"], fulfillmentModes: ["mobile"], availability: { available: true, earliestSlot: "Today", rank: 0 }, serviceArea: { market: "chicago", maxTravelMiles: 8 }, distance: 1, providerConfirmedParts: true, compliance: { verified: true } }],
    oilOptions: [],
  };
  const firstService = createBookingRequestService({ repository, catalog: mutableCatalog, now: () => new Date("2026-07-14T12:00:00Z") });
  const first = await firstService.create(clone(validInput), "catalog-stable-123");
  mutableCatalog.services[0].name = "Changed label";
  mutableCatalog.services[0].price = 999;
  mutableCatalog.providers[0].availability.available = false;
  const replayService = createBookingRequestService({ repository, catalog: mutableCatalog, now: () => new Date("2030-01-01T00:00:00Z") });
  assert.deepEqual(await replayService.create(clone(validInput), "catalog-stable-123"), first);

  const changed = clone(validInput);
  changed.schedulePreference = "Friday only";
  await assert.rejects(() => replayService.create(changed, "catalog-stable-123"), (error) => error?.name === "IdempotencyConflictError");
  for (const mutate of [
    (unsafe) => { unsafe.unknown = true; },
    (unsafe) => { unsafe.vehicle.vin = "1HGCM82633A004352"; },
  ]) {
    const unsafe = clone(validInput);
    mutate(unsafe);
    await assert.rejects(() => replayService.create(unsafe, "catalog-stable-123"), BookingRequestValidationError);
  }
});

test("service requires a bounded idempotency key before repository access", async () => {
  let called = false;
  const service = createBookingRequestService({ repository: { create: async () => { called = true; } } });
  await assert.rejects(() => service.create(clone(validInput), "short"), BookingRequestValidationError);
  assert.equal(called, false);
});
