const VEHICLE_IDENTITY_FIELDS = ["year", "make", "model", "trim", "engine", "transmission"];

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function normalizeVinLast6(value) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function minimizeVehicleIdentity(vehicle = {}) {
  const minimized = { ...vehicle };
  // Legacy seed/draft protection: discard full VIN rather than deriving or retaining it.
  delete minimized.vin;
  if (hasValue(minimized.vinLast6)) minimized.vinLast6 = normalizeVinLast6(minimized.vinLast6);
  return minimized;
}

function setVehicleVinLast6(vehicle = {}, value) {
  const nextVehicle = { ...vehicle };
  delete nextVehicle.vin;
  const vinLast6 = normalizeVinLast6(value);
  if (vinLast6) nextVehicle.vinLast6 = vinLast6;
  else delete nextVehicle.vinLast6;
  return nextVehicle;
}

function updateVehicleIdentity(vehicle = {}, field, value) {
  if (field === "vinLast6") return setVehicleVinLast6(vehicle, value);
  if (field === "vin") return minimizeVehicleIdentity(vehicle);
  const nextVehicle = { ...vehicle, [field]: value };
  delete nextVehicle.vin;
  if (VEHICLE_IDENTITY_FIELDS.includes(field) && String(vehicle[field] ?? "") !== String(value ?? "")) {
    delete nextVehicle.vinLast6;
    delete nextVehicle.vinLast4;
  }
  return nextVehicle;
}

function vehicleHasManualIdentity(vehicle = {}) {
  return ["year", "make", "model"].every((field) => hasValue(vehicle[field]));
}
function vehicleHasVinIdentity(vehicle = {}) {
  return /^[A-Z0-9]{6}$/.test(String(vehicle.vinLast6 ?? ""));
}
function vehicleIdentityIsComplete(vehicle = {}) {
  return vehicleHasManualIdentity(vehicle);
}

module.exports = {
  VEHICLE_IDENTITY_FIELDS,
  minimizeVehicleIdentity,
  normalizeVinLast6,
  setVehicleVinLast6,
  updateVehicleIdentity,
  vehicleHasManualIdentity,
  vehicleHasVinIdentity,
  vehicleIdentityIsComplete,
};
