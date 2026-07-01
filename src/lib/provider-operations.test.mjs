import assert from "node:assert/strict";
import test from "node:test";

import providerOperations from "./provider-operations.js";

const {
  PROVIDER_JOB_STATES,
  canAcceptProviderJob,
  canDeclineProviderJob,
  canProgressProviderJob,
  getAllowedProviderJobTransitions,
  getCompletionReadiness,
  getFeasibilityBlockers,
  getReportCompletionBlockers,
  maskAddress,
  maskVin,
  transitionProviderJob,
} = providerOperations;

function baseJob(overrides = {}) {
  return {
    id: "job-test",
    status: PROVIDER_JOB_STATES.offered,
    readiness: {
      partsFitmentReady: true,
      toolsReady: true,
      arrivalWindow: "Today 2:30–4:00 PM",
    },
    report: {
      notes: "Service completed and verified.",
      photos: ["photo-1.jpg"],
      checklist: [{ id: "done", label: "Done", completed: true }],
      invoice: { placeholderReady: true },
    },
    ...overrides,
  };
}

test("provider can accept only offered work after feasibility and arrival readiness", () => {
  assert.deepEqual(getFeasibilityBlockers(baseJob()), []);
  assert.equal(canAcceptProviderJob(baseJob()).ok, true);

  const missingReadiness = baseJob({ readiness: { partsFitmentReady: true, toolsReady: false, arrivalWindow: "" } });
  const result = canAcceptProviderJob(missingReadiness);
  assert.equal(result.ok, false);
  assert.match(result.blockers.join(" "), /tools/);
  assert.match(result.blockers.join(" "), /arrival window/);

  const transition = transitionProviderJob(baseJob(), { type: "accept" });
  assert.equal(transition.ok, true);
  assert.equal(transition.job.status, PROVIDER_JOB_STATES.accepted);
});

test("progress events cannot bypass provider accept or decline decision rules", () => {
  const acceptedByProgress = transitionProviderJob(baseJob(), {
    type: "progress",
    nextStatus: PROVIDER_JOB_STATES.accepted,
  });
  assert.equal(acceptedByProgress.ok, false);
  assert.equal(acceptedByProgress.job.status, PROVIDER_JOB_STATES.offered);
  assert.match(acceptedByProgress.blockers.join(" "), /explicit accept or decline event/);

  const declinedByProgress = transitionProviderJob(baseJob(), {
    type: "progress",
    nextStatus: PROVIDER_JOB_STATES.declined,
  });
  assert.equal(declinedByProgress.ok, false);
  assert.equal(declinedByProgress.job.status, PROVIDER_JOB_STATES.offered);
  assert.match(declinedByProgress.blockers.join(" "), /explicit accept or decline event/);

  const declinedWithoutReason = transitionProviderJob(baseJob(), { type: "decline" });
  assert.equal(declinedWithoutReason.ok, false);
  assert.match(declinedWithoutReason.blockers.join(" "), /Decline reason is required/);
});

test("confirmed provider work cannot re-run accept or regress to accepted", () => {
  const confirmed = baseJob({ status: PROVIDER_JOB_STATES.confirmed });

  const acceptedAgain = transitionProviderJob(confirmed, { type: "accept" });
  assert.equal(acceptedAgain.ok, false);
  assert.equal(acceptedAgain.job.status, PROVIDER_JOB_STATES.confirmed);
  assert.match(acceptedAgain.blockers.join(" "), /Only offered provider work can be accepted/);

  const regressed = transitionProviderJob(confirmed, { type: "progress", nextStatus: PROVIDER_JOB_STATES.accepted });
  assert.equal(regressed.ok, false);
  assert.equal(regressed.job.status, PROVIDER_JOB_STATES.confirmed);
  assert.match(regressed.blockers.join(" "), /cannot transition from confirmed to accepted/);
});

test("terminal provider work cannot regress to active states", () => {
  for (const status of [PROVIDER_JOB_STATES.completed, PROVIDER_JOB_STATES.reportSubmitted, PROVIDER_JOB_STATES.closed, PROVIDER_JOB_STATES.declined]) {
    for (const nextStatus of [PROVIDER_JOB_STATES.accepted, PROVIDER_JOB_STATES.confirmed, PROVIDER_JOB_STATES.enRoute, PROVIDER_JOB_STATES.arrived, PROVIDER_JOB_STATES.inProgress]) {
      const result = transitionProviderJob(baseJob({ status }), { type: "progress", nextStatus });
      assert.equal(result.ok, false, `${status} should not transition to ${nextStatus}`);
      assert.equal(result.job.status, status);
    }
  }
});

test("only explicit provider state-machine transitions pass", () => {
  assert.deepEqual(getAllowedProviderJobTransitions(PROVIDER_JOB_STATES.offered), [PROVIDER_JOB_STATES.accepted, PROVIDER_JOB_STATES.declined]);

  const allowed = transitionProviderJob(baseJob({ status: PROVIDER_JOB_STATES.accepted }), {
    type: "progress",
    nextStatus: PROVIDER_JOB_STATES.confirmed,
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.job.status, PROVIDER_JOB_STATES.confirmed);

  const skipped = transitionProviderJob(baseJob({ status: PROVIDER_JOB_STATES.accepted }), {
    type: "progress",
    nextStatus: PROVIDER_JOB_STATES.inProgress,
  });
  assert.equal(skipped.ok, false);
  assert.match(skipped.blockers.join(" "), /cannot transition from accepted to in_progress/);
});

test("provider can decline unstarted work with a required reason", () => {
  assert.equal(canDeclineProviderJob(baseJob(), "No bay capacity").ok, true);
  assert.equal(canDeclineProviderJob(baseJob(), "").ok, false);

  const declined = transitionProviderJob(baseJob(), { type: "decline", reason: "Parts unavailable" });
  assert.equal(declined.ok, true);
  assert.equal(declined.job.status, PROVIDER_JOB_STATES.declined);
  assert.equal(declined.job.declineReason, "Parts unavailable");
});

test("provider cannot complete before job has started", () => {
  const confirmed = baseJob({ status: PROVIDER_JOB_STATES.confirmed });
  const completion = canProgressProviderJob(confirmed, PROVIDER_JOB_STATES.completed);

  assert.equal(completion.ok, false);
  assert.match(completion.blockers.join(" "), /cannot transition from confirmed to completed/i);
});

test("scope or price changes require customer approval before progress or completion", () => {
  const job = baseJob({
    status: PROVIDER_JOB_STATES.inProgress,
    changeRequest: { requiresCustomerApproval: true, approvalStatus: "pending", priceDelta: 95 },
  });

  const blocked = canProgressProviderJob(job, PROVIDER_JOB_STATES.completed);
  assert.equal(blocked.ok, false);
  assert.match(blocked.blockers.join(" "), /Customer approval is required/);

  const requestApproval = transitionProviderJob(job, {
    type: "progress",
    nextStatus: PROVIDER_JOB_STATES.customerApprovalRequired,
  });
  assert.equal(requestApproval.ok, true);
  assert.equal(requestApproval.job.status, PROVIDER_JOB_STATES.customerApprovalRequired);

  const stillPending = canProgressProviderJob(requestApproval.job, PROVIDER_JOB_STATES.inProgress);
  assert.equal(stillPending.ok, false);
  assert.match(stillPending.blockers.join(" "), /Customer approval is required/);

  const approved = canProgressProviderJob(
    { ...job, changeRequest: { ...job.changeRequest, approvalStatus: "approved" } },
    PROVIDER_JOB_STATES.completed,
  );
  assert.equal(approved.ok, true);
});

test("customer approval can only be requested from arrived or in progress and returns there", () => {
  const pendingChange = {
    requiresCustomerApproval: true,
    approvalStatus: "pending",
    priceDelta: 95,
  };

  const confirmedRequest = transitionProviderJob(
    baseJob({ status: PROVIDER_JOB_STATES.confirmed, changeRequest: pendingChange }),
    { type: "progress", nextStatus: PROVIDER_JOB_STATES.customerApprovalRequired },
  );
  assert.equal(confirmedRequest.ok, false);
  assert.equal(confirmedRequest.job.status, PROVIDER_JOB_STATES.confirmed);
  assert.match(confirmedRequest.blockers.join(" "), /cannot transition from confirmed to customer_approval_required|only be requested after arrival/);

  const arrivedRequest = transitionProviderJob(
    baseJob({ status: PROVIDER_JOB_STATES.arrived, changeRequest: pendingChange }),
    { type: "progress", nextStatus: PROVIDER_JOB_STATES.customerApprovalRequired },
  );
  assert.equal(arrivedRequest.ok, true);
  assert.equal(arrivedRequest.job.status, PROVIDER_JOB_STATES.customerApprovalRequired);
  assert.equal(arrivedRequest.job.approvalReturnStatus, PROVIDER_JOB_STATES.arrived);

  const cannotJumpToInProgress = transitionProviderJob(
    {
      ...arrivedRequest.job,
      changeRequest: { ...pendingChange, approvalStatus: "approved" },
    },
    { type: "progress", nextStatus: PROVIDER_JOB_STATES.inProgress },
  );
  assert.equal(cannotJumpToInProgress.ok, false);
  assert.match(cannotJumpToInProgress.blockers.join(" "), /must return to arrived/);

  const returnedToArrived = transitionProviderJob(
    {
      ...arrivedRequest.job,
      changeRequest: { ...pendingChange, approvalStatus: "approved" },
    },
    { type: "progress", nextStatus: PROVIDER_JOB_STATES.arrived },
  );
  assert.equal(returnedToArrived.ok, true);
  assert.equal(returnedToArrived.job.status, PROVIDER_JOB_STATES.arrived);
  assert.equal(returnedToArrived.job.approvalReturnStatus, undefined);

  const inProgressRequest = transitionProviderJob(
    baseJob({ status: PROVIDER_JOB_STATES.inProgress, changeRequest: pendingChange }),
    { type: "progress", nextStatus: PROVIDER_JOB_STATES.customerApprovalRequired },
  );
  assert.equal(inProgressRequest.ok, true);
  assert.equal(inProgressRequest.job.status, PROVIDER_JOB_STATES.customerApprovalRequired);
  assert.equal(inProgressRequest.job.approvalReturnStatus, PROVIDER_JOB_STATES.inProgress);

  const returnedToInProgress = transitionProviderJob(
    {
      ...inProgressRequest.job,
      changeRequest: { ...pendingChange, approvalStatus: "approved" },
    },
    { type: "progress", nextStatus: PROVIDER_JOB_STATES.inProgress },
  );
  assert.equal(returnedToInProgress.ok, true);
  assert.equal(returnedToInProgress.job.status, PROVIDER_JOB_STATES.inProgress);
  assert.equal(returnedToInProgress.job.approvalReturnStatus, undefined);

  const forgedConfirmedApproval = transitionProviderJob(
    baseJob({
      status: PROVIDER_JOB_STATES.customerApprovalRequired,
      approvalReturnStatus: PROVIDER_JOB_STATES.confirmed,
      changeRequest: { ...pendingChange, approvalStatus: "approved" },
    }),
    { type: "progress", nextStatus: PROVIDER_JOB_STATES.inProgress },
  );
  assert.equal(forgedConfirmedApproval.ok, false);
  assert.match(forgedConfirmedApproval.blockers.join(" "), /valid requesting state/);
});

test("required report fields gate completion", () => {
  const missingReport = baseJob({
    status: PROVIDER_JOB_STATES.inProgress,
    report: {
      notes: "",
      photos: [],
      checklist: [{ id: "leak-check", label: "Leak check", completed: false }],
      invoice: { placeholderReady: false },
    },
  });

  const blockers = getReportCompletionBlockers(missingReport.report);
  assert.equal(blockers.length, 4);

  const readiness = getCompletionReadiness(missingReport);
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.requiredFields, ["notes", "photos", "checklist", "invoice"]);

  const completed = transitionProviderJob(baseJob({ status: PROVIDER_JOB_STATES.inProgress }), {
    type: "progress",
    nextStatus: PROVIDER_JOB_STATES.completed,
  });
  assert.equal(completed.ok, true);
  assert.equal(completed.job.status, PROVIDER_JOB_STATES.completed);
});

test("privacy helpers mask sensitive VIN and address details", () => {
  assert.equal(maskVin("2T3P1RFV1MW123456"), "VIN ending 123456");
  assert.equal(maskAddress("220 W Kinzie St, Chicago, IL"), "Chicago, IL");
  assert.equal(maskAddress(""), "Address hidden until dispatch");
});
