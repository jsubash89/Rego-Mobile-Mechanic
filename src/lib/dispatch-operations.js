const { getProviderMatchingResults } = require("./provider-matching.js");

const DISPATCH_JOB_STATES = {
  offered: "offered",
  confirmed: "confirmed",
  assigned: "assigned",
  enRoute: "en_route",
  arrived: "arrived",
  inProgress: "in_progress",
  blocked: "blocked",
  completed: "completed",
  reportSubmitted: "report_submitted",
  closed: "closed",
  canceled: "canceled",
};

const MANUAL_ACTIONS = {
  assign: "assign",
  reassign: "reassign",
  escalate: "escalate",
  cancelReschedule: "cancel_reschedule_placeholder",
  resolveBlocker: "resolve_blocker_placeholder",
};

const REASSIGN_LOCKED_STATES = [
  DISPATCH_JOB_STATES.enRoute,
  DISPATCH_JOB_STATES.arrived,
  DISPATCH_JOB_STATES.inProgress,
  DISPATCH_JOB_STATES.completed,
  DISPATCH_JOB_STATES.reportSubmitted,
  DISPATCH_JOB_STATES.closed,
  DISPATCH_JOB_STATES.canceled,
];

const ASSIGNABLE_STATES = [
  DISPATCH_JOB_STATES.offered,
  DISPATCH_JOB_STATES.confirmed,
];

const SAFE_BLOCKER_RETURN_STATES = [
  DISPATCH_JOB_STATES.offered,
  DISPATCH_JOB_STATES.confirmed,
  DISPATCH_JOB_STATES.assigned,
  DISPATCH_JOB_STATES.enRoute,
  DISPATCH_JOB_STATES.arrived,
  DISPATCH_JOB_STATES.inProgress,
];

const TERMINAL_ASSIGNMENT_STATES = [
  DISPATCH_JOB_STATES.closed,
  DISPATCH_JOB_STATES.canceled,
];

const STATUS_ORDER = [
  DISPATCH_JOB_STATES.blocked,
  DISPATCH_JOB_STATES.confirmed,
  DISPATCH_JOB_STATES.assigned,
  DISPATCH_JOB_STATES.enRoute,
  DISPATCH_JOB_STATES.arrived,
  DISPATCH_JOB_STATES.inProgress,
  DISPATCH_JOB_STATES.completed,
  DISPATCH_JOB_STATES.reportSubmitted,
  DISPATCH_JOB_STATES.closed,
  DISPATCH_JOB_STATES.canceled,
];

const RISK_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeFulfillmentId(value) {
  return String(value ?? "").toLowerCase();
}

function statusRank(status) {
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? STATUS_ORDER.length : index;
}

function maskVin(vin) {
  if (!hasText(vin)) return "VIN hidden";
  return `VIN ending ${String(vin).trim().slice(-6)}`;
}

function maskAddress(address) {
  if (!hasText(address)) return "Address hidden";
  const parts = String(address).split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return `${parts.at(-2)}, ${parts.at(-1)}`;
  return "Service area only";
}

function getPlatformFee(job = {}) {
  if (Number.isFinite(job.margin?.platformFee)) return job.margin.platformFee;
  if (Number.isFinite(job.estimate?.platformFee)) return job.estimate.platformFee;
  const customerTotal = job.margin?.customerTotal ?? job.estimate?.customerTotal;
  const providerPayout = job.margin?.providerPayout ?? job.estimate?.providerEarnings;
  if (Number.isFinite(customerTotal) && Number.isFinite(providerPayout)) return customerTotal - providerPayout;
  return null;
}

function getSlaRisk(job = {}) {
  if (job.status === DISPATCH_JOB_STATES.blocked) {
    return { level: "critical", reasons: [job.blocker?.summary ?? "Job is blocked and needs dispatcher action."] };
  }

  const reasons = [];
  const minutesToSla = Number.isFinite(job.sla?.minutesToBreach) ? job.sla.minutesToBreach : null;
  if (!job.providerId) reasons.push("No provider assigned.");
  if (job.escalated === true) reasons.push("Already escalated for operations follow-up.");

  if (minutesToSla != null) {
    if (minutesToSla <= 0) reasons.push(`SLA breached ${Math.abs(minutesToSla)} minutes ago.`);
    else if (minutesToSla <= 30) reasons.push(`SLA breach risk in ${minutesToSla} minutes.`);
    else if (minutesToSla <= 90) reasons.push(`SLA watch: ${minutesToSla} minutes remaining.`);
  }

  if (job.status === DISPATCH_JOB_STATES.completed || job.status === DISPATCH_JOB_STATES.canceled) {
    return { level: "low", reasons: reasons.length ? reasons : ["No active SLA risk."] };
  }

  if (job.providerId == null) return { level: "high", reasons };
  if (minutesToSla != null && minutesToSla <= 0) return { level: "critical", reasons };
  if (minutesToSla != null && minutesToSla <= 30) return { level: "high", reasons };
  if (minutesToSla != null && minutesToSla <= 90) return { level: "medium", reasons };
  return { level: "low", reasons: reasons.length ? reasons : ["On track against current SLA."] };
}

function decorateDispatchJob(job = {}) {
  const {
    customer: rawCustomer,
    vehicle: rawVehicle,
    maskedCustomer: existingMaskedCustomer,
    maskedVehicle: existingMaskedVehicle,
    ...safeJob
  } = job;
  const risk = getSlaRisk(job);
  return {
    ...safeJob,
    serviceId: job.serviceId,
    fulfillmentId: normalizeFulfillmentId(job.fulfillmentId ?? job.fulfillment),
    risk,
    isUnassigned: !job.providerId,
    isBlocked: job.status === DISPATCH_JOB_STATES.blocked || Boolean(job.blocker),
    isAtRisk: ["critical", "high"].includes(risk.level),
    maskedCustomer: {
      displayName: rawCustomer?.displayName ?? existingMaskedCustomer?.displayName ?? "Customer",
      phoneMasked: rawCustomer?.phoneMasked ?? existingMaskedCustomer?.phoneMasked ?? "Phone hidden",
      addressSummary: rawCustomer?.addressSummary ?? existingMaskedCustomer?.addressSummary ?? maskAddress(rawCustomer?.address),
    },
    maskedVehicle: {
      year: rawVehicle?.year ?? existingMaskedVehicle?.year,
      make: rawVehicle?.make ?? existingMaskedVehicle?.make,
      model: rawVehicle?.model ?? existingMaskedVehicle?.model,
      vinMasked: rawVehicle?.vinMasked ?? existingMaskedVehicle?.vinMasked ?? maskVin(rawVehicle?.vin),
      mileage: rawVehicle?.mileage ?? existingMaskedVehicle?.mileage,
    },
    margin: {
      customerTotal: job.margin?.customerTotal ?? job.estimate?.customerTotal ?? null,
      providerPayout: job.margin?.providerPayout ?? job.estimate?.providerEarnings ?? null,
      platformFee: getPlatformFee(job),
    },
  };
}

function sortDispatchJobs(jobs) {
  return [...jobs].sort((a, b) => {
    const riskDelta = (RISK_ORDER[a.risk?.level] ?? 99) - (RISK_ORDER[b.risk?.level] ?? 99);
    if (riskDelta !== 0) return riskDelta;
    const statusDelta = statusRank(a.status) - statusRank(b.status);
    if (statusDelta !== 0) return statusDelta;
    const aMinutes = a.sla?.minutesToBreach ?? Number.POSITIVE_INFINITY;
    const bMinutes = b.sla?.minutesToBreach ?? Number.POSITIVE_INFINITY;
    if (aMinutes !== bMinutes) return aMinutes - bMinutes;
    return String(a.id).localeCompare(String(b.id));
  });
}

function deriveDispatchQueue(jobs = []) {
  const decorated = sortDispatchJobs(asArray(jobs).map(decorateDispatchJob));
  return {
    jobs: decorated,
    exceptionJobs: decorated.filter((job) => job.isUnassigned || job.isBlocked || job.isAtRisk),
    summary: {
      total: decorated.length,
      unassigned: decorated.filter((job) => job.isUnassigned).length,
      blocked: decorated.filter((job) => job.isBlocked).length,
      atRisk: decorated.filter((job) => job.isAtRisk).length,
      critical: decorated.filter((job) => job.risk.level === "critical").length,
    },
  };
}

function filterDispatchJobs(jobs = [], filters = {}) {
  return sortDispatchJobs(asArray(jobs).map(decorateDispatchJob).filter((job) => {
    if (filters.status && job.status !== filters.status) return false;
    if (filters.risk && job.risk.level !== filters.risk) return false;
    if (filters.market && job.market !== filters.market) return false;
    if (filters.fulfillment && job.fulfillmentId !== normalizeFulfillmentId(filters.fulfillment)) return false;
    if (filters.providerId && job.providerId !== filters.providerId) return false;
    return true;
  }));
}

function groupDispatchJobs(jobs = [], key = "status") {
  return filterDispatchJobs(jobs).reduce((groups, job) => {
    const groupKey = key === "risk" ? job.risk.level : job[key] ?? "unknown";
    return { ...groups, [groupKey]: [...(groups[groupKey] ?? []), job] };
  }, {});
}

function buildMatchingRequest(job = {}) {
  return {
    service: { id: job.serviceId, name: job.serviceName ?? job.service, requiresPartsFitment: job.requiresPartsFitment, providerConfirmationRequired: job.providerConfirmationRequired },
    fulfillment: { id: normalizeFulfillmentId(job.fulfillmentId ?? job.fulfillment) },
    market: job.market,
    providerDistances: job.providerDistances,
    providerCoverage: job.providerCoverage,
  };
}

function sortProviderLikeMatches(matches) {
  return [...matches].sort((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    return String(a.providerId).localeCompare(String(b.providerId));
  });
}

function getAssignmentCandidates(job = {}, providers = []) {
  const request = buildMatchingRequest(job);
  const results = getProviderMatchingResults(providers, request);
  const marketChecked = [
    ...results.matches.map((match) => ({ ...match })),
    ...results.ineligible.map((match) => ({ ...match })),
  ].map((match) => {
    const providerMarket = match.provider?.serviceArea?.market;
    if (hasText(request.market) && hasText(providerMarket) && providerMarket !== request.market) {
      return {
        ...match,
        eligible: false,
        exclusions: [...asArray(match.exclusions), `Provider market ${providerMarket} does not cover job market ${request.market}`],
      };
    }
    return match;
  });

  return {
    matches: sortProviderLikeMatches(marketChecked.filter((match) => match.eligible)),
    ineligible: marketChecked.filter((match) => !match.eligible),
  };
}

function canAssignProvider(job = {}, providerId, providers = []) {
  const candidates = getAssignmentCandidates(job, providers);
  const match = candidates.matches.find((candidate) => candidate.providerId === providerId);
  if (match) return { ok: true, blockers: [], match };
  const ineligible = candidates.ineligible.find((candidate) => candidate.providerId === providerId);
  return {
    ok: false,
    blockers: ineligible?.exclusions?.length ? ineligible.exclusions : ["Provider is not eligible for this job."],
    match: null,
  };
}

function canReassignJob(job = {}, options = {}) {
  const blockers = [];
  const hasOverride = options.override === true || hasText(options.escalationReason);
  if (!hasText(job.providerId)) {
    blockers.push("Reassign requires an existing provider. Use assign for jobs without a provider.");
    return { ok: false, blockers };
  }
  if (hasText(options.providerId) && String(options.providerId).trim() === String(job.providerId).trim()) {
    blockers.push("Reassign requires a different provider; selected provider is already assigned.");
    return { ok: false, blockers };
  }
  if (TERMINAL_ASSIGNMENT_STATES.includes(job.status)) {
    blockers.push("Closed or canceled jobs cannot be reassigned.");
    return { ok: false, blockers };
  }
  if (REASSIGN_LOCKED_STATES.includes(job.status) && !hasOverride) {
    blockers.push("Reassignment after en route, arrived, in progress, completed, report submitted, closed, or canceled requires explicit override/escalation reason.");
  }
  return { ok: blockers.length === 0, blockers };
}

function canAssignJob(job = {}) {
  if (job.providerId != null) {
    return { ok: false, blockers: ["Assign is only allowed for jobs without a provider. Use reassign to change an assigned provider."] };
  }
  if (!ASSIGNABLE_STATES.includes(job.status)) {
    return { ok: false, blockers: [`Assignment is only allowed for offered or confirmed jobs without a provider. Current status: ${job.status ?? "unknown"}.`] };
  }
  return { ok: true, blockers: [] };
}

function getReassignCandidate(job = {}, candidates = []) {
  if (!hasText(job.providerId)) return null;
  return asArray(candidates).find((match) => hasText(match?.providerId) && String(match.providerId).trim() !== String(job.providerId).trim()) ?? null;
}

function getBlockerReturnStatus(job = {}, action = {}) {
  const blockedAuditEntry = asArray(job.auditTrail).find((entry) => entry.newState === DISPATCH_JOB_STATES.blocked);
  const candidates = [
    { label: "returnStatus", status: action.returnStatus },
    { label: "blocker returnStatus", status: job.blocker?.returnStatus },
    { label: "blockedFromStatus", status: job.blocker?.blockedFromStatus },
    { label: "audit oldState", status: blockedAuditEntry?.oldState },
  ];
  const invalidCandidate = candidates.find(({ status }) => status != null && !SAFE_BLOCKER_RETURN_STATES.includes(status));
  if (invalidCandidate) {
    return {
      ok: false,
      blockers: [`Resolve blocker return status is not allowed from ${invalidCandidate.label}: ${invalidCandidate.status}.`],
    };
  }

  const candidate = candidates.find(({ status }) => status != null);
  if (!candidate) {
    return { ok: true, status: job.providerId ? DISPATCH_JOB_STATES.assigned : DISPATCH_JOB_STATES.confirmed };
  }
  return { ok: true, status: candidate.status };
}

function validateAssignmentAction(job = {}, action = {}, providers = []) {
  if (!hasText(action.providerId)) return { ok: false, blockers: ["Provider id is required for assignment."] };

  const stateCheck = action.type === MANUAL_ACTIONS.reassign
    ? canReassignJob(job, { providerId: action.providerId, override: action.override, escalationReason: action.reason })
    : canAssignJob(job);
  if (!stateCheck.ok) return stateCheck;

  if (!Array.isArray(providers) || providers.length === 0) {
    return { ok: false, blockers: ["Provider eligibility context is required for assignment."] };
  }

  const eligibility = canAssignProvider(job, action.providerId, providers);
  if (!eligibility.ok) return { ok: false, blockers: eligibility.blockers };

  return { ok: true, blockers: [] };
}

function validateResolveBlockerAction(job = {}) {
  if ([DISPATCH_JOB_STATES.completed, DISPATCH_JOB_STATES.reportSubmitted, DISPATCH_JOB_STATES.closed, DISPATCH_JOB_STATES.canceled].includes(job.status)) {
    return { ok: false, blockers: ["Terminal jobs cannot have blockers resolved."] };
  }
  if (job.status !== DISPATCH_JOB_STATES.blocked && !job.blocker) {
    return { ok: false, blockers: ["Resolve blocker is only allowed for blocked jobs or jobs with active blocker metadata."] };
  }
  return { ok: true, blockers: [] };
}

function createAuditEntry({ job, action, actor, reason, oldState, newState, oldProviderId, newProviderId, timestamp }) {
  const blockers = [];
  if (!actor?.id || !actor?.type) blockers.push("Audit actor id and type are required.");
  if (!hasText(reason)) blockers.push("Manual action reason is required.");
  if (!hasText(action)) blockers.push("Manual action type is required.");
  if (blockers.length > 0) return { ok: false, blockers };

  return {
    ok: true,
    audit: {
      id: `${job?.id ?? "job"}-${action}-${String(timestamp ?? new Date().toISOString()).replace(/[^0-9A-Za-z]/g, "")}-${Math.random().toString(36).slice(2, 10)}`,
      actorType: actor.type,
      actorId: actor.id,
      actorName: actor.name,
      action,
      reason: String(reason).trim(),
      oldState,
      newState,
      oldProviderId: oldProviderId ?? null,
      newProviderId: newProviderId ?? null,
      createdAt: timestamp ?? new Date().toISOString(),
    },
  };
}

function applyManualAction(job = {}, action = {}) {
  const actor = action.actor;
  const reason = action.reason;
  const type = action.type;
  let nextJob = { ...job, auditTrail: [...asArray(job.auditTrail)] };
  const oldState = job.status;
  const oldProviderId = job.providerId ?? null;

  if ([MANUAL_ACTIONS.assign, MANUAL_ACTIONS.reassign].includes(type)) {
    const assignmentCheck = validateAssignmentAction(job, action, action.providers);
    if (!assignmentCheck.ok) return { ok: false, job: nextJob, blockers: assignmentCheck.blockers };
    nextJob = { ...nextJob, providerId: action.providerId, providerName: action.providerName, status: DISPATCH_JOB_STATES.assigned };
  } else if (type === MANUAL_ACTIONS.escalate) {
    nextJob = { ...nextJob, escalated: true, escalationReason: reason };
  } else if (type === MANUAL_ACTIONS.cancelReschedule) {
    nextJob = { ...nextJob, nextAction: "cancel_or_reschedule_pending_policy" };
  } else if (type === MANUAL_ACTIONS.resolveBlocker) {
    const resolveCheck = validateResolveBlockerAction(job);
    if (!resolveCheck.ok) return { ok: false, job: nextJob, blockers: resolveCheck.blockers };
    const returnStatusCheck = getBlockerReturnStatus(job, action);
    if (!returnStatusCheck.ok) return { ok: false, job: nextJob, blockers: returnStatusCheck.blockers };
    nextJob = { ...nextJob, blocker: null, blockerResolution: reason, status: returnStatusCheck.status };
  } else {
    return { ok: false, job: nextJob, blockers: ["Unsupported dispatch action."] };
  }

  const auditResult = createAuditEntry({
    job,
    action: type,
    actor,
    reason,
    oldState,
    newState: nextJob.status,
    oldProviderId,
    newProviderId: nextJob.providerId ?? null,
    timestamp: action.timestamp,
  });
  if (!auditResult.ok) return { ok: false, job: { ...job }, blockers: auditResult.blockers };

  nextJob.auditTrail = [auditResult.audit, ...nextJob.auditTrail];
  return { ok: true, job: nextJob, audit: auditResult.audit, blockers: [] };
}

function applyDispatchAction(job = {}, action = {}, providers = []) {
  return applyManualAction(job, { ...action, providers });
}

module.exports = {
  DISPATCH_JOB_STATES,
  MANUAL_ACTIONS,
  REASSIGN_LOCKED_STATES,
  applyManualAction,
  applyDispatchAction,
  canAssignJob,
  canAssignProvider,
  canReassignJob,
  createAuditEntry,
  decorateDispatchJob,
  deriveDispatchQueue,
  filterDispatchJobs,
  getAssignmentCandidates,
  getReassignCandidate,
  getSlaRisk,
  groupDispatchJobs,
  maskAddress,
  maskVin,
};
