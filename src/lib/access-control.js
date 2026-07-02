const ROLES = Object.freeze({
  customer: "customer",
  provider: "provider",
  dispatcher: "dispatcher",
  admin: "admin",
  support: "support",
  system: "system",
});

const ROLE_LABELS = Object.freeze({
  [ROLES.customer]: "Customer",
  [ROLES.provider]: "Provider",
  [ROLES.dispatcher]: "Dispatcher",
  [ROLES.admin]: "Admin",
  [ROLES.support]: "Support",
  [ROLES.system]: "System",
});

const FEATURE_FLAGS = Object.freeze({
  payments: "NEXT_PUBLIC_ENABLE_PAYMENTS",
  messaging: "NEXT_PUBLIC_ENABLE_MESSAGING",
  notifications: "NEXT_PUBLIC_ENABLE_NOTIFICATIONS",
});

const PERMISSIONS = Object.freeze({
  bookingRead: "booking:read",
  bookingWriteOwn: "booking:write:own",
  jobReadAssigned: "job:read:assigned",
  jobDispatch: "job:dispatch",
  providerProfileRead: "provider_profile:read",
  providerProfileWriteOwn: "provider_profile:write:own",
  supportReadLimited: "support:read:limited",
  adminManage: "admin:manage",
  auditWrite: "audit:write",
  systemRun: "system:run",
});

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.customer]: [PERMISSIONS.bookingRead, PERMISSIONS.bookingWriteOwn],
  [ROLES.provider]: [PERMISSIONS.jobReadAssigned, PERMISSIONS.providerProfileRead, PERMISSIONS.providerProfileWriteOwn],
  [ROLES.dispatcher]: [PERMISSIONS.bookingRead, PERMISSIONS.jobReadAssigned, PERMISSIONS.jobDispatch, PERMISSIONS.providerProfileRead, PERMISSIONS.auditWrite],
  [ROLES.admin]: [PERMISSIONS.bookingRead, PERMISSIONS.jobReadAssigned, PERMISSIONS.jobDispatch, PERMISSIONS.providerProfileRead, PERMISSIONS.adminManage, PERMISSIONS.auditWrite],
  [ROLES.support]: [PERMISSIONS.bookingRead, PERMISSIONS.supportReadLimited, PERMISSIONS.auditWrite],
  [ROLES.system]: [PERMISSIONS.systemRun, PERMISSIONS.auditWrite],
});

const SENSITIVE_FIELD_PATTERNS = [
  /(^|_)vin($|_)/i,
  /license_?plate/i,
  /address/i,
  /access.*instruction/i,
  /gate_?code/i,
  /service.*location.*instruction/i,
  /location.*instruction/i,
  /location.*note/i,
  /customer.*contact/i,
  /contact/i,
  /support.*details/i,
  /payment/i,
  /payout/i,
  /bank/i,
  /account/i,
  /card/i,
  /pan/i,
  /cvc/i,
  /cvv/i,
  /stripe/i,
  /phone/i,
  /email/i,
  /message/i,
  /conversation/i,
  /chat/i,
  /(^|_)body($|_)/i,
  /(^|_)text($|_)/i,
  /note/i,
  /token/i,
  /secret/i,
  /password/i,
  /api[_-]?key/i,
];

const SAFE_PROVIDER_JOB_FIELDS = [
  "id",
  "bookingId",
  "jobId",
  "status",
  "serviceId",
  "serviceName",
  "fulfillmentId",
  "market",
  "providerId",
  "scheduledWindow",
  "maskedCustomer",
  "maskedVehicle",
  "estimate",
];

const SAFE_CUSTOMER_BOOKING_FIELDS = [
  "id",
  "bookingId",
  "customerId",
  "status",
  "serviceId",
  "serviceName",
  "fulfillmentId",
  "scheduledWindow",
  "providerId",
  "providerName",
  "maskedVehicle",
  "estimate",
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getActorRole(actor = {}) {
  return Object.values(ROLES).includes(actor.role) ? actor.role : null;
}

function hasPermission(actor = {}, permission) {
  const role = getActorRole(actor);
  return Boolean(role && ROLE_PERMISSIONS[role]?.includes(permission));
}

function ownsCustomerRecord(actor = {}, record = {}) {
  return Boolean(actor.customerId && record.customerId && actor.customerId === record.customerId);
}

function ownsProviderRecord(actor = {}, record = {}) {
  const assignedProviderIds = asArray(record.providerIds);
  return Boolean(
    actor.providerId && (
      actor.providerId === record.providerId ||
      actor.providerId === record.assignedProviderId ||
      assignedProviderIds.includes(actor.providerId)
    )
  );
}

function isSystemActor(actor = {}) {
  return getActorRole(actor) === ROLES.system;
}

function canAccessRecord(actor = {}, record = {}, action = "read") {
  const role = getActorRole(actor);
  if (!role) return { ok: false, reason: "Unknown or missing role." };
  if (isSystemActor(actor)) return { ok: true, reason: "System actor may run internal jobs." };
  if (role === ROLES.admin) return { ok: true, reason: "Admin access is allowed for operations data." };

  const type = record.type ?? record.resourceType ?? "booking";

  if (role === ROLES.dispatcher) {
    if (["booking", "job", "provider_profile", "audit"].includes(type)) return { ok: true, reason: "Dispatcher operations access is allowed." };
    return { ok: false, reason: "Dispatcher access is limited to operations records." };
  }

  if (role === ROLES.customer) {
    if (["payment", "message"].includes(type) && ownsCustomerRecord(actor, record)) {
      if (action !== "read") return { ok: false, reason: "Customer payment and messaging writes are deferred until integrations are enabled." };
      return { ok: true, reason: "Customer owns this read-only deferred record." };
    }
    if (["booking", "vehicle"].includes(type) && ownsCustomerRecord(actor, record)) {
      if (action !== "read" && !hasPermission(actor, PERMISSIONS.bookingWriteOwn)) return { ok: false, reason: "Customer write access is limited." };
      return { ok: true, reason: "Customer owns this record." };
    }
    return { ok: false, reason: "Customer can only access their own records." };
  }

  if (role === ROLES.provider) {
    if (type === "provider_profile" && ownsProviderRecord(actor, record)) return { ok: true, reason: "Provider owns this profile." };
    if (["job", "booking", "message"].includes(type) && ownsProviderRecord(actor, record)) {
      if (action !== "read") return { ok: false, reason: "Provider write access requires a modeled provider action permission." };
      return { ok: true, reason: "Provider is assigned to this job." };
    }
    return { ok: false, reason: "Provider can only access assigned jobs and own profile." };
  }

  if (role === ROLES.support) {
    if (action !== "read") return { ok: false, reason: "Support write access is deferred." };
    if (["booking", "job", "provider_profile"].includes(type)) return { ok: true, reason: "Support may read limited support views." };
    return { ok: false, reason: "Support cannot access payment, vehicle, or message bodies." };
  }

  return { ok: false, reason: "Role is not allowed." };
}

function pickFields(record = {}, allowedFields = []) {
  return allowedFields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(record, field)) result[field] = record[field];
    return result;
  }, {});
}

function maskVin(vin) {
  if (typeof vin !== "string" || vin.trim().length === 0) return undefined;
  return `VIN ending ${vin.trim().slice(-6)}`;
}

function maskAddress(address) {
  if (typeof address !== "string" || address.trim().length === 0) return undefined;
  if (looksLikeExactAddress(address)) return "Service area only";
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const summary = `${parts.at(-2)}, ${parts.at(-1)}`;
    return looksLikeExactAddress(summary) ? "Service area only" : summary;
  }
  return "Service area only";
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function looksLikeExactAddress(value) {
  if (typeof value !== "string") return false;
  return /\d/.test(value) || /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|way|apt|unit|suite)\b/i.test(value);
}

function pickString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function pickVehicleYear(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1900 && value <= 2099 ? value : undefined;
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^(19|20)\d{2}$/.test(trimmed) ? trimmed : undefined;
}

function pickVehicleMileage(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 && value <= 9999999 ? value : undefined;
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d{1,7})$/.test(trimmed)) return undefined;
  const numeric = Number(trimmed.replaceAll(",", ""));
  return numeric >= 0 && numeric <= 9999999 ? trimmed : undefined;
}

function sanitizeMaskedCustomer(record = {}) {
  const customer = isPlainObject(record.customer) ? record.customer : {};
  const supplied = isPlainObject(record.maskedCustomer) ? record.maskedCustomer : {};
  const addressSummary = maskAddress(customer.address ?? record.address)
    ?? (!looksLikeExactAddress(supplied.addressSummary) ? pickString(supplied.addressSummary) : undefined)
    ?? "Address hidden";

  return {
    displayName: pickString(customer.displayName) ?? pickString(customer.name) ?? pickString(supplied.displayName) ?? "Customer",
    phoneMasked: pickString(customer.phoneMasked) ?? (/^phone (hidden|ending \d{2,4})$/i.test(String(supplied.phoneMasked ?? "")) ? supplied.phoneMasked : undefined) ?? "Phone hidden",
    addressSummary,
  };
}

function sanitizeMaskedVehicle(record = {}) {
  const vehicle = isPlainObject(record.vehicle) ? record.vehicle : {};
  const supplied = isPlainObject(record.maskedVehicle) ? record.maskedVehicle : {};
  const vinMasked = pickString(vehicle.vinMasked)
    ?? maskVin(vehicle.vin ?? record.vin)
    ?? (/^vin (hidden|ending [a-z0-9]{4,6})$/i.test(String(supplied.vinMasked ?? "")) ? supplied.vinMasked : undefined)
    ?? "VIN hidden";

  return {
    year: pickVehicleYear(vehicle.year) ?? pickVehicleYear(supplied.year),
    make: pickString(vehicle.make) ?? pickString(supplied.make),
    model: pickString(vehicle.model) ?? pickString(supplied.model),
    vinMasked,
    mileage: pickVehicleMileage(vehicle.mileage) ?? pickVehicleMileage(supplied.mileage),
  };
}

function sanitizeOperationalValue(value, seen = new WeakSet()) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => sanitizeOperationalValue(item, seen));

  return Object.entries(value).reduce((safe, [key, nestedValue]) => {
    if (!shouldDropLogField(key)) safe[key] = sanitizeOperationalValue(nestedValue, seen);
    return safe;
  }, {});
}

const CUSTOMER_ESTIMATE_FIELDS = [
  "status",
  "total",
  "customerTotal",
  "subtotal",
  "tax",
  "taxes",
  "fee",
  "fees",
  "serviceFee",
  "diagnosticFee",
  "discount",
  "currency",
];

const PROVIDER_ESTIMATE_FIELDS = [
  "status",
  "total",
  "customerTotal",
  "currency",
  "providerEarnings",
  "providerPayout",
  "payoutStatus",
];

function shouldDropCustomerEstimateField(key) {
  const field = String(key);
  return /provider(?:Earnings|Payout)/i.test(field)
    || /^payout(?:Status|Summary|Details?|Data)?$/i.test(field)
    || shouldDropSharedEstimateField(field);
}

function shouldDropProviderEstimateField(key, depth) {
  const field = String(key);
  if (depth > 0 && /provider(?:Earnings|Payout)/i.test(field)) return true;
  if (depth > 0 && /^payout(?:Status|Summary|Details?|Data)?$/i.test(field)) return true;
  return shouldDropSharedEstimateField(field);
}

function shouldDropSharedEstimateField(key) {
  const field = String(key);
  return /token/i.test(field)
    || /secret/i.test(field)
    || /api[_-]?key/i.test(field)
    || /password/i.test(field)
    || /bank/i.test(field)
    || /account/i.test(field)
    || /card/i.test(field)
    || /cvv|cvc/i.test(field)
    || /stripe/i.test(field)
    || /processor/i.test(field)
    || /^(?:platform)?margin$/i.test(field)
    || /^internalFees?$/i.test(field)
    || /payment/i.test(field);
}

function sanitizeRoleEstimateValue(value, shouldDropField, seen = new WeakSet(), depth = 0) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => sanitizeRoleEstimateValue(item, shouldDropField, seen, depth + 1));

  return Object.entries(value).reduce((safe, [key, nestedValue]) => {
    if (!shouldDropField(key, depth + 1)) {
      safe[key] = sanitizeRoleEstimateValue(nestedValue, shouldDropField, seen, depth + 1);
    }
    return safe;
  }, {});
}

function sanitizeCustomerEstimate(estimate) {
  if (!isPlainObject(estimate)) return undefined;
  return CUSTOMER_ESTIMATE_FIELDS.reduce((safe, field) => {
    if (Object.prototype.hasOwnProperty.call(estimate, field)) {
      safe[field] = sanitizeRoleEstimateValue(estimate[field], shouldDropCustomerEstimateField);
    }
    return safe;
  }, {});
}

function sanitizeProviderEstimate(estimate) {
  if (!isPlainObject(estimate)) return undefined;
  return PROVIDER_ESTIMATE_FIELDS.reduce((safe, field) => {
    if (Object.prototype.hasOwnProperty.call(estimate, field)) {
      safe[field] = sanitizeRoleEstimateValue(estimate[field], shouldDropProviderEstimateField);
    }
    return safe;
  }, {});
}

function projectEstimateForRole(role, estimate) {
  if (!isPlainObject(estimate)) return undefined;
  if (role === ROLES.customer) return sanitizeCustomerEstimate(estimate);
  if (role === ROLES.provider) return sanitizeProviderEstimate(estimate);
  return sanitizeOperationalValue(estimate);
}

function projectRecordForRole(actor = {}, record = {}) {
  const access = canAccessRecord(actor, record, "read");
  if (!access.ok) return { ok: false, reason: access.reason, record: null };

  const role = getActorRole(actor);
  if (role === ROLES.admin || role === ROLES.dispatcher || role === ROLES.system) {
    return { ok: true, record: sanitizeOperationalRecord(record) };
  }

  if (role === ROLES.customer) {
    const projected = pickFields(sanitizeOperationalRecord(record), SAFE_CUSTOMER_BOOKING_FIELDS);
    if (Object.prototype.hasOwnProperty.call(projected, "estimate")) projected.estimate = projectEstimateForRole(role, record.estimate);
    return { ok: true, record: projected };
  }

  if (role === ROLES.provider) {
    const projected = pickFields(sanitizeOperationalRecord(record), SAFE_PROVIDER_JOB_FIELDS);
    if (Object.prototype.hasOwnProperty.call(projected, "estimate")) projected.estimate = projectEstimateForRole(role, record.estimate);
    return { ok: true, record: projected };
  }

  if (role === ROLES.support) {
    return {
      ok: true,
      record: pickFields(sanitizeOperationalRecord(record), [
        "id",
        "bookingId",
        "jobId",
        "status",
        "serviceId",
        "serviceName",
        "market",
        "maskedCustomer",
        "maskedVehicle",
        "providerId",
        "providerName",
      ]),
    };
  }

  return { ok: false, reason: "Role is not allowed.", record: null };
}

function sanitizeOperationalRecord(record = {}) {
  const { customer, vehicle, payment, messages, messageBody, address, vin, ...rest } = record;
  const safeRest = Object.entries(rest).reduce((safe, [key, value]) => {
    if (!shouldDropLogField(key)) safe[key] = sanitizeOperationalValue(value);
    return safe;
  }, {});
  return {
    ...safeRest,
    maskedCustomer: sanitizeMaskedCustomer(record),
    maskedVehicle: sanitizeMaskedVehicle(record),
  };
}

function shouldDropLogField(key) {
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(String(key)));
}

function sanitizeLogMetadata(metadata, seen = new WeakSet()) {
  if (metadata == null) return metadata;
  if (metadata instanceof Date) return metadata.toISOString();
  if (typeof metadata !== "object") return metadata;
  if (seen.has(metadata)) return "[Circular]";
  seen.add(metadata);

  if (Array.isArray(metadata)) {
    return metadata.map((item) => sanitizeLogMetadata(item, seen));
  }

  return Object.entries(metadata).reduce((safe, [key, value]) => {
    if (shouldDropLogField(key)) {
      safe[key] = "[REDACTED]";
      return safe;
    }
    safe[key] = sanitizeLogMetadata(value, seen);
    return safe;
  }, {});
}

function requireFeatureFlag(flagName, env = process.env) {
  return env[flagName] === "true" || env[flagName] === "1";
}

module.exports = {
  FEATURE_FLAGS,
  PERMISSIONS,
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  canAccessRecord,
  hasPermission,
  projectRecordForRole,
  requireFeatureFlag,
  sanitizeLogMetadata,
  sanitizeOperationalRecord,
};
