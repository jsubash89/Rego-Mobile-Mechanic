import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  deriveProviderSelection,
} = require("./provider-matching.js");
const {
  canConfirmBooking,
} = require("./booking-state.js");
const {
  BOOKING_DRAFT_STORAGE_KEY,
  clearBookingDraft,
  loadBookingDraft,
  normalizeBookingDraft,
  readLocalStorageJson,
  removeLocalStorageItem,
  sanitizeBookingDraft,
  saveBookingDraft,
  writeLocalStorageJson,
} = require("./local-storage.js");

function createMockStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    dump() {
      return Object.fromEntries(values.entries());
    },
  };
}

describe("local storage helpers", () => {
  it("no-ops safely outside the browser", () => {
    assert.equal(readLocalStorageJson("missing", "fallback"), "fallback");
    assert.equal(writeLocalStorageJson("key", { ok: true }), false);
    assert.equal(removeLocalStorageItem("key"), false);
    assert.equal(loadBookingDraft(), null);
    assert.equal(clearBookingDraft(), false);
  });

  it("reads and writes JSON with a provided storage object", () => {
    const storage = createMockStorage();

    assert.equal(writeLocalStorageJson("key", { ok: true }, storage), true);
    assert.deepEqual(readLocalStorageJson("key", null, storage), { ok: true });
    assert.equal(removeLocalStorageItem("key", storage), true);
    assert.equal(readLocalStorageJson("key", "fallback", storage), "fallback");
  });

  it("returns the fallback for malformed JSON", () => {
    const storage = createMockStorage({ key: "{" });

    assert.equal(readLocalStorageJson("key", "fallback", storage), "fallback");
  });

  it("persists only supported minimized booking draft fields", () => {
    const storage = createMockStorage();
    const draft = {
      vehicle: {
        year: 2021,
        make: "Toyota",
        model: "RAV4",
        trim: "XLE Premium",
        engine: "2.5L I4",
        transmission: "8-speed automatic",
        vin: "JTMWFREV1MJ123456",
        unsupportedNestedValue: { nope: true },
      },
      address: "Home · 220 W Kinzie St, Chicago, IL",
      selectedServiceId: "oil-change",
      fulfillmentId: "mobile",
      selectedProviderId: "maria",
      selectedOilId: "synthetic",
      appointmentTime: "Tomorrow 10:00 AM",
      bookingConfirmed: true,
      unexpectedField: "drop me",
    };

    assert.equal(saveBookingDraft(draft, storage), true);
    assert.deepEqual(loadBookingDraft(storage), {
      vehicle: {
        year: "2021",
        make: "Toyota",
        model: "RAV4",
        trim: "XLE Premium",
        engine: "2.5L I4",
        transmission: "8-speed automatic",
        vinLast6: "123456",
      },
      selectedServiceId: "oil-change",
      fulfillmentId: "mobile",
      selectedProviderId: "maria",
      selectedOilId: "synthetic",
      appointmentTime: "Tomorrow 10:00 AM",
    });

    const persisted = JSON.parse(storage.dump()[BOOKING_DRAFT_STORAGE_KEY]);
    assert.equal(persisted.address, undefined);
    assert.equal(persisted.vehicle.vin, undefined);
    assert.equal(JSON.stringify(persisted).includes("JTMWFREV1MJ123456"), false);
    assert.equal(JSON.stringify(persisted).includes("220 W Kinzie"), false);
  });

  it("clears the persisted booking draft", () => {
    const storage = createMockStorage({
      [BOOKING_DRAFT_STORAGE_KEY]: JSON.stringify({ selectedServiceId: "oil-change" }),
    });

    assert.equal(clearBookingDraft(storage), true);
    assert.deepEqual(storage.dump(), {});
  });

  it("clears malformed persisted booking draft JSON on load", () => {
    const storage = createMockStorage({ [BOOKING_DRAFT_STORAGE_KEY]: "{" });

    assert.equal(loadBookingDraft(storage), null);
    assert.deepEqual(storage.dump(), {});
  });

  it("clears malformed persisted booking draft shapes on load", () => {
    const storage = createMockStorage({
      [BOOKING_DRAFT_STORAGE_KEY]: JSON.stringify({ selectedServiceId: 42 }),
    });

    assert.equal(loadBookingDraft(storage), null);
    assert.deepEqual(storage.dump(), {});
  });

  it("normalizes invalid IDs without restoring full VIN from defaults", () => {
    const defaultDraft = {
      selectedServiceId: "oil-change",
      fulfillmentId: "mobile",
      selectedOilId: "recommended",
      selectedProviderId: "maria",
      vehicle: {
        year: "2021",
        make: "Toyota",
        model: "RAV4",
        mileage: "42,800",
        vin: "JTMW1RFV1MD000000",
      },
      address: "Home · 220 W Kinzie St, Chicago, IL",
      appointmentTime: "Today 2:30 PM",
    };
    const { draft, changed } = normalizeBookingDraft({
      selectedServiceId: "not-a-service",
      fulfillmentId: "shop",
      selectedOilId: "not-oil",
      selectedProviderId: "maria",
      vehicle: {
        year: "2022",
        vinLast6: "123456",
      },
      address: "Office · 1 Full Address Way",
      appointmentTime: "Tomorrow 9:00 AM",
    }, {
      defaultDraft,
      services: [
        { id: "oil-change", name: "Oil", requiresPartsFitment: true },
        { id: "brakes", name: "Brakes" },
      ],
      fulfillmentOptions: [{ id: "mobile" }, { id: "shop" }],
      oilOptions: [{ id: "recommended" }, { id: "5w30" }],
      providers: [
        {
          id: "maria",
          serviceIds: ["oil-change"],
          fulfillmentModes: ["mobile"],
          availability: { available: true, earliestSlot: "Today 2:30 PM", rank: 1 },
          distance: 3,
          providerConfirmedParts: true,
          compliance: { providerConfirmedParts: true },
        },
        {
          id: "oak",
          serviceIds: ["oil-change"],
          fulfillmentModes: ["shop"],
          availability: { available: true, earliestSlot: "Today 4:00 PM", rank: 0 },
          distance: 0,
          providerConfirmedParts: true,
          compliance: { providerConfirmedParts: true },
        },
      ],
      deriveProviderSelection,
    });

    assert.equal(changed, true);
    assert.equal(draft.selectedServiceId, "oil-change");
    assert.equal(draft.fulfillmentId, "shop");
    assert.equal(draft.selectedOilId, "recommended");
    assert.equal(draft.selectedProviderId, "oak");
    assert.equal(draft.appointmentTime, "Today 4:00 PM");
    assert.equal(draft.address, defaultDraft.address);
    assert.equal(draft.vehicle.vin, undefined);
    assert.equal(draft.vehicle.vinLast6, "123456");
  });

  it("passes market to provider derivation and falls back from a wrong-market persisted provider/time", () => {
    const deriveCalls = [];
    const { draft, changed } = normalizeBookingDraft({
      selectedServiceId: "oil-change",
      fulfillmentId: "mobile",
      selectedOilId: "recommended",
      selectedProviderId: "detroit",
      appointmentTime: "Tomorrow 9:00 AM",
      vehicle: { year: "2021", make: "Toyota", model: "RAV4" },
    }, {
      defaultDraft: {
        selectedServiceId: "oil-change",
        fulfillmentId: "mobile",
        selectedOilId: "recommended",
        address: "Saved coarse location label",
      },
      services: [{ id: "oil-change", name: "Oil" }],
      fulfillmentOptions: [{ id: "mobile" }],
      oilOptions: [{ id: "recommended" }],
      market: " chicago ",
      providers: [
        {
          id: "detroit",
          serviceIds: ["oil-change"],
          fulfillmentModes: ["mobile"],
          availability: { available: true, earliestSlot: "Tomorrow 9:00 AM", rank: 0 },
          distance: 2,
          serviceArea: { market: "detroit", maxTravelMiles: 8 },
        },
        {
          id: "chicago",
          serviceIds: ["oil-change"],
          fulfillmentModes: ["mobile"],
          availability: { available: true, earliestSlot: "Today 3:00 PM", rank: 1 },
          distance: 3,
          serviceArea: { market: "Chicago", maxTravelMiles: 8 },
        },
      ],
      deriveProviderSelection(args) {
        deriveCalls.push(args);
        return deriveProviderSelection(args);
      },
    });

    assert.equal(deriveCalls.length, 1);
    assert.equal(deriveCalls[0].request.market, " chicago ");
    assert.equal(changed, true);
    assert.equal(draft.selectedProviderId, "chicago");
    assert.equal(draft.appointmentTime, "Today 3:00 PM");
  });

  it("passes locationProxy with blank market to provider derivation and clears wrong-market provider/time when no fallback exists", () => {
    const deriveCalls = [];
    const { draft, changed } = normalizeBookingDraft({
      selectedServiceId: "oil-change",
      fulfillmentId: "mobile",
      selectedOilId: "recommended",
      selectedProviderId: "detroit",
      appointmentTime: "Tomorrow 9:00 AM",
      vehicle: { year: "2021", make: "Toyota", model: "RAV4" },
    }, {
      defaultDraft: {
        selectedServiceId: "oil-change",
        fulfillmentId: "mobile",
        selectedOilId: "recommended",
      },
      services: [{ id: "oil-change", name: "Oil" }],
      fulfillmentOptions: [{ id: "mobile" }],
      oilOptions: [{ id: "recommended" }],
      market: "   ",
      locationProxy: { market: "CHICAGO" },
      providers: [
        {
          id: "detroit",
          serviceIds: ["oil-change"],
          fulfillmentModes: ["mobile"],
          availability: { available: true, earliestSlot: "Tomorrow 9:00 AM", rank: 0 },
          distance: 2,
          serviceArea: { market: "detroit", maxTravelMiles: 8 },
        },
      ],
      deriveProviderSelection(args) {
        deriveCalls.push(args);
        return deriveProviderSelection(args);
      },
    });

    assert.equal(deriveCalls.length, 1);
    assert.equal(deriveCalls[0].request.market, "   ");
    assert.deepEqual(deriveCalls[0].request.locationProxy, { market: "CHICAGO" });
    assert.equal(changed, true);
    assert.equal(draft.selectedProviderId, null);
    assert.equal(draft.appointmentTime, null);
  });

  it("keeps safe persisted vehicle UX details through booking draft normalization", () => {
    const defaultDraft = {
      selectedServiceId: "oil-change",
      fulfillmentId: "mobile",
      selectedOilId: "recommended",
      vehicle: { year: "2024", make: "Toyota", model: "Camry", engine: "2.5L I4" },
    };

    const { draft } = normalizeBookingDraft({
      selectedServiceId: "oil-change",
      fulfillmentId: "mobile",
      selectedOilId: "recommended",
      vehicle: {
        year: "2021",
        make: "Toyota",
        model: "RAV4",
        trim: "XLE Premium",
        engine: "2.5L I4 Hybrid",
        transmission: "eCVT",
      },
    }, {
      defaultDraft,
      services: [{ id: "oil-change", name: "Oil", requiresPartsFitment: true }],
      fulfillmentOptions: [{ id: "mobile" }],
      oilOptions: [{ id: "recommended" }],
    });

    assert.deepEqual(draft.vehicle, {
      year: "2021",
      make: "Toyota",
      model: "RAV4",
      trim: "XLE Premium",
      engine: "2.5L I4 Hybrid",
      transmission: "eCVT",
    });
  });

  it("does not complete vinLast6-only persisted identity with default vehicle fields", () => {
    const service = { id: "oil-change", name: "Oil", requiresPartsFitment: true };
    const fulfillment = { id: "mobile" };
    const oil = { id: "recommended" };
    const provider = { id: "maria" };
    const estimate = { total: 125, lineItems: [{ label: "Oil change", amount: 125 }] };
    const defaultDraft = {
      selectedServiceId: service.id,
      fulfillmentId: fulfillment.id,
      selectedOilId: oil.id,
      selectedProviderId: provider.id,
      vehicle: {
        year: "2024",
        make: "Toyota",
        model: "Camry",
        engine: "2.5L I4",
        vin: "JTMW1RFV1MD000000",
      },
      appointmentTime: "Today 2:30 PM",
    };

    const { draft } = normalizeBookingDraft({
      selectedServiceId: service.id,
      fulfillmentId: fulfillment.id,
      selectedOilId: oil.id,
      selectedProviderId: provider.id,
      vehicle: { vinLast6: "123456" },
      appointmentTime: "Today 2:30 PM",
    }, {
      defaultDraft,
      services: [service],
      fulfillmentOptions: [fulfillment],
      oilOptions: [oil],
      providers: [{
        ...provider,
        serviceIds: [service.id],
        fulfillmentModes: [fulfillment.id],
        availability: { available: true, earliestSlot: "Today 2:30 PM", rank: 0 },
        distance: 3,
        providerConfirmedParts: true,
      }],
      deriveProviderSelection,
    });

    assert.deepEqual(draft.vehicle, { vinLast6: "123456" });
    assert.equal(canConfirmBooking({
      service,
      fulfillment,
      oil,
      provider,
      vehicle: draft.vehicle,
      appointmentTime: draft.appointmentTime,
      estimate,
    }), false);
  });

  it("does not allow a stale default VIN to complete identity after persisted make/model edits", () => {
    const service = { id: "oil-change", name: "Oil", requiresPartsFitment: true };
    const fulfillment = { id: "mobile" };
    const oil = { id: "recommended" };
    const provider = { id: "maria" };
    const estimate = { total: 125, lineItems: [{ label: "Oil change", amount: 125 }] };
    const defaultDraft = {
      selectedServiceId: service.id,
      fulfillmentId: fulfillment.id,
      selectedOilId: oil.id,
      selectedProviderId: provider.id,
      vehicle: { year: "2024", make: "Toyota", model: "Camry", vin: "JTMW1RFV1MD000000" },
      appointmentTime: "Today 2:30 PM",
    };

    const { draft } = normalizeBookingDraft({
      selectedServiceId: service.id,
      fulfillmentId: fulfillment.id,
      selectedOilId: oil.id,
      selectedProviderId: provider.id,
      vehicle: { year: "2024", make: "Honda", model: "" },
      appointmentTime: "Today 2:30 PM",
    }, {
      defaultDraft,
      services: [service],
      fulfillmentOptions: [fulfillment],
      oilOptions: [oil],
      providers: [{
        ...provider,
        serviceIds: [service.id],
        fulfillmentModes: [fulfillment.id],
        availability: { available: true, earliestSlot: "Today 2:30 PM", rank: 0 },
        distance: 3,
        providerConfirmedParts: true,
      }],
      deriveProviderSelection,
    });

    assert.equal(draft.vehicle.vin, undefined);
    assert.equal(canConfirmBooking({
      service,
      fulfillment,
      oil,
      provider,
      vehicle: draft.vehicle,
      appointmentTime: draft.appointmentTime,
      estimate,
    }), false);
  });

  it("normalizes stale persisted provider with fallback provider earliest slot", () => {
    const defaultDraft = {
      selectedServiceId: "oil-change",
      fulfillmentId: "shop",
      selectedOilId: "recommended",
      selectedProviderId: "maria",
      vehicle: { year: "2021", make: "Toyota", model: "RAV4", vin: "JTMW1RFV1MD000000" },
      address: "Home · 220 W Kinzie St, Chicago, IL",
      appointmentTime: "Today 2:30 PM",
    };
    const { draft, changed } = normalizeBookingDraft({
      selectedServiceId: "oil-change",
      fulfillmentId: "shop",
      selectedOilId: "recommended",
      selectedProviderId: "maria",
      vehicle: { year: "2021", make: "Toyota", model: "RAV4" },
      appointmentTime: "Stale persisted slot",
    }, {
      defaultDraft,
      services: [{ id: "oil-change", name: "Oil", requiresPartsFitment: true }],
      fulfillmentOptions: [{ id: "mobile" }, { id: "shop" }],
      oilOptions: [{ id: "recommended" }],
      providers: [
        {
          id: "maria",
          serviceIds: ["oil-change"],
          fulfillmentModes: ["mobile"],
          availability: { available: true, earliestSlot: "Today 2:30 PM", rank: 0 },
          distance: 3,
          providerConfirmedParts: true,
        },
        {
          id: "oak",
          serviceIds: ["oil-change"],
          fulfillmentModes: ["shop"],
          availability: { available: true, earliestSlot: "Tomorrow 10:00 AM", rank: 0 },
          distance: 0,
          providerConfirmedParts: true,
        },
      ],
      deriveProviderSelection,
    });

    assert.equal(changed, true);
    assert.equal(draft.selectedProviderId, "oak");
    assert.equal(draft.appointmentTime, "Tomorrow 10:00 AM");
  });

  it("normalizes stale persisted appointment time to same eligible provider earliest slot", () => {
    const defaultDraft = {
      selectedServiceId: "oil-change",
      fulfillmentId: "mobile",
      selectedOilId: "recommended",
      selectedProviderId: "maria",
      vehicle: { year: "2021", make: "Toyota", model: "RAV4", vin: "JTMW1RFV1MD000000" },
      address: "Home · 220 W Kinzie St, Chicago, IL",
      appointmentTime: "Today 2:30 PM",
    };
    const { draft, changed } = normalizeBookingDraft({
      selectedServiceId: "oil-change",
      fulfillmentId: "mobile",
      selectedOilId: "recommended",
      selectedProviderId: "maria",
      vehicle: { year: "2021", make: "Toyota", model: "RAV4" },
      appointmentTime: "Stale persisted slot",
    }, {
      defaultDraft,
      services: [{ id: "oil-change", name: "Oil", requiresPartsFitment: true }],
      fulfillmentOptions: [{ id: "mobile" }, { id: "shop" }],
      oilOptions: [{ id: "recommended" }],
      providers: [
        {
          id: "maria",
          serviceIds: ["oil-change"],
          fulfillmentModes: ["mobile"],
          availability: { available: true, earliestSlot: "Today 2:30 PM", rank: 0 },
          distance: 3,
          providerConfirmedParts: true,
        },
        {
          id: "oak",
          serviceIds: ["oil-change"],
          fulfillmentModes: ["shop"],
          availability: { available: true, earliestSlot: "Tomorrow 10:00 AM", rank: 0 },
          distance: 0,
          providerConfirmedParts: true,
        },
      ],
      deriveProviderSelection,
    });

    assert.equal(changed, true);
    assert.equal(draft.selectedProviderId, "maria");
    assert.equal(draft.appointmentTime, "Today 2:30 PM");
  });

  it("clears persisted provider and appointment time when no eligible provider remains", () => {
    const service = { id: "oil-change", name: "Oil", requiresPartsFitment: true };
    const fulfillment = { id: "mobile" };
    const oil = { id: "recommended" };
    const estimate = { total: 125, lineItems: [{ label: "Oil change", amount: 125 }] };
    const defaultDraft = {
      selectedServiceId: service.id,
      fulfillmentId: fulfillment.id,
      selectedOilId: oil.id,
      selectedProviderId: "maria",
      vehicle: { year: "2021", make: "Toyota", model: "RAV4", vin: "JTMW1RFV1MD000000" },
      address: "Home · 220 W Kinzie St, Chicago, IL",
      appointmentTime: "Today 2:30 PM",
    };
    const { draft, changed } = normalizeBookingDraft({
      selectedServiceId: service.id,
      fulfillmentId: fulfillment.id,
      selectedOilId: oil.id,
      selectedProviderId: "maria",
      vehicle: { year: "2021", make: "Toyota", model: "RAV4" },
      appointmentTime: "Today 2:30 PM",
    }, {
      defaultDraft,
      services: [service],
      fulfillmentOptions: [fulfillment],
      oilOptions: [oil],
      providers: [
        {
          id: "maria",
          serviceIds: ["brakes"],
          fulfillmentModes: ["shop"],
          availability: { available: false, earliestSlot: null, rank: 0 },
          distance: 3,
          providerConfirmedParts: true,
        },
      ],
      deriveProviderSelection,
    });

    assert.equal(changed, true);
    assert.equal(draft.selectedProviderId, null);
    assert.equal(draft.appointmentTime, null);
    assert.equal(canConfirmBooking({
      service,
      fulfillment,
      oil,
      provider: null,
      vehicle: draft.vehicle,
      appointmentTime: draft.appointmentTime,
      estimate,
    }), false);
  });

  it("sanitizes non-object or empty draft input", () => {
    assert.equal(sanitizeBookingDraft(null), null);
    assert.equal(sanitizeBookingDraft([]), null);
    assert.equal(sanitizeBookingDraft({ selectedServiceId: 42 }), null);
  });
});
