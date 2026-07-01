const BOOKING_DRAFT_STORAGE_KEY = "rego.bookingDraft.v1";

const BOOKING_DRAFT_FIELDS = [
  "vehicle",
  "selectedServiceId",
  "fulfillmentId",
  "selectedProviderId",
  "selectedOilId",
  "appointmentTime",
];

const SAFE_VEHICLE_FIELDS = ["year", "make", "model", "mileage", "vinLast6", "vinLast4"];

function getBrowserStorage(storage) {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readLocalStorageJson(key, fallback = null, storage) {
  const targetStorage = getBrowserStorage(storage);

  if (!targetStorage) {
    return fallback;
  }

  try {
    const rawValue = targetStorage.getItem(key);

    if (rawValue === null) {
      return fallback;
    }

    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

function writeLocalStorageJson(key, value, storage) {
  const targetStorage = getBrowserStorage(storage);

  if (!targetStorage) {
    return false;
  }

  try {
    targetStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeLocalStorageItem(key, storage) {
  const targetStorage = getBrowserStorage(storage);

  if (!targetStorage) {
    return false;
  }

  try {
    targetStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function cleanString(value) {
  return typeof value === "string" ? value : undefined;
}

function cleanVehicle(vehicle) {
  if (!vehicle || typeof vehicle !== "object" || Array.isArray(vehicle)) {
    return undefined;
  }

  const sanitized = {};

  for (const field of SAFE_VEHICLE_FIELDS) {
    if (typeof vehicle[field] === "string" || typeof vehicle[field] === "number") {
      sanitized[field] = String(vehicle[field]);
    }
  }

  if (!sanitized.vinLast6 && (typeof vehicle.vin === "string" || typeof vehicle.vin === "number")) {
    sanitized.vinLast6 = String(vehicle.vin).slice(-6);
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeBookingDraft(draft) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return null;
  }

  const sanitized = {};
  const vehicle = cleanVehicle(draft.vehicle);

  if (vehicle) sanitized.vehicle = vehicle;

  for (const field of BOOKING_DRAFT_FIELDS) {
    if (field === "vehicle") continue;

    const value = cleanString(draft[field]);
    if (value !== undefined) sanitized[field] = value;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function loadBookingDraft(storage) {
  const targetStorage = getBrowserStorage(storage);

  if (!targetStorage) {
    return null;
  }

  let rawDraft;

  try {
    const rawValue = targetStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);

    if (rawValue === null) {
      return null;
    }

    rawDraft = JSON.parse(rawValue);
  } catch {
    removeLocalStorageItem(BOOKING_DRAFT_STORAGE_KEY, storage);
    return null;
  }

  const sanitized = sanitizeBookingDraft(rawDraft);

  if (!sanitized) {
    removeLocalStorageItem(BOOKING_DRAFT_STORAGE_KEY, storage);
  }

  return sanitized;
}

function chooseValidId(value, options, fallbackValue) {
  const ids = options.map((option) => option.id);

  if (ids.includes(value)) {
    return value;
  }

  if (ids.includes(fallbackValue)) {
    return fallbackValue;
  }

  return ids[0] ?? null;
}

function normalizeBookingDraft(draft, {
  defaultDraft = {},
  services = [],
  fulfillmentOptions = [],
  oilOptions = [],
  providers = [],
  deriveProviderSelection,
  chooseSelectedProvider,
} = {}) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return { draft: null, changed: false };
  }

  const selectedServiceId = chooseValidId(draft.selectedServiceId, services, defaultDraft.selectedServiceId);
  const fulfillmentId = chooseValidId(draft.fulfillmentId, fulfillmentOptions, defaultDraft.fulfillmentId);
  const selectedOilId = chooseValidId(draft.selectedOilId, oilOptions, defaultDraft.selectedOilId);
  const service = services.find((option) => option.id === selectedServiceId) ?? null;
  const fulfillment = fulfillmentOptions.find((option) => option.id === fulfillmentId) ?? null;
  const draftVehicle = { ...(draft.vehicle ?? {}) };
  delete draftVehicle.vinLast4;
  delete draftVehicle.vinLast6;
  const vehicle = { ...(defaultDraft.vehicle ?? {}), ...draftVehicle };
  const providerRequest = { service, fulfillment, vehicle };
  const providerSelection = typeof deriveProviderSelection === "function"
    ? deriveProviderSelection({
      providers,
      selectedProviderId: draft.selectedProviderId,
      appointmentTime: draft.appointmentTime,
      request: providerRequest,
    })
    : null;
  const providerMatch = !providerSelection && typeof chooseSelectedProvider === "function"
    ? chooseSelectedProvider({
      providers,
      selectedProviderId: draft.selectedProviderId,
      request: providerRequest,
    })
    : null;
  const selectedProviderId = providerSelection?.selectedProviderId ?? providerMatch?.providerId ?? null;
  const appointmentTime = selectedProviderId
    ? (providerSelection?.match?.earliestSlot ?? providerMatch?.earliestSlot ?? null)
    : null;
  const normalizedDraft = {
    selectedServiceId,
    fulfillmentId,
    selectedOilId,
    selectedProviderId,
    vehicle,
    address: defaultDraft.address,
    appointmentTime: appointmentTime ?? null,
  };
  const changed =
    normalizedDraft.selectedServiceId !== draft.selectedServiceId ||
    normalizedDraft.fulfillmentId !== draft.fulfillmentId ||
    normalizedDraft.selectedOilId !== draft.selectedOilId ||
    normalizedDraft.selectedProviderId !== draft.selectedProviderId ||
    normalizedDraft.appointmentTime !== (draft.appointmentTime ?? null) ||
    normalizedDraft.address !== draft.address;

  return { draft: normalizedDraft, changed };
}

function saveBookingDraft(draft, storage) {
  const sanitized = sanitizeBookingDraft(draft);

  if (!sanitized) {
    return removeLocalStorageItem(BOOKING_DRAFT_STORAGE_KEY, storage);
  }

  return writeLocalStorageJson(BOOKING_DRAFT_STORAGE_KEY, sanitized, storage);
}

function clearBookingDraft(storage) {
  return removeLocalStorageItem(BOOKING_DRAFT_STORAGE_KEY, storage);
}

module.exports = {
  BOOKING_DRAFT_FIELDS,
  BOOKING_DRAFT_STORAGE_KEY,
  clearBookingDraft,
  loadBookingDraft,
  readLocalStorageJson,
  removeLocalStorageItem,
  normalizeBookingDraft,
  sanitizeBookingDraft,
  saveBookingDraft,
  writeLocalStorageJson,
};
