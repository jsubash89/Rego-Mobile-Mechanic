const VEHICLE_IDENTITY_FIELDS = ["year", "make", "model", "trim", "engine", "transmission"];

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function normalizeVin(value) {
  return String(value ?? "").trim().toUpperCase();
}

function getVinLast6(value) {
  const normalized = normalizeVin(value);
  return normalized ? normalized.slice(-6) : undefined;
}

function minimizeVehicleIdentity(vehicle = {}) {
  const minimized = { ...vehicle };

  if (hasValue(minimized.vin)) {
    minimized.vinLast6 = getVinLast6(minimized.vin);
    delete minimized.vin;
  }

  return minimized;
}

function setExplicitVehicleVin(vehicle = {}, vin) {
  const normalizedVin = normalizeVin(vin);

  if (!normalizedVin) {
    const nextVehicle = { ...vehicle };
    delete nextVehicle.vin;
    delete nextVehicle.vinLast6;
    return nextVehicle;
  }

  return {
    ...vehicle,
    vin: normalizedVin,
    vinLast6: getVinLast6(normalizedVin),
  };
}

function updateVehicleIdentity(vehicle = {}, field, value) {
  const nextVehicle = { ...vehicle, [field]: value };

  if (field === "vin") {
    return setExplicitVehicleVin(vehicle, value);
  }

  if (VEHICLE_IDENTITY_FIELDS.includes(field) && String(vehicle[field] ?? "") !== String(value ?? "")) {
    delete nextVehicle.vin;
    delete nextVehicle.vinLast6;
    delete nextVehicle.vinLast4;
  }

  return nextVehicle;
}

function vehicleHasManualIdentity(vehicle = {}) {
  return ["year", "make", "model"].every((field) => hasValue(vehicle[field]));
}

function vehicleHasVinIdentity(vehicle = {}) {
  return hasValue(vehicle.vin);
}

function vehicleIdentityIsComplete(vehicle = {}) {
  return vehicleHasVinIdentity(vehicle) || vehicleHasManualIdentity(vehicle);
}

module.exports = {
  VEHICLE_IDENTITY_FIELDS,
  getVinLast6,
  minimizeVehicleIdentity,
  normalizeVin,
  setExplicitVehicleVin,
  updateVehicleIdentity,
  vehicleHasManualIdentity,
  vehicleHasVinIdentity,
  vehicleIdentityIsComplete,
};
