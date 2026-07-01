import assert from "node:assert/strict";
import test from "node:test";

import matching from "./provider-matching.js";
import bookingState from "./booking-state.js";

const { chooseSelectedProvider, getProviderMatchingResults, rankProviderMatches } = matching;
const { canConfirmBooking } = bookingState;

const oilChange = {
  id: "oil-change",
  name: "Oil change",
  requiresFluidSpec: true,
  requiresPartsFitment: true,
  providerConfirmationRequired: true,
  quoteType: "tbd_provider_confirmed",
};

const inspection = {
  id: "inspection",
  name: "Pre-purchase inspection",
  requiresFluidSpec: false,
  requiresPartsFitment: false,
  providerConfirmationRequired: false,
  quoteType: "fixed",
};

const mobile = { id: "mobile", label: "Mobile mechanic" };
const shop = { id: "shop", label: "Independent shop" };

function provider(overrides = {}) {
  return {
    id: "provider-a",
    name: "Provider A",
    rating: 4.8,
    distance: 4,
    serviceIds: ["oil-change", "inspection"],
    specialtyServiceIds: ["oil-change"],
    fulfillmentModes: ["mobile", "shop"],
    availability: { available: true, earliestSlot: "Today 2:00 PM", rank: 1 },
    serviceArea: { maxTravelMiles: 10 },
    certifications: ["ASE"],
    providerConfirmedParts: true,
    compliance: { verified: true, insured: true, backgroundChecked: true, providerConfirmedParts: true },
    ...overrides,
  };
}

test("eligible providers are ranked with deterministic, explainable score components", () => {
  const providers = [
    provider({
      id: "slower",
      rating: 4.9,
      distance: 2,
      availability: { available: true, earliestSlot: "Tomorrow 9:00 AM", rank: 3 },
    }),
    provider({
      id: "best",
      rating: 4.8,
      distance: 3,
      availability: { available: true, earliestSlot: "Today 1:00 PM", rank: 0 },
    }),
  ];

  const matches = rankProviderMatches(providers, { service: oilChange, fulfillment: mobile });

  assert.equal(matches.length, 2);
  assert.equal(matches[0].providerId, "best");
  assert.ok(matches[0].score > matches[1].score);
  assert.deepEqual(Object.keys(matches[0].scoreComponents), ["availability", "distance", "rating", "specialty", "compliance"]);
  assert.ok(matches[0].reasons.includes("Supports selected service"));
  assert.ok(matches[0].reasons.includes("Can confirm parts and fitment before dispatch"));
});

test("providers that do not support the selected service are excluded with a reason", () => {
  const results = getProviderMatchingResults([provider({ id: "no-oil", serviceIds: ["inspection"] })], {
    service: oilChange,
    fulfillment: mobile,
  });

  assert.equal(results.matches.length, 0);
  assert.equal(results.ineligible[0].providerId, "no-oil");
  assert.ok(results.ineligible[0].exclusions.includes("Service not supported"));
});

test("providers that do not support the selected fulfillment mode are excluded", () => {
  const results = getProviderMatchingResults([provider({ id: "shop-only", fulfillmentModes: ["shop"] })], {
    service: inspection,
    fulfillment: mobile,
  });

  assert.equal(results.matches.length, 0);
  assert.ok(results.ineligible[0].exclusions.includes("Fulfillment mode not supported"));
});

test("mobile providers outside their travel cap are excluded", () => {
  const results = getProviderMatchingResults([provider({ id: "too-far", distance: 12, serviceArea: { maxTravelMiles: 8 } })], {
    service: inspection,
    fulfillment: mobile,
  });

  assert.equal(results.matches.length, 0);
  assert.ok(results.ineligible[0].exclusions.includes("Outside 8 mi mobile service area"));
});

test("mobile providers with unknown travel distance are excluded without explicit coverage", () => {
  const results = getProviderMatchingResults([provider({ id: "unknown-distance", distance: undefined })], {
    service: inspection,
    fulfillment: mobile,
  });

  assert.equal(results.matches.length, 0);
  assert.equal(results.ineligible[0].providerId, "unknown-distance");
  assert.ok(results.ineligible[0].exclusions.includes("Travel distance unavailable"));
});

test("mobile providers with unknown distance can match when service-area coverage is explicit", () => {
  const matches = rankProviderMatches([provider({ id: "covered", distance: undefined, serviceArea: { maxTravelMiles: 8, coversRequest: true } })], {
    service: inspection,
    fulfillment: mobile,
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0].providerId, "covered");
  assert.ok(matches[0].reasons.includes("Service area coverage confirmed"));
});

test("provider-confirmed services require parts/fitment confirmation support", () => {
  const results = getProviderMatchingResults([
    provider({
      id: "cannot-confirm",
      providerConfirmedParts: false,
      compliance: { verified: true, insured: true, backgroundChecked: true, providerConfirmedParts: false },
    }),
  ], { service: oilChange, fulfillment: mobile });

  assert.equal(results.matches.length, 0);
  assert.ok(results.ineligible[0].exclusions.includes("Provider-confirmed parts/fitment not supported"));
});

test("tie-break is deterministic by provider id after equal ranking inputs", () => {
  const alpha = provider({ id: "alpha", specialties: ["Oil service"] });
  const bravo = provider({ id: "bravo", specialties: ["Oil service"] });

  const matches = rankProviderMatches([bravo, alpha], { service: oilChange, fulfillment: mobile });

  assert.equal(matches[0].providerId, "alpha");
  assert.equal(matches[1].providerId, "bravo");
});

test("selected provider fallback returns top eligible match when current selection is ineligible", () => {
  const selected = chooseSelectedProvider({
    providers: [
      provider({ id: "current", fulfillmentModes: ["shop"] }),
      provider({ id: "fallback", fulfillmentModes: ["mobile"], availability: { available: true, earliestSlot: "Today 1:00 PM", rank: 0 } }),
    ],
    selectedProviderId: "current",
    request: { service: inspection, fulfillment: mobile },
  });

  assert.equal(selected.providerId, "fallback");
});

test("selected provider returns null and booking cannot confirm when no eligible match exists", () => {
  const selected = chooseSelectedProvider({
    providers: [provider({ id: "current", fulfillmentModes: ["shop"] })],
    selectedProviderId: "current",
    request: { service: inspection, fulfillment: mobile },
  });

  assert.equal(selected, null);
  assert.equal(canConfirmBooking({
    service: inspection,
    fulfillment: mobile,
    provider: selected?.provider ?? null,
    vehicle: { year: "2021", make: "Toyota", model: "RAV4", vin: "2T3P1RFV1MW123456" },
    appointmentTime: selected?.earliestSlot ?? null,
    estimate: { total: 149, lineItems: [{ id: "labor", amount: 149 }] },
  }), false);
});

test("shop fulfillment does not apply mobile travel cap exclusion", () => {
  const matches = rankProviderMatches([provider({ id: "shop-far", distance: 50, serviceArea: { maxTravelMiles: 8 } })], {
    service: inspection,
    fulfillment: shop,
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0].providerId, "shop-far");
});
