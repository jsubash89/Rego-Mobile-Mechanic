import assert from "node:assert/strict";
import test from "node:test";

import vehicleIdentity from "./vehicle-identity.js";

const {
  minimizeVehicleIdentity,
  setVehicleVinLast6,
  updateVehicleIdentity,
  vehicleIdentityIsComplete,
} = vehicleIdentity;

test("manual vehicle identity edits clear stale VIN suffix identity", () => {
  const vehicle = { year: "2024", make: "Toyota", model: "Camry", vinLast6: "000000" };
  const changed = updateVehicleIdentity(vehicle, "model", "RAV4");
  assert.equal(changed.model, "RAV4");
  assert.equal(changed.vin, undefined);
  assert.equal(changed.vinLast6, undefined);
  assert.equal(vehicleIdentityIsComplete(changed), true);
});

test("VIN last-six entry stores at most six alphanumeric characters and never full VIN", () => {
  const vehicle = { year: "2024", make: "Toyota", model: "Camry" };
  const withSuffix = setVehicleVinLast6(vehicle, " ab-12cd789 ");
  assert.equal(withSuffix.vin, undefined);
  assert.equal(withSuffix.vinLast6, "AB12CD");
  assert.equal(JSON.stringify(withSuffix).includes("AB12CD789"), false);
});

test("vehicle identity minimization discards a legacy full VIN without deriving from it", () => {
  const minimized = minimizeVehicleIdentity({ year: "2021", make: "Toyota", model: "RAV4", vin: "JTMWFREV1MJ123456" });
  assert.equal(minimized.vin, undefined);
  assert.equal(minimized.vinLast6, undefined);
});
