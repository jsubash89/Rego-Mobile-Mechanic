const PROVIDER_JOB_STATES = {
  offered: "offered",
  accepted: "accepted",
  confirmed: "confirmed",
  enRoute: "en_route",
  arrived: "arrived",
  inProgress: "in_progress",
  customerApprovalRequired: "customer_approval_required",
  completed: "completed",
  reportSubmitted: "report_submitted",
  closed: "closed",
  declined: "declined",
  canceled: "canceled",
};

const COMPLETION_REPORT_FIELDS = ["notes", "photos", "checklist", "invoice"];

const STATE_ORDER = [
  PROVIDER_JOB_STATES.offered,
  PROVIDER_JOB_STATES.accepted,
  PROVIDER_JOB_STATES.confirmed,
  PROVIDER_JOB_STATES.enRoute,
  PROVIDER_JOB_STATES.arrived,
  PROVIDER_JOB_STATES.inProgress,
  PROVIDER_JOB_STATES.customerApprovalRequired,
  PROVIDER_JOB_STATES.completed,
  PROVIDER_JOB_STATES.reportSubmitted,
  PROVIDER_JOB_STATES.closed,
];

const PROVIDER_JOB_TRANSITIONS = {
  [PROVIDER_JOB_STATES.offered]: [PROVIDER_JOB_STATES.accepted, PROVIDER_JOB_STATES.declined],
  [PROVIDER_JOB_STATES.accepted]: [PROVIDER_JOB_STATES.confirmed, PROVIDER_JOB_STATES.declined],
  [PROVIDER_JOB_STATES.confirmed]: [PROVIDER_JOB_STATES.enRoute, PROVIDER_JOB_STATES.declined],
  [PROVIDER_JOB_STATES.enRoute]: [PROVIDER_JOB_STATES.arrived],
  [PROVIDER_JOB_STATES.arrived]: [PROVIDER_JOB_STATES.inProgress, PROVIDER_JOB_STATES.customerApprovalRequired],
  [PROVIDER_JOB_STATES.inProgress]: [PROVIDER_JOB_STATES.customerApprovalRequired, PROVIDER_JOB_STATES.completed],
  [PROVIDER_JOB_STATES.customerApprovalRequired]: [PROVIDER_JOB_STATES.arrived, PROVIDER_JOB_STATES.inProgress],
  [PROVIDER_JOB_STATES.completed]: [PROVIDER_JOB_STATES.reportSubmitted],
  [PROVIDER_JOB_STATES.reportSubmitted]: [PROVIDER_JOB_STATES.closed],
  [PROVIDER_JOB_STATES.closed]: [],
  [PROVIDER_JOB_STATES.declined]: [],
  [PROVIDER_JOB_STATES.canceled]: [],
};

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function maskVin(vin) {
  if (!hasText(vin)) {
    return "VIN not provided";
  }

  const normalized = String(vin).trim();
  return `VIN ending ${normalized.slice(-6)}`;
}

function maskAddress(address) {
  if (!hasText(address)) {
    return "Address hidden until dispatch";
  }

  const parts = String(address).split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts.at(-2)}, ${parts.at(-1)}`;
  }

  return "Service area available after acceptance";
}

function getFeasibilityBlockers(job = {}) {
  const readiness = job.readiness ?? {};
  const blockers = [];

  if (readiness.partsFitmentReady !== true) {
    blockers.push("Confirm parts and fitment before accepting.");
  }

  if (readiness.toolsReady !== true) {
    blockers.push("Confirm required tools are ready before accepting.");
  }

  if (!hasText(readiness.arrivalWindow)) {
    blockers.push("Set an arrival window before accepting.");
  }

  return blockers;
}

function canAcceptProviderJob(job = {}) {
  const blockers = [];

  if (job.status !== PROVIDER_JOB_STATES.offered) {
    blockers.push("Only offered provider work can be accepted.");
  }

  blockers.push(...getFeasibilityBlockers(job));

  return { ok: blockers.length === 0, blockers };
}

function canDeclineProviderJob(job = {}, reason) {
  const blockers = [];

  if (!getAllowedProviderJobTransitions(job.status).includes(PROVIDER_JOB_STATES.declined)) {
    blockers.push("Only unstarted provider work can be declined.");
  }

  if (!hasText(reason)) {
    blockers.push("Decline reason is required.");
  }

  return { ok: blockers.length === 0, blockers };
}

function hasPendingCustomerApproval(job = {}) {
  const changeRequest = job.changeRequest;
  return changeRequest?.requiresCustomerApproval === true && changeRequest.approvalStatus !== "approved";
}

function getValidCustomerApprovalRequestStatuses() {
  return [PROVIDER_JOB_STATES.arrived, PROVIDER_JOB_STATES.inProgress];
}

function getReportCompletionBlockers(report = {}) {
  const blockers = [];
  const checklist = asArray(report.checklist);

  if (!hasText(report.notes)) {
    blockers.push("Add service notes before completion.");
  }

  if (asArray(report.photos).length === 0) {
    blockers.push("Attach at least one service photo before completion.");
  }

  if (checklist.length === 0 || checklist.some((item) => item.completed !== true)) {
    blockers.push("Complete every report checklist item before completion.");
  }

  if (report.invoice?.placeholderReady !== true && report.invoice?.status !== "ready") {
    blockers.push("Prepare the invoice placeholder before completion.");
  }

  return blockers;
}

function statusComesBefore(status, requiredStatus) {
  const statusIndex = STATE_ORDER.indexOf(status);
  const requiredIndex = STATE_ORDER.indexOf(requiredStatus);
  return statusIndex === -1 || requiredIndex === -1 || statusIndex < requiredIndex;
}

function getAllowedProviderJobTransitions(status) {
  return [...(PROVIDER_JOB_TRANSITIONS[status] ?? [])];
}

function isAllowedProviderJobTransition(currentStatus, nextStatus) {
  return getAllowedProviderJobTransitions(currentStatus).includes(nextStatus);
}

function getProgressBlockers(job = {}, nextStatus) {
  const blockers = [];

  if (!nextStatus) {
    blockers.push("Next provider job status is required.");
    return blockers;
  }

  if (job.status === PROVIDER_JOB_STATES.offered && [PROVIDER_JOB_STATES.accepted, PROVIDER_JOB_STATES.declined].includes(nextStatus)) {
    blockers.push("Provider decisions must use the explicit accept or decline event.");
    return blockers;
  }

  if (!isAllowedProviderJobTransition(job.status, nextStatus)) {
    blockers.push(`Provider job cannot transition from ${job.status ?? "unknown"} to ${nextStatus}.`);
    return blockers;
  }

  if ([PROVIDER_JOB_STATES.accepted, PROVIDER_JOB_STATES.confirmed].includes(nextStatus)) {
    blockers.push(...getFeasibilityBlockers(job));
  }

  if ([PROVIDER_JOB_STATES.enRoute, PROVIDER_JOB_STATES.arrived, PROVIDER_JOB_STATES.inProgress].includes(nextStatus)) {
    if (statusComesBefore(job.status, PROVIDER_JOB_STATES.confirmed)) {
      blockers.push("Provider must accept and confirm readiness before dispatch progress.");
    }
  }

  if (hasPendingCustomerApproval(job) && nextStatus !== PROVIDER_JOB_STATES.customerApprovalRequired) {
    blockers.push("Customer approval is required for scope or price changes before the job can progress.");
  }

  if (nextStatus === PROVIDER_JOB_STATES.customerApprovalRequired) {
    if (!getValidCustomerApprovalRequestStatuses().includes(job.status)) {
      blockers.push("Customer approval can only be requested after arrival or once work is in progress.");
    }

    if (!hasPendingCustomerApproval(job)) {
      blockers.push("A pending scope or price change is required before requesting customer approval.");
    }
  }

  if (job.status === PROVIDER_JOB_STATES.customerApprovalRequired && [PROVIDER_JOB_STATES.arrived, PROVIDER_JOB_STATES.inProgress].includes(nextStatus)) {
    const approvalReturnStatus = job.approvalReturnStatus;
    if (!getValidCustomerApprovalRequestStatuses().includes(approvalReturnStatus)) {
      blockers.push("Customer approval must return to the valid requesting state.");
    } else if (nextStatus !== approvalReturnStatus) {
      blockers.push(`Customer approval must return to ${approvalReturnStatus}.`);
    }
  }

  if (nextStatus === PROVIDER_JOB_STATES.completed) {
    if (job.status !== PROVIDER_JOB_STATES.inProgress) {
      blockers.push("Provider cannot complete before the job has started.");
    }

    blockers.push(...getReportCompletionBlockers(job.report));
  }

  return blockers;
}

function canProgressProviderJob(job = {}, nextStatus) {
  const blockers = getProgressBlockers(job, nextStatus);
  return { ok: blockers.length === 0, blockers };
}

function getCompletionReadiness(job = {}) {
  const blockers = getProgressBlockers(job, PROVIDER_JOB_STATES.completed);
  return {
    ready: blockers.length === 0,
    requiredFields: COMPLETION_REPORT_FIELDS,
    blockers,
  };
}

function transitionProviderJob(job = {}, event = {}) {
  const type = typeof event === "string" ? event : event.type;

  if (type === "accept") {
    const result = canAcceptProviderJob(job);
    if (!result.ok) {
      return { ok: false, job: { ...job }, blockers: result.blockers };
    }

    return { ok: true, blockers: [], job: { ...job, status: PROVIDER_JOB_STATES.accepted, decision: "accepted" } };
  }

  if (type === "decline") {
    const reason = typeof event === "string" ? undefined : event.reason;
    const result = canDeclineProviderJob(job, reason);
    if (!result.ok) {
      return { ok: false, job: { ...job }, blockers: result.blockers };
    }

    return {
      ok: true,
      blockers: [],
      job: { ...job, status: PROVIDER_JOB_STATES.declined, decision: "declined", declineReason: String(reason).trim() },
    };
  }

  if (type === "progress") {
    const nextStatus = event.nextStatus;
    const result = canProgressProviderJob(job, nextStatus);
    if (!result.ok) {
      return { ok: false, job: { ...job }, blockers: result.blockers };
    }

    if (nextStatus === PROVIDER_JOB_STATES.customerApprovalRequired) {
      return { ok: true, blockers: [], job: { ...job, status: nextStatus, approvalReturnStatus: job.status } };
    }

    if (job.status === PROVIDER_JOB_STATES.customerApprovalRequired) {
      return { ok: true, blockers: [], job: { ...job, status: nextStatus, approvalReturnStatus: undefined } };
    }

    return { ok: true, blockers: [], job: { ...job, status: nextStatus } };
  }

  return { ok: false, job: { ...job }, blockers: ["Unsupported provider job event."] };
}

module.exports = {
  COMPLETION_REPORT_FIELDS,
  PROVIDER_JOB_STATES,
  canAcceptProviderJob,
  canDeclineProviderJob,
  canProgressProviderJob,
  getCompletionReadiness,
  getFeasibilityBlockers,
  getAllowedProviderJobTransitions,
  getReportCompletionBlockers,
  getValidCustomerApprovalRequestStatuses,
  hasPendingCustomerApproval,
  maskAddress,
  maskVin,
  transitionProviderJob,
};
