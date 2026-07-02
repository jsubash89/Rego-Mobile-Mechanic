import assert from "node:assert/strict";
import test from "node:test";

import vehicleIdentity from "./vehicle-identity.js";

const {
  minimizeVehicleIdentity,
  setExplicitVehicleVin,
  updateVehicleIdentity,
  vehicleIdentityIsComplete,
} = vehicleIdentity;

test("manual vehicle identity edits clear stale VIN identity", () => {
  const vehicle = {
    year: "2024",
    make: "Toyota",
    model: "Camry",
    trim: "LE",
    engine: "2.5L 4-Cylinder",
    transmission: "Automatic",
    vin: "JTMW1RFV1MD000000",
    vinLast6: "000000",
  };

  const changed = updateVehicleIdentity(vehicle, "model", "RAV4");

  assert.equal(changed.model, "RAV4");
  assert.equal(changed.vin, undefined);
  assert.equal(changed.vinLast6, undefined);
  assert.equal(vehicleIdentityIsComplete(changed), true);
});

test("explicit VIN entry records VIN identity and minimized suffix", () => {
  const vehicle = { year: "2024", make: "Toyota", model: "Camry" };

  const withVin = setExplicitVehicleVin(vehicle, " jtmwfrev1mj123456 ");

  assert.equal(withVin.vin, "JTMWFREV1MJ123456");
  assert.equal(withVin.vinLast6, "123456");
  assert.equal(vehicleIdentityIsComplete(withVin), true);
});

test("vehicle identity minimization strips full VIN but keeps a safe suffix", () => {
  const minimized = minimizeVehicleIdentity({ year: "2021", make: "Toyota", model: "RAV4", vin: "JTMWFREV1MJ123456" });

  assert.equal(minimized.vin, undefined);
  assert.equal(minimized.vinLast6, "123456");
});
