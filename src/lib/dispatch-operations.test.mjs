import assert from "node:assert/strict";
import test from "node:test";

import dispatchOperations from "./dispatch-operations.js";
import matching from "./provider-matching.js";

const {
  DISPATCH_JOB_STATES,
  MANUAL_ACTIONS,
  applyDispatchAction,
  applyManualAction,
  canAssignProvider,
  canReassignJob,
  decorateDispatchJob,
  deriveDispatchQueue,
  filterDispatchJobs,
  getAssignmentCandidates,
  getReassignCandidate,
  groupDispatchJobs,
} = dispatchOperations;

const { getProviderMatchingResults } = matching;

function provider(overrides = {}) {
  return {
    id: "maria",
    name: "Maria Rodriguez",
    rating: 4.9,
    distance: 3,
    serviceIds: ["oil-change", "diagnostic"],
    specialtyServiceIds: ["oil-change"],
    fulfillmentModes: ["mobile"],
    availability: { available: true, earliestSlot: "Today 2:00 PM", rank: 0 },
    serviceArea: { market: "chicago", maxTravelMiles: 8 },
    providerConfirmedParts: true,
    certifications: ["ASE"],
    compliance: { verified: true, insured: true, backgroundChecked: true, providerConfirmedParts: true },
    ...overrides,
  };
}

function job(overrides = {}) {
  return {
    id: "dispatch-1",
    bookingId: "BK-1",
    status: DISPATCH_JOB_STATES.confirmed,
    serviceId: "oil-change",
    serviceName: "Oil change",
    fulfillmentId: "mobile",
    market: "chicago",
    providerId: null,
    providerDistances: { maria: 3, far: 18, shop: 2, unavailable: 4, detroit: 2, david: 4 },
    requiresPartsFitment: true,
    providerConfirmationRequired: true,
    sla: { minutesToBreach: 20 },
    customer: { displayName: "J. D.", phone: "312-555-0100", address: "123 Private St, Chicago, IL" },
    vehicle: { vin: "2T3P1RFV1MW123456" },
    auditTrail: [],
    ...overrides,
  };
}

const actor = { type: "dispatcher", id: "ops-demo", name: "Ops Demo" };

function assertAuditMetadata(result, action) {
  assert.equal(result.ok, true);
  assert.equal(result.audit.action, action);
  assert.equal(result.audit.actorType, actor.type);
  assert.equal(result.audit.actorId, actor.id);
  assert.equal(result.audit.actorName, actor.name);
  assert.ok(result.audit.reason.length > 0);
  assert.ok(result.audit.createdAt);
  assert.ok(result.audit.id.match(/^dispatch-1-[a-z_]+-20260701T120000000Z-[a-z0-9]{1,}$/));
  assert.equal(result.job.auditTrail[0].id, result.audit.id);
}

test("assignment candidates respect capability, availability, service area, fulfillment, and market rules", () => {
  const candidates = getAssignmentCandidates(job(), [
    provider({ id: "maria" }),
    provider({ id: "far", serviceArea: { market: "chicago", maxTravelMiles: 8 } }),
    provider({ id: "shop", fulfillmentModes: ["shop"] }),
    provider({ id: "unavailable", availability: { available: false, earliestSlot: null } }),
    provider({ id: "detroit", serviceArea: { market: "detroit", maxTravelMiles: 8 } }),
  ]);

  assert.deepEqual(candidates.matches.map((match) => match.providerId), ["maria"]);
  assert.ok(candidates.ineligible.find((match) => match.providerId === "far").exclusions.includes("Outside 8 mi mobile service area"));
  assert.ok(candidates.ineligible.find((match) => match.providerId === "shop").exclusions.includes("Fulfillment mode not supported"));
  assert.ok(candidates.ineligible.find((match) => match.providerId === "unavailable").exclusions.includes("No bookable availability"));
  assert.ok(candidates.ineligible.find((match) => match.providerId === "detroit").exclusions.includes("Provider market detroit does not cover job market chicago"));
});

test("canAssignProvider blocks ineligible providers with matching exclusions", () => {
  const result = canAssignProvider(job(), "far", [provider({ id: "far", serviceArea: { market: "chicago", maxTravelMiles: 8 } })]);

  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes("Outside 8 mi mobile service area"));
});

test("wrong-market provider is not eligible or assignable", () => {
  const providers = [provider({ id: "detroit", serviceArea: { market: "detroit", maxTravelMiles: 8 } })];
  const eligibility = canAssignProvider(job(), "detroit", providers);
  const result = applyDispatchAction(job(), {
    type: MANUAL_ACTIONS.assign,
    providerId: "detroit",
    providerName: "Detroit Tech",
    actor,
    reason: "Try wrong market assignment.",
  }, providers);

  assert.equal(eligibility.ok, false);
  assert.ok(eligibility.blockers.includes("Provider market detroit does not cover job market chicago"));
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes("Provider market detroit does not cover job market chicago"));
});

test("assignment candidates rely on matching market normalization without duplicate stricter exclusions", () => {
  const candidates = getAssignmentCandidates(job({ market: " chicago " }), [
    provider({ id: "variant", serviceArea: { market: "Chicago", maxTravelMiles: 8 } }),
    provider({ id: "detroit", serviceArea: { market: " Detroit ", maxTravelMiles: 8 } }),
  ]);

  assert.deepEqual(candidates.matches.map((match) => match.providerId), ["variant"]);
  const detroit = candidates.ineligible.find((match) => match.providerId === "detroit");
  assert.equal(detroit.exclusions.filter((exclusion) => exclusion.includes("does not cover job market")).length, 1);
});

test("assignment candidates preserve provider matching ranking as the single source", () => {
  const providers = [
    provider({ id: "alpha", distance: 1, availability: { available: true, earliestSlot: "Today 4:00 PM", rank: 1 } }),
    provider({ id: "zulu", distance: 6, availability: { available: true, earliestSlot: "Today 2:00 PM", rank: 0 } }),
  ];
  const dispatchJob = job({ providerDistances: {} });
  const request = {
    service: {
      id: dispatchJob.serviceId,
      name: dispatchJob.serviceName,
      requiresPartsFitment: dispatchJob.requiresPartsFitment,
      providerConfirmationRequired: dispatchJob.providerConfirmationRequired,
    },
    fulfillment: { id: dispatchJob.fulfillmentId },
    market: dispatchJob.market,
    providerDistances: dispatchJob.providerDistances,
    providerCoverage: dispatchJob.providerCoverage,
  };

  const matchingResults = getProviderMatchingResults(providers, request);
  const candidates = getAssignmentCandidates(dispatchJob, providers);

  assert.equal(matchingResults.matches[0].providerId, "zulu");
  assert.equal(matchingResults.matches[0].score, matchingResults.matches[1].score);
  assert.deepEqual(candidates.matches.map((match) => match.providerId), matchingResults.matches.map((match) => match.providerId));
});

test("assignment actions fail closed without provider eligibility context", () => {
  const assign = applyDispatchAction(job(), {
    type: MANUAL_ACTIONS.assign,
    providerId: "maria",
    providerName: "Maria Rodriguez",
    actor,
    reason: "Missing provider eligibility context should block.",
  });
  const reassign = applyManualAction(job({ status: DISPATCH_JOB_STATES.assigned, providerId: "maria" }), {
    type: MANUAL_ACTIONS.reassign,
    providerId: "david",
    actor,
    reason: "Missing provider eligibility context should block.",
  });

  assert.equal(assign.ok, false);
  assert.ok(assign.blockers.includes("Provider eligibility context is required for assignment."));
  assert.equal(reassign.ok, false);
  assert.ok(reassign.blockers.includes("Provider eligibility context is required for assignment."));
});

test("assignment actions block unknown provider ids even with eligibility context", () => {
  const providers = [provider({ id: "maria" })];
  const assign = applyDispatchAction(job(), {
    type: MANUAL_ACTIONS.assign,
    providerId: "unknown-provider",
    providerName: "Unknown Provider",
    actor,
    reason: "Unknown provider should not be assignable.",
  }, providers);
  const reassign = applyManualAction(job({ status: DISPATCH_JOB_STATES.assigned, providerId: "maria" }), {
    type: MANUAL_ACTIONS.reassign,
    providerId: "unknown-provider",
    actor,
    reason: "Unknown provider should not be assignable.",
    providers,
  });

  assert.equal(assign.ok, false);
  assert.ok(assign.blockers.includes("Provider is not eligible for this job."));
  assert.equal(reassign.ok, false);
  assert.ok(reassign.blockers.includes("Provider is not eligible for this job."));
});

test("manual assignment creates audit metadata and updates state", () => {
  const result = applyManualAction(job(), {
    type: MANUAL_ACTIONS.assign,
    providerId: "maria",
    providerName: "Maria Rodriguez",
    actor,
    reason: "Eligible provider was the fastest SLA-safe candidate.",
    timestamp: "2026-07-01T12:00:00.000Z",
    providers: [provider({ id: "maria" })],
  });

  assertAuditMetadata(result, MANUAL_ACTIONS.assign);
  assert.equal(result.job.status, DISPATCH_JOB_STATES.assigned);
  assert.equal(result.job.providerId, "maria");
  assert.equal(result.audit.oldState, DISPATCH_JOB_STATES.confirmed);
  assert.equal(result.audit.newState, DISPATCH_JOB_STATES.assigned);
  assert.equal(result.audit.oldProviderId, null);
  assert.equal(result.audit.newProviderId, "maria");
  assert.equal(result.audit.reason, "Eligible provider was the fastest SLA-safe candidate.");
});

test("manual actions require actor and reason audit metadata", () => {
  const result = applyManualAction(job(), { type: MANUAL_ACTIONS.escalate, actor, reason: "" });

  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes("Manual action reason is required."));
});

test("every non-assignment manual action produces audit metadata", () => {
  const timestamp = "2026-07-01T12:00:00.000Z";
  const reassign = applyManualAction(job({ status: DISPATCH_JOB_STATES.assigned, providerId: "maria" }), {
    type: MANUAL_ACTIONS.reassign,
    providerId: "david",
    actor,
    reason: "Reassign to protect SLA.",
    timestamp,
    providers: [provider({ id: "david" })],
  });
  const escalate = applyManualAction(job(), { type: MANUAL_ACTIONS.escalate, actor, reason: "Escalate issue.", timestamp });
  const cancelReschedule = applyManualAction(job(), { type: MANUAL_ACTIONS.cancelReschedule, actor, reason: "Policy placeholder.", timestamp });
  const resolveBlocker = applyManualAction(job({ status: DISPATCH_JOB_STATES.blocked, providerId: "maria", blocker: { blockedFromStatus: DISPATCH_JOB_STATES.inProgress } }), {
    type: MANUAL_ACTIONS.resolveBlocker,
    actor,
    reason: "Blocker resolved.",
    timestamp,
  });

  assertAuditMetadata(reassign, MANUAL_ACTIONS.reassign);
  assertAuditMetadata(escalate, MANUAL_ACTIONS.escalate);
  assertAuditMetadata(cancelReschedule, MANUAL_ACTIONS.cancelReschedule);
  assertAuditMetadata(resolveBlocker, MANUAL_ACTIONS.resolveBlocker);
});

test("cannot reassign after en route, arrived, in progress, or completed without override or escalation reason", () => {
  for (const status of [DISPATCH_JOB_STATES.enRoute, DISPATCH_JOB_STATES.arrived, DISPATCH_JOB_STATES.inProgress, DISPATCH_JOB_STATES.completed]) {
    const check = canReassignJob(job({ status, providerId: "maria" }));
    assert.equal(check.ok, false, status);
  }

  const override = canReassignJob(job({ status: DISPATCH_JOB_STATES.inProgress, providerId: "maria" }), {
    escalationReason: "Safety escalation: provider cannot complete service.",
  });

  assert.equal(override.ok, true);
});

test("reassignment action enforces locked-state override rule including arrived", () => {
  const blocked = applyManualAction(job({ status: DISPATCH_JOB_STATES.arrived, providerId: "maria" }), {
    type: MANUAL_ACTIONS.reassign,
    providerId: "david",
    actor,
    reason: "",
  });

  assert.equal(blocked.ok, false);
  assert.ok(blocked.blockers.includes("Reassignment after en route, arrived, in progress, completed, report submitted, closed, or canceled requires explicit override/escalation reason."));

  const allowed = applyManualAction(job({ status: DISPATCH_JOB_STATES.inProgress, providerId: "maria" }), {
    type: MANUAL_ACTIONS.reassign,
    providerId: "david",
    actor,
    reason: "Escalated reassignment because original provider reported a safety issue.",
    providers: [provider({ id: "david" })],
  });

  assert.equal(allowed.ok, true);
  assert.equal(allowed.job.providerId, "david");
});

test("manual assign blocks canceled and completed jobs", () => {
  for (const status of [DISPATCH_JOB_STATES.canceled, DISPATCH_JOB_STATES.completed]) {
    const result = applyManualAction(job({ status }), {
      type: MANUAL_ACTIONS.assign,
      providerId: "maria",
      actor,
      reason: "Unsafe mutation attempt.",
    });

    assert.equal(result.ok, false, status);
    assert.equal(result.job.providerId, null);
  }
});

test("manual assign cannot overwrite an existing provider; reassign changes provider with audit", () => {
  const assignedJob = job({ status: DISPATCH_JOB_STATES.assigned, providerId: "maria", providerName: "Maria Rodriguez" });
  const assign = applyManualAction(assignedJob, {
    type: MANUAL_ACTIONS.assign,
    providerId: "david",
    providerName: "David Kim",
    actor,
    reason: "Attempt to change provider using assign.",
    providers: [provider({ id: "david", name: "David Kim" })],
  });

  assert.equal(assign.ok, false);
  assert.ok(assign.blockers.includes("Assign is only allowed for jobs without a provider. Use reassign to change an assigned provider."));
  assert.equal(assign.job.providerId, "maria");

  const reassign = applyManualAction(assignedJob, {
    type: MANUAL_ACTIONS.reassign,
    providerId: "david",
    providerName: "David Kim",
    actor,
    reason: "Reassign to another eligible provider after dispatcher review.",
    timestamp: "2026-07-01T12:00:00.000Z",
    providers: [provider({ id: "david", name: "David Kim" })],
  });

  assertAuditMetadata(reassign, MANUAL_ACTIONS.reassign);
  assert.equal(reassign.job.providerId, "david");
  assert.equal(reassign.audit.oldProviderId, "maria");
  assert.equal(reassign.audit.newProviderId, "david");
});

test("manual reassign fails for unassigned jobs and directs caller to assign", () => {
  const result = applyManualAction(job({ status: DISPATCH_JOB_STATES.confirmed, providerId: null }), {
    type: MANUAL_ACTIONS.reassign,
    providerId: "maria",
    providerName: "Maria Rodriguez",
    actor,
    reason: "Attempt to use reassign on an unassigned job.",
    providers: [provider({ id: "maria" })],
  });

  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes("Reassign requires an existing provider. Use assign for jobs without a provider."));
  assert.equal(result.job.providerId, null);
});

test("manual reassign rejects no-op same-provider changes", () => {
  const result = applyManualAction(job({ status: DISPATCH_JOB_STATES.assigned, providerId: "maria", providerName: "Maria Rodriguez" }), {
    type: MANUAL_ACTIONS.reassign,
    providerId: "maria",
    providerName: "Maria Rodriguez",
    actor,
    reason: "Attempt to reassign to the currently assigned provider.",
    providers: [provider({ id: "maria" })],
  });

  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes("Reassign requires a different provider; selected provider is already assigned."));
  assert.equal(result.job.providerId, "maria");
});

test("reassign candidate helper hides unavailable UI action unless current provider exists and candidate differs", () => {
  const candidates = [
    { providerId: "maria", provider: provider({ id: "maria" }) },
    { providerId: "david", provider: provider({ id: "david", name: "David Kim" }) },
  ];

  assert.equal(getReassignCandidate(job({ providerId: null }), candidates), null);
  assert.equal(getReassignCandidate(job({ providerId: "maria" }), [candidates[0]]), null);
  assert.equal(getReassignCandidate(job({ providerId: "maria" }), candidates).providerId, "david");
});

test("resolve blocker restores prior active status instead of regressing to assigned", () => {
  const result = applyManualAction(job({
    status: DISPATCH_JOB_STATES.blocked,
    providerId: "maria",
    blocker: { code: "approval", blockedFromStatus: DISPATCH_JOB_STATES.inProgress },
  }), {
    type: MANUAL_ACTIONS.resolveBlocker,
    actor,
    reason: "Customer approved additional diagnostic time.",
  });

  assert.equal(result.ok, true);
  assert.equal(result.job.status, DISPATCH_JOB_STATES.inProgress);
});

test("resolve blocker rejects unsafe return statuses before mutating job state", () => {
  for (const returnStatus of [DISPATCH_JOB_STATES.closed, DISPATCH_JOB_STATES.canceled, "not_a_state"]) {
    const result = applyManualAction(job({
      status: DISPATCH_JOB_STATES.blocked,
      providerId: "maria",
      blocker: { code: "approval", blockedFromStatus: DISPATCH_JOB_STATES.inProgress },
    }), {
      type: MANUAL_ACTIONS.resolveBlocker,
      returnStatus,
      actor,
      reason: "Unsafe return status should fail closed.",
    });

    assert.equal(result.ok, false, returnStatus);
    assert.ok(result.blockers.includes(`Resolve blocker return status is not allowed from returnStatus: ${returnStatus}.`));
    assert.equal(result.job.status, DISPATCH_JOB_STATES.blocked);
    assert.deepEqual(result.job.blocker, { code: "approval", blockedFromStatus: DISPATCH_JOB_STATES.inProgress });
  }
});

test("resolve blocker accepts safe explicit and metadata return statuses", () => {
  const explicitInProgress = applyManualAction(job({
    status: DISPATCH_JOB_STATES.blocked,
    providerId: "maria",
    blocker: { code: "approval", blockedFromStatus: DISPATCH_JOB_STATES.assigned },
  }), {
    type: MANUAL_ACTIONS.resolveBlocker,
    returnStatus: DISPATCH_JOB_STATES.inProgress,
    actor,
    reason: "Return directly to active work after approval.",
  });
  const blockedFromAssigned = applyManualAction(job({
    status: DISPATCH_JOB_STATES.blocked,
    providerId: "maria",
    blocker: { code: "approval", blockedFromStatus: DISPATCH_JOB_STATES.assigned },
  }), {
    type: MANUAL_ACTIONS.resolveBlocker,
    actor,
    reason: "Return to assigned after approval.",
  });

  assert.equal(explicitInProgress.ok, true);
  assert.equal(explicitInProgress.job.status, DISPATCH_JOB_STATES.inProgress);
  assert.equal(blockedFromAssigned.ok, true);
  assert.equal(blockedFromAssigned.job.status, DISPATCH_JOB_STATES.assigned);
});

test("resolve blocker rejects unsafe blocker and audit return metadata", () => {
  const unsafeBlockedFrom = applyManualAction(job({
    status: DISPATCH_JOB_STATES.blocked,
    providerId: "maria",
    blocker: { code: "approval", blockedFromStatus: DISPATCH_JOB_STATES.closed },
  }), {
    type: MANUAL_ACTIONS.resolveBlocker,
    actor,
    reason: "Unsafe blocker metadata should fail closed.",
  });
  const unsafeAuditOldState = applyManualAction(job({
    status: DISPATCH_JOB_STATES.blocked,
    providerId: "maria",
    blocker: { code: "approval" },
    auditTrail: [{ id: "audit-blocked", action: "blocked", oldState: DISPATCH_JOB_STATES.canceled, newState: DISPATCH_JOB_STATES.blocked }],
  }), {
    type: MANUAL_ACTIONS.resolveBlocker,
    actor,
    reason: "Unsafe audit metadata should fail closed.",
  });

  assert.equal(unsafeBlockedFrom.ok, false);
  assert.ok(unsafeBlockedFrom.blockers.includes("Resolve blocker return status is not allowed from blockedFromStatus: closed."));
  assert.equal(unsafeBlockedFrom.job.status, DISPATCH_JOB_STATES.blocked);
  assert.equal(unsafeAuditOldState.ok, false);
  assert.ok(unsafeAuditOldState.blockers.includes("Resolve blocker return status is not allowed from audit oldState: canceled."));
  assert.equal(unsafeAuditOldState.job.status, DISPATCH_JOB_STATES.blocked);
});

test("resolve blocker blocks terminal and non-blocked active jobs", () => {
  for (const status of [DISPATCH_JOB_STATES.completed, DISPATCH_JOB_STATES.canceled, DISPATCH_JOB_STATES.reportSubmitted, DISPATCH_JOB_STATES.closed]) {
    const result = applyManualAction(job({ status, providerId: "maria", blocker: { blockedFromStatus: DISPATCH_JOB_STATES.inProgress } }), {
      type: MANUAL_ACTIONS.resolveBlocker,
      actor,
      reason: "Terminal jobs should not mutate.",
    });

    assert.equal(result.ok, false, status);
    assert.ok(result.blockers.includes("Terminal jobs cannot have blockers resolved."));
    assert.equal(result.job.status, status);
  }

  const assigned = applyManualAction(job({ status: DISPATCH_JOB_STATES.assigned, providerId: "maria", blocker: undefined }), {
    type: MANUAL_ACTIONS.resolveBlocker,
    actor,
    reason: "Non-blocked assigned job should not mutate.",
  });

  assert.equal(assigned.ok, false);
  assert.ok(assigned.blockers.includes("Resolve blocker is only allowed for blocked jobs or jobs with active blocker metadata."));
  assert.equal(assigned.job.status, DISPATCH_JOB_STATES.assigned);
});

test("at-risk, unassigned, and blocked jobs are surfaced by queue derivation", () => {
  const queue = deriveDispatchQueue([
    job({ id: "normal", providerId: "maria", status: DISPATCH_JOB_STATES.assigned, sla: { minutesToBreach: 200 } }),
    job({ id: "unassigned", providerId: null, sla: { minutesToBreach: 90 } }),
    job({ id: "blocked", providerId: "maria", status: DISPATCH_JOB_STATES.blocked, blocker: { summary: "Parts missing" } }),
    job({ id: "risk", providerId: "maria", sla: { minutesToBreach: -5 } }),
  ]);

  assert.equal(queue.summary.total, 4);
  assert.equal(queue.summary.unassigned, 1);
  assert.equal(queue.summary.blocked, 1);
  assert.equal(queue.summary.atRisk, 3);
  assert.deepEqual(queue.exceptionJobs.map((item) => item.id), ["blocked", "risk", "unassigned"]);
});

test("filters and grouping are deterministic across status, risk, market, fulfillment, and provider", () => {
  const jobs = [
    job({ id: "b", status: DISPATCH_JOB_STATES.assigned, providerId: "maria", market: "chicago", fulfillmentId: "mobile", sla: { minutesToBreach: 200 } }),
    job({ id: "a", status: DISPATCH_JOB_STATES.confirmed, providerId: null, market: "chicago", fulfillmentId: "shop", sla: { minutesToBreach: 10 } }),
    job({ id: "c", status: DISPATCH_JOB_STATES.blocked, providerId: "david", market: "detroit", fulfillmentId: "mobile", blocker: { summary: "Blocked" } }),
  ];

  assert.deepEqual(filterDispatchJobs(jobs, { market: "chicago" }).map((item) => item.id), ["a", "b"]);
  assert.deepEqual(filterDispatchJobs(jobs, { fulfillment: "shop" }).map((item) => item.id), ["a"]);
  assert.deepEqual(filterDispatchJobs(jobs, { providerId: "david" }).map((item) => item.id), ["c"]);
  assert.deepEqual(filterDispatchJobs(jobs, { risk: "low" }).map((item) => item.id), ["b"]);
  assert.deepEqual(Object.keys(groupDispatchJobs(jobs, "status")), [DISPATCH_JOB_STATES.blocked, DISPATCH_JOB_STATES.confirmed, DISPATCH_JOB_STATES.assigned]);
  assert.deepEqual(Object.keys(groupDispatchJobs(jobs, "risk")), ["critical", "high", "low"]);
  assert.deepEqual(Object.keys(groupDispatchJobs(jobs, "market")), ["detroit", "chicago"]);
  assert.deepEqual(Object.keys(groupDispatchJobs(jobs, "fulfillmentId")), ["mobile", "shop"]);
  assert.deepEqual(Object.keys(groupDispatchJobs(jobs, "providerId")), ["david", "unknown", "maria"]);
});

test("decorated jobs strip raw customer and vehicle PII while retaining masked summaries", () => {
  const decorated = decorateDispatchJob(job({
    customer: { displayName: "J. D.", phone: "312-555-0100", address: "123 Private St, Chicago, IL", email: "jd@example.test" },
    vehicle: { year: "2022", make: "Toyota", model: "RAV4", vin: "2T3P1RFV1MW123456", plate: "ABC123" },
  }));

  assert.equal(decorated.customer, undefined);
  assert.equal(decorated.vehicle, undefined);
  assert.equal(decorated.maskedCustomer.addressSummary, "Chicago, IL");
  assert.equal(decorated.maskedCustomer.phoneMasked, "Phone hidden");
  assert.equal(decorated.maskedVehicle.vinMasked, "VIN ending 123456");
  assert.equal(decorated.maskedVehicle.plate, undefined);
});

test("filtering and grouping already-decorated jobs preserves masked display data", () => {
  const decorated = decorateDispatchJob(job({
    id: "decorated",
    providerId: "maria",
    status: DISPATCH_JOB_STATES.assigned,
    sla: { minutesToBreach: 200 },
    customer: { displayName: "Masked Customer", phoneMasked: "Phone ending 0100", addressSummary: "Chicago, IL", address: "123 Private St, Chicago, IL" },
    vehicle: { year: "2022", make: "Toyota", model: "RAV4", vinMasked: "VIN ending 123456", vin: "2T3P1RFV1MW123456" },
  }));

  const filtered = filterDispatchJobs([decorated], { providerId: "maria" });
  const grouped = groupDispatchJobs([decorated], "providerId");

  assert.equal(filtered[0].customer, undefined);
  assert.equal(filtered[0].vehicle, undefined);
  assert.equal(filtered[0].maskedCustomer.displayName, "Masked Customer");
  assert.equal(filtered[0].maskedCustomer.phoneMasked, "Phone ending 0100");
  assert.equal(filtered[0].maskedCustomer.addressSummary, "Chicago, IL");
  assert.equal(filtered[0].maskedVehicle.vinMasked, "VIN ending 123456");
  assert.equal(grouped.maria[0].maskedCustomer.displayName, "Masked Customer");
  assert.equal(grouped.maria[0].maskedVehicle.vinMasked, "VIN ending 123456");
});
