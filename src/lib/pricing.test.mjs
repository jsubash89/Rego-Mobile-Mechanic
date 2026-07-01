import assert from "node:assert/strict";
import test from "node:test";

import pricing from "./pricing.js";

const { calculateEstimate, formatEstimateAmount, getEstimateStatusCopy, QUOTE_TYPES } = pricing;

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

const mobileFulfillment = { id: "mobile", label: "Mobile mechanic", fee: 24 };
const shopFulfillment = { id: "shop", label: "Independent shop", fee: 0 };

test("oil change with recommended oil marks parts and total as provider-confirmed TBD", () => {
  const estimate = calculateEstimate({
    service: oilChange,
    oil: { id: "recommended", name: "Mechanic recommendation", price: 0 },
    fulfillment: mobileFulfillment,
  });

  assert.equal(estimate.parts, 0);
  assert.equal(estimate.partsTbd, true);
  assert.equal(estimate.totalTbd, true);
  assert.equal(estimate.quoteType, QUOTE_TYPES.tbdProviderConfirmed);
  assert.equal(estimate.providerConfirmationRequired, true);
  assert.equal(formatEstimateAmount(estimate.parts, { tbd: estimate.partsTbd }), "TBD");
});

test("fixed oil option includes selected parts cost in the estimate", () => {
  const estimate = calculateEstimate({
    service: oilChange,
    oil: { id: "5w30", name: "5W-30 full synthetic", price: 54 },
    fulfillment: shopFulfillment,
  });

  assert.equal(estimate.parts, 54);
  assert.equal(estimate.partsTbd, false);
  assert.equal(estimate.totalTbd, false);
  assert.equal(estimate.total, 142);
  assert.deepEqual(
    estimate.lineItems.map(({ id, amount, tbd }) => ({ id, amount, tbd })),
    [
      { id: "labor", amount: 79, tbd: false },
      { id: "parts", amount: 54, tbd: false },
      { id: "travel", amount: 0, tbd: false },
      { id: "platform", amount: 9, tbd: false },
    ],
  );
});

test("customer-provided oil with price 0 stays a known $0 amount instead of truthiness TBD", () => {
  const estimate = calculateEstimate({
    service: oilChange,
    oil: { id: "customer", name: "I will provide oil", price: 0 },
    fulfillment: shopFulfillment,
  });

  assert.equal(estimate.parts, 0);
  assert.equal(estimate.partsTbd, false);
  assert.equal(estimate.totalTbd, false);
  assert.equal(formatEstimateAmount(estimate.parts, { tbd: estimate.partsTbd }), "$0");
  assert.equal(estimate.total, 88);
});

test("fulfillment fee and platform fee are included in totals", () => {
  const estimate = calculateEstimate({
    service: oilChange,
    oil: { id: "0w20", name: "0W-20 full synthetic", price: 59 },
    fulfillment: mobileFulfillment,
  });

  assert.equal(estimate.labor, 79);
  assert.equal(estimate.parts, 59);
  assert.equal(estimate.travel, 24);
  assert.equal(estimate.platform, 9);
  assert.equal(estimate.total, 171);
});

test("non-oil fixed service uses service labor, fees, no oil parts, and deterministic total", () => {
  const estimate = calculateEstimate({ service: inspection, fulfillment: mobileFulfillment });

  assert.equal(estimate.labor, 149);
  assert.equal(estimate.parts, 0);
  assert.equal(estimate.partsTbd, false);
  assert.equal(estimate.travel, 24);
  assert.equal(estimate.platform, 9);
  assert.equal(estimate.total, 182);
  assert.equal(estimate.totalTbd, false);
  assert.equal(estimate.quoteType, QUOTE_TYPES.fixed);
});

test("estimate status copy explains provider-confirmed TBD totals", () => {
  const estimate = calculateEstimate({
    service: oilChange,
    oil: { id: "recommended", name: "Mechanic recommendation", price: 0 },
    fulfillment: mobileFulfillment,
  });
  const copy = getEstimateStatusCopy(estimate, { service: oilChange, provider: { name: "Maria Rodriguez" } });

  assert.equal(copy.label, "Provider-confirmed estimate");
  assert.equal(copy.totalLabel, "TBD until provider confirms");
  assert.match(copy.summary, /Maria Rodriguez/);
  assert.match(copy.summary, /oil spec/);
  assert.match(copy.summary, /before any charge is captured/);
});

test("estimate status copy distinguishes fixed estimates", () => {
  const estimate = calculateEstimate({ service: inspection, fulfillment: shopFulfillment });
  const copy = getEstimateStatusCopy(estimate, { service: inspection, provider: { name: "Oak Street Auto" } });

  assert.equal(copy.label, "Fixed MVP estimate");
  assert.equal(copy.totalLabel, "Due today");
});
