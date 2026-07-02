import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CREATE_XYZ_FIDELITY_NOTES,
  CREATE_XYZ_HERO_ASSET,
  CUSTOMER_NAV_ITEMS,
  HERO_SERVICES,
  LOCATION_TYPES,
  SCHEDULE_OPTIONS,
} from "./createxyz-ux.js";

describe("create.xyz customer UX constants", () => {
  it("keeps the screenshot-derived hero service tiles in create.xyz order", () => {
    assert.deepEqual(HERO_SERVICES.map((service) => service.name), [
      "Oil Change",
      "Brakes",
      "Battery",
      "Car Tow",
      "Schedule a Pick Up",
      "Other Services",
    ]);
  });

  it("keeps Car Tow visually present but partner-only for roadside handoff", () => {
    const tow = HERO_SERVICES.find((service) => service.id === "tow");

    assert.equal(tow.name, "Car Tow");
    assert.equal(tow.engineServiceId, null);
    assert.equal(tow.partnerOnly, true);
    assert.match(CREATE_XYZ_FIDELITY_NOTES.roadside, /partner-only/);
  });

  it("matches the create.xyz scheduling and service-location modal labels", () => {
    assert.deepEqual(SCHEDULE_OPTIONS.map((option) => option.label), [
      "Specific Date and Time",
      "Flexible Days and Time",
      "Earliest Available",
    ]);
    assert.deepEqual(LOCATION_TYPES, ["Home", "Work", "Other", "Garage", "Driveway", "Parking Lot"]);
  });

  it("uses a deterministic local hero card asset instead of a network image", () => {
    assert.equal(CREATE_XYZ_HERO_ASSET, "/images/createxyz-hero-mechanic-card.png");
    assert.match(CREATE_XYZ_FIDELITY_NOTES.hero, /local crop/);
  });

  it("keeps Mechanic Sign Up in customer nav without exposing internal demos", () => {
    assert.deepEqual(CUSTOMER_NAV_ITEMS.map((item) => item.label), ["Service Area", "About Us", "Mechanic Sign Up"]);
    assert.equal(CUSTOMER_NAV_ITEMS.find((item) => item.label === "Mechanic Sign Up").href, "#mechanic-signup-info");
    assert.equal(CUSTOMER_NAV_ITEMS.some((item) => item.href === "#demo-access"), false);
    assert.match(CREATE_XYZ_FIDELITY_NOTES.nav, /not provider\/dispatch demo controls/);
  });
});
