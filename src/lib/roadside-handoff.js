const EMERGENCY_ROADSIDE_SERVICE_TYPES = new Set([
  "tow",
  "lockout",
  "fuel_delivery",
  "battery_jump_emergency",
  "flat_tire_emergency",
  "unsafe_location",
]);

const REGO_BOOKING_SERVICE_TYPES = new Set([
  "oil-change",
  "oil_change",
  "diagnostic",
  "brakes",
  "inspection",
  "maintenance",
]);

const OPERATOR_DISCLOSURE = "ReGo does not operate towing, lockout, fuel delivery, emergency flat-tire response, or emergency battery dispatch. Emergency roadside requests are partner handoffs only and do not create a ReGo provider dispatch job.";
const NATIONAL_FALLBACK_MARKET = "national_fallback";

function normalizeId(value) {
  return String(value ?? "").trim().toLowerCase().replaceAll("-", "_").replace(/\s+/g, "_");
}

function normalizeMarket(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_") || "unknown";
}

export function isEmergencyRoadsideIntent(intentOrServiceType) {
  const serviceType = typeof intentOrServiceType === "object" && intentOrServiceType !== null
    ? intentOrServiceType.serviceType ?? intentOrServiceType.id ?? intentOrServiceType.intent
    : intentOrServiceType;

  return EMERGENCY_ROADSIDE_SERVICE_TYPES.has(normalizeId(serviceType));
}

export function isReGoBookingEligibleService(serviceType) {
  const normalized = normalizeId(serviceType);
  return REGO_BOOKING_SERVICE_TYPES.has(normalized) && !isEmergencyRoadsideIntent(normalized);
}

export function getRoadsidePartnerCandidates({ market, serviceType, partners = [] } = {}) {
  const normalizedMarket = normalizeMarket(market);
  const normalizedServiceType = normalizeId(serviceType);

  return partners
    .filter((partner) => {
      const markets = (partner.markets ?? []).map(normalizeMarket);
      const serviceTypes = (partner.serviceTypes ?? []).map(normalizeId);
      const marketMatches = markets.includes(normalizedMarket);
      const serviceMatches = serviceTypes.includes(normalizedServiceType);
      const available = partner.available !== false;
      return marketMatches && serviceMatches && available;
    })
    .map((partner) => ({
      id: partner.id,
      name: partner.name,
      operatorType: partner.operatorType,
      coverage: partner.coverage,
      availability: partner.availability,
      slaEstimate: partner.slaEstimate,
      serviceTypes: partner.serviceTypes ?? [],
      contactChannels: partner.contactChannels ?? [],
      disclosure: partner.disclosure || OPERATOR_DISCLOSURE,
    }));
}

export function createRoadsideAuditEvent({ market, serviceType, partnerCandidates = [], timestamp = new Date().toISOString() } = {}) {
  return {
    id: `roadside-handoff-${normalizeMarket(market)}-${normalizeId(serviceType)}-${String(timestamp).replace(/[^0-9A-Za-z]/g, "")}`,
    type: "partner_handoff_viewed",
    market: normalizeMarket(market),
    serviceType: normalizeId(serviceType),
    partnerCandidateIds: partnerCandidates.map((partner) => partner.id),
    createdAt: timestamp,
    piiStored: false,
    note: "Audit/support placeholder only; no full address, VIN, phone, ReGo dispatch job, status, or provider assignment is created.",
  };
}

export function buildRoadsideHandoff({ market = "chicago", serviceType, summary = "Roadside help requested", partners = [], timestamp } = {}) {
  const normalizedServiceType = normalizeId(serviceType);
  const emergency = isEmergencyRoadsideIntent(normalizedServiceType);

  if (!emergency) {
    return {
      route: "rego_booking",
      serviceType: normalizedServiceType,
      market: normalizeMarket(market),
      emergency: false,
      bookingAllowed: isReGoBookingEligibleService(normalizedServiceType) || !normalizedServiceType,
      guidance: "This appears eligible for the normal ReGo booking flow when the vehicle is parked safely and the request is not urgent roadside assistance.",
      disclosure: OPERATOR_DISCLOSURE,
      partnerCandidates: [],
      auditEvent: null,
      dispatchJob: null,
      providerAssignment: null,
    };
  }

  const normalizedMarket = normalizeMarket(market);
  const partnerCandidates = getRoadsidePartnerCandidates({ market: normalizedMarket, serviceType: normalizedServiceType, partners });
  const fallbackCopy = partnerCandidates.length === 0
    ? "No static partner is configured for this market and service. Stay safe, call local emergency services if there is danger, use your roadside membership/insurance, or contact ReGo support for handoff guidance. ReGo will not create a provider dispatch job for this emergency."
    : normalizedMarket === NATIONAL_FALLBACK_MARKET
      ? "National fallback mode was deliberately selected for this static demo. Partner coverage varies by driver supply; ReGo records only a minimal handoff/support event and does not create a ReGo booking or provider dispatch job."
      : "Choose a third-party partner channel below. ReGo records only a minimal handoff/support event and does not create a ReGo booking or provider dispatch job.";

  return {
    route: "partner_handoff",
    serviceType: normalizedServiceType,
    market: normalizedMarket,
    emergency: true,
    bookingAllowed: false,
    summary: String(summary || "Roadside help requested").slice(0, 160),
    guidance: fallbackCopy,
    disclosure: OPERATOR_DISCLOSURE,
    partnerCandidates,
    auditEvent: createRoadsideAuditEvent({ market, serviceType: normalizedServiceType, partnerCandidates, timestamp }),
    dispatchJob: null,
    providerAssignment: null,
  };
}

const roadsideHandoff = {
  EMERGENCY_ROADSIDE_SERVICE_TYPES: [...EMERGENCY_ROADSIDE_SERVICE_TYPES],
  NATIONAL_FALLBACK_MARKET,
  OPERATOR_DISCLOSURE,
  buildRoadsideHandoff,
  createRoadsideAuditEvent,
  getRoadsidePartnerCandidates,
  isEmergencyRoadsideIntent,
  isReGoBookingEligibleService,
};

export default roadsideHandoff;
