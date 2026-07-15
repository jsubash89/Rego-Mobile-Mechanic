import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fulfillmentOptions } from "../../data/fulfillment.js";
import { providers } from "../../data/providers.js";
import { oilOptions, services } from "../../data/services.js";

const require = createRequire(import.meta.url);
const { getProviderMatchingResults } = require("../../lib/provider-matching.js");

const SERVER_OWNED = new Set(["status", "price", "total", "actor", "timestamp", "createdAt", "updatedAt", "publicReference", "estimateSnapshot", "quoteRequired"]);
const TOP_FIELDS = new Set(["customer", "consent", "marketId", "serviceId", "fulfillmentId", "providerPreferenceId", "oilOptionId", "vehicle", "schedulePreference", "location"]);
const NESTED_FIELDS = {
  customer: new Set(["name", "email", "phone"]),
  consent: new Set(["accepted", "source"]),
  vehicle: new Set(["year", "make", "model", "vinSuffix"]),
  location: new Set(["type", "address", "notes"]),
};
const LOCATION_TYPES = new Set(["home", "work", "other", "garage", "driveway", "parking_lot", "parking lot"]);
const PILOT_MARKETS = new Set(["chicago"]);
const DEFAULT_CATALOG = { services, fulfillmentOptions, providers, oilOptions };

export class BookingRequestValidationError extends Error {
  constructor(message, code = "invalid_input") {
    super(message);
    this.name = "BookingRequestValidationError";
    this.code = code;
  }
}

function fail(message, code) { throw new BookingRequestValidationError(message, code); }
function object(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be an object`);
  return value;
}
function allowOnly(value, field, allowed) {
  object(value, field);
  for (const key of Object.keys(value)) {
    if (SERVER_OWNED.has(key) || key === "vin") fail(`${field}.${key} is server-owned or prohibited`, "forbidden_field");
    if (!allowed.has(key)) fail(`${field}.${key} is not accepted`);
  }
}
function text(value, field, { required = true, max = 200 } = {}) {
  if (value == null && !required) return null;
  if (typeof value !== "string") fail(`${field} must be text`);
  const normalized = value.trim();
  if (required && !normalized) fail(`${field} is required`);
  if (normalized.length > max) fail(`${field} is too long`);
  return normalized || null;
}
function canonicalId(value, field, { required = true } = {}) {
  const id = text(value, field, { required, max: 64 });
  if (id && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail(`${field} is invalid`);
  return id;
}
function catalogItem(items, id, field) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) fail(`${field} is unknown`);
  return item;
}
function publicCatalogValue(item, labelField = "name") { return { id: item.id, [labelField]: item[labelField] }; }

function normalizePhone(value) {
  if (value == null) return null;
  const phone = text(value, "customer.phone", { required: false, max: 32 });
  if (!phone) return null;
  if (!/^\+?[0-9 ()-]+$/.test(phone)) fail("customer.phone is invalid");
  let digits = phone.replace(/\D/g, "");
  if (!phone.startsWith("+")) {
    if (digits.length !== 10) fail("customer.phone must include a country code");
    digits = `1${digits}`;
  }
  if (!/^[1-9]\d{7,14}$/.test(digits)) fail("customer.phone is invalid");
  return `+${digits}`;
}
function normalizeCustomer(value) {
  allowOnly(value, "customer", NESTED_FIELDS.customer);
  const name = text(value.name, "customer.name", { max: 100 });
  const email = text(value.email, "customer.email", { required: false, max: 254 });
  const phone = normalizePhone(value.phone);
  if (!email && !phone) fail("An email or phone is required");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("customer.email is invalid");
  return { name, email: email?.toLowerCase() ?? null, phone };
}
function normalizeVehicle(value) {
  allowOnly(value, "vehicle", NESTED_FIELDS.vehicle);
  const maximumYear = new Date().getUTCFullYear() + 1;
  if (!Number.isInteger(value.year) || value.year < 1886 || value.year > maximumYear) fail("vehicle.year is invalid");
  const vinSuffix = text(value.vinSuffix, "vehicle.vinSuffix", { required: false, max: 6 });
  if (vinSuffix && !/^[A-HJ-NPR-Z0-9]{4,6}$/i.test(vinSuffix)) fail("vehicle.vinSuffix is invalid");
  return { year: value.year, make: text(value.make, "vehicle.make", { max: 80 }), model: text(value.model, "vehicle.model", { max: 80 }), vinSuffix: vinSuffix?.toUpperCase() ?? null };
}
function normalizeLocation(value) {
  allowOnly(value, "location", NESTED_FIELDS.location);
  const type = text(value.type, "location.type", { max: 32 }).toLowerCase();
  if (!LOCATION_TYPES.has(type)) fail("location.type is invalid");
  return { type: type.replace(" ", "_"), address: text(value.address, "location.address", { max: 300 }), notes: text(value.notes, "location.notes", { required: false, max: 500 }) };
}
function trustedEstimate(service, oil, fulfillment) {
  const needsQuote = (service.id === "oil-change" && oil?.id === "recommended") || (service.requiresPartsFitment && service.quoteType !== "fixed" && service.id !== "oil-change");
  if (needsQuote) return { quoteRequired: true, estimateSnapshot: null };
  const parts = service.id === "oil-change" ? Number(oil?.price ?? 0) : 0;
  return { quoteRequired: false, estimateSnapshot: { source: "server_catalog", currency: "USD", total: Number(service.price) + parts + Number(fulfillment.fee) + 9 } };
}

export function normalizeBookingRequestIntent(input) {
  object(input, "request");
  for (const field of Object.keys(input)) {
    if (SERVER_OWNED.has(field)) fail(`${field} is server-owned`, "forbidden_field");
    if (!TOP_FIELDS.has(field)) fail(`${field} is not accepted`);
  }
  allowOnly(input.consent, "consent", NESTED_FIELDS.consent);
  if (input.consent.accepted !== true || input.consent.source !== "booking_request_form") fail("Explicit booking request consent is required");
  const marketId = canonicalId(input.marketId, "marketId");
  const serviceId = canonicalId(input.serviceId, "serviceId");
  const fulfillmentId = canonicalId(input.fulfillmentId, "fulfillmentId");
  const providerPreferenceId = input.providerPreferenceId == null ? null : canonicalId(input.providerPreferenceId, "providerPreferenceId");
  const oilOptionId = input.oilOptionId == null ? null : canonicalId(input.oilOptionId, "oilOptionId");
  return {
    customer: normalizeCustomer(input.customer),
    consent: { accepted: true, source: "booking_request_form" },
    marketId,
    serviceId,
    fulfillmentId,
    providerPreferenceId,
    oilOptionId,
    vehicle: normalizeVehicle(input.vehicle),
    schedulePreference: text(input.schedulePreference, "schedulePreference", { max: 200 }),
    location: normalizeLocation(input.location),
  };
}

function resolveBookingRequestIntent(intent, catalog = DEFAULT_CATALOG) {
  if (!PILOT_MARKETS.has(intent.marketId)) fail("marketId is unsupported", "unsupported_market");
  if (intent.serviceId === "tow") fail("Car Tow is partner-only", "partner_only_service");
  const service = catalogItem(catalog.services, intent.serviceId, "serviceId");
  const fulfillment = catalogItem(catalog.fulfillmentOptions, intent.fulfillmentId, "fulfillmentId");
  const provider = intent.providerPreferenceId == null ? null : catalogItem(catalog.providers, intent.providerPreferenceId, "providerPreferenceId");
  let oil = null;
  if (service.id === "oil-change") oil = catalogItem(catalog.oilOptions, intent.oilOptionId, "oilOptionId");
  else if (intent.oilOptionId != null) fail("oilOptionId is only valid for oil changes");

  const matching = getProviderMatchingResults(catalog.providers, {
    service,
    fulfillment,
    market: intent.marketId,
  });
  if (matching.matches.length === 0) fail("No provider is currently eligible for this market and fulfillment", "unavailable_service_fulfillment");
  if (provider && !matching.matches.some((match) => match.providerId === provider.id)) {
    fail("providerPreferenceId is not currently eligible for the request", "ineligible_provider");
  }
  return {
    ...intent,
    service: publicCatalogValue(service),
    fulfillment: publicCatalogValue(fulfillment, "label"),
    providerPreference: provider ? publicCatalogValue(provider) : null,
    oilOption: oil ? publicCatalogValue(oil) : null,
    ...trustedEstimate(service, oil, fulfillment),
  };
}

export function validateBookingRequestInput(input, { catalog = DEFAULT_CATALOG } = {}) {
  return resolveBookingRequestIntent(normalizeBookingRequestIntent(input), catalog);
}
function validateIdempotencyKey(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) fail("A valid Idempotency-Key header is required", "invalid_idempotency_key");
  return value;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
function fingerprint(value) { return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex"); }
function publicResponse(stored) {
  return { publicReference: stored.publicReference, status: "pending_review", createdAt: new Date(stored.createdAt).toISOString(), summary: stored.responseSummary };
}
function idempotencyConflict() {
  const error = new Error("Idempotency key was already used for a different request");
  error.name = "IdempotencyConflictError";
  error.code = "idempotency_conflict";
  return error;
}

export function createBookingRequestService({ repository, now = () => new Date(), catalog = DEFAULT_CATALOG } = {}) {
  if (!repository?.create) throw new TypeError("A booking request repository is required");
  return { async create(input, idempotencyKey) {
    const key = validateIdempotencyKey(idempotencyKey);
    const intent = normalizeBookingRequestIntent(input);
    const requestFingerprint = fingerprint(intent);
    if (repository.findByIdempotencyKey) {
      const existing = await repository.findByIdempotencyKey(key);
      if (existing) {
        if (existing.requestFingerprint !== requestFingerprint) throw idempotencyConflict();
        return publicResponse(existing);
      }
    }
    const normalized = resolveBookingRequestIntent(intent, catalog);
    const createdAt = now();
    const responseSummary = {
      customerName: normalized.customer.name,
      serviceName: normalized.service.name,
      fulfillmentLabel: normalized.fulfillment.label,
      vehicle: `${normalized.vehicle.year} ${normalized.vehicle.make} ${normalized.vehicle.model}`,
      quoteRequired: normalized.quoteRequired,
    };
    const stored = await repository.create({
      idempotencyKey: key, requestFingerprint, responseSummary, status: "new",
      customer: normalized.customer, consentedAt: createdAt, consentSource: normalized.consent.source,
      marketId: normalized.marketId, service: normalized.service, fulfillment: normalized.fulfillment, providerPreference: normalized.providerPreference,
      oilOption: normalized.oilOption, vehicle: normalized.vehicle, schedulePreference: normalized.schedulePreference,
      location: normalized.location, estimateSnapshot: normalized.estimateSnapshot, quoteRequired: normalized.quoteRequired, createdAt,
    });
    return publicResponse(stored);
  } };
}
