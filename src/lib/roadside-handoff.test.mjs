import assert from "node:assert/strict";
import test from "node:test";

import { roadsidePartners } from "../data/roadside-partners.js";
import roadsideHandoff from "./roadside-handoff.js";

const {
  buildRoadsideHandoff,
  getRoadsidePartnerCandidates,
  isEmergencyRoadsideIntent,
  isReGoBookingEligibleService,
} = roadsideHandoff;

const fixedTimestamp = "2026-07-01T12:00:00.000Z";

const emergencyTypes = [
  "tow",
  "lockout",
  "fuel_delivery",
  "battery_jump_emergency",
  "flat_tire_emergency",
  "unsafe_location",
];

test("emergency roadside categories route to partner handoff and never ReGo dispatch", () => {
  for (const serviceType of emergencyTypes) {
    const result = buildRoadsideHandoff({ market: "chicago", serviceType, partners: roadsidePartners, timestamp: fixedTimestamp });

    assert.equal(isEmergencyRoadsideIntent(serviceType), true);
    assert.equal(result.route, "partner_handoff");
    assert.equal(result.bookingAllowed, false);
    assert.equal(result.dispatchJob, null);
    assert.equal(result.providerAssignment, null);
    assert.equal(result.auditEvent.type, "partner_handoff_viewed");
    assert.equal(result.auditEvent.createdAt, fixedTimestamp);
    assert.equal(result.auditEvent.piiStored, false);
    assert.match(result.disclosure, /ReGo does not operate towing, lockout, fuel delivery, emergency flat-tire response, or emergency battery dispatch/);
  }
});

test("non-emergency service categories continue to ReGo booking path", () => {
  for (const serviceType of ["oil-change", "diagnostic", "brakes", "inspection", "maintenance"]) {
    const result = buildRoadsideHandoff({ market: "chicago", serviceType, partners: roadsidePartners, timestamp: fixedTimestamp });

    assert.equal(isEmergencyRoadsideIntent(serviceType), false);
    assert.equal(isReGoBookingEligibleService(serviceType), true);
    assert.equal(result.route, "rego_booking");
    assert.equal(result.bookingAllowed, true);
    assert.equal(result.partnerCandidates.length, 0);
    assert.equal(result.auditEvent, null);
    assert.equal(result.dispatchJob, null);
    assert.equal(result.providerAssignment, null);
  }
});

test("handoff partner candidates respect market, service type, and availability", () => {
  const candidates = getRoadsidePartnerCandidates({
    market: "chicago",
    serviceType: "tow",
    partners: [
      ...roadsidePartners,
      {
        id: "unavailable-test",
        name: "Unavailable Test Partner",
        markets: ["chicago"],
        serviceTypes: ["tow"],
        available: false,
      },
      {
        id: "wrong-service-test",
        name: "Wrong Service Partner",
        markets: ["chicago"],
        serviceTypes: ["lockout"],
      },
      {
        id: "wrong-market-test",
        name: "Wrong Market Partner",
        markets: ["detroit"],
        serviceTypes: ["tow"],
      },
    ],
  });

  assert.deepEqual(candidates.map((partner) => partner.id), ["roadside-network-chicago", "national-roadside-app"]);
});

test("unavailable market/service returns safe fallback support copy and no dispatch", () => {
  const result = buildRoadsideHandoff({ market: "boise", serviceType: "tow", partners: roadsidePartners, timestamp: fixedTimestamp });

  assert.equal(result.route, "partner_handoff");
  assert.equal(result.bookingAllowed, false);
  assert.deepEqual(result.partnerCandidates, []);
  assert.deepEqual(result.auditEvent.partnerCandidateIds, []);
  assert.match(result.guidance, /No static partner is configured/);
  assert.match(result.guidance, /ReGo will not create a provider dispatch job/);
  assert.equal(result.dispatchJob, null);
  assert.equal(result.providerAssignment, null);
});

test("national fallback is deliberate market selection, not wildcard coverage for unsupported markets", () => {
  const unsupportedCandidates = getRoadsidePartnerCandidates({
    market: "boise",
    serviceType: "tow",
    partners: roadsidePartners,
  });
  const fallbackResult = buildRoadsideHandoff({
    market: "national_fallback",
    serviceType: "tow",
    partners: roadsidePartners,
    timestamp: fixedTimestamp,
  });

  assert.deepEqual(unsupportedCandidates, []);
  assert.deepEqual(fallbackResult.partnerCandidates.map((partner) => partner.id), ["national-roadside-app"]);
  assert.match(fallbackResult.guidance, /National fallback mode was deliberately selected/);
  assert.equal(
    fallbackResult.auditEvent.id,
    "roadside-handoff-national_fallback-tow-20260701T120000000Z",
  );
});

test("audit event defaults to call-time timestamp but accepts deterministic override", () => {
  const deterministic = buildRoadsideHandoff({
    market: "chicago",
    serviceType: "lockout",
    partners: roadsidePartners,
    timestamp: fixedTimestamp,
  });
  const beforeCurrent = Date.now();
  const current = buildRoadsideHandoff({ market: "chicago", serviceType: "lockout", partners: roadsidePartners });
  const afterCurrent = Date.now();

  assert.equal(deterministic.auditEvent.createdAt, fixedTimestamp);
  assert.equal(
    deterministic.auditEvent.id,
    "roadside-handoff-chicago-lockout-20260701T120000000Z",
  );
  assert.match(current.auditEvent.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.ok(Date.parse(current.auditEvent.createdAt) >= beforeCurrent);
  assert.ok(Date.parse(current.auditEvent.createdAt) <= afterCurrent);
});

test("handoff output contains operator disclosure and avoids dispatch-like fields", () => {
  const result = buildRoadsideHandoff({ market: "chicago", serviceType: "lockout", partners: roadsidePartners });

  assert.match(result.disclosure, /ReGo does not operate/);
  assert.equal(Object.hasOwn(result, "status"), false);
  assert.equal(Object.hasOwn(result, "providerId"), false);
  assert.equal(Object.hasOwn(result, "providerName"), false);
  assert.equal(Object.hasOwn(result, "bookingId"), false);
  assert.equal(result.dispatchJob, null);
  assert.equal(result.providerAssignment, null);
});
