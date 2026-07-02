import assert from "node:assert/strict";
import test from "node:test";

import accessControl from "./access-control.js";

const {
  FEATURE_FLAGS,
  PERMISSIONS,
  ROLES,
  canAccessRecord,
  hasPermission,
  projectRecordForRole,
  requireFeatureFlag,
  sanitizeLogMetadata,
  sanitizeOperationalRecord,
} = accessControl;

function booking(overrides = {}) {
  return {
    type: "booking",
    id: "booking-1",
    bookingId: "BK-1",
    customerId: "customer-1",
    providerId: "provider-1",
    status: "assigned",
    serviceId: "oil-change",
    serviceName: "Synthetic oil change",
    market: "chicago",
    fulfillmentId: "mobile",
    scheduledWindow: "Today 2:00 PM - 4:00 PM",
    estimate: { customerTotal: 129, providerEarnings: 92 },
    providerPayout: 92,
    customer: {
      displayName: "Jane Driver",
      phone: "312-555-0100",
      address: "123 Private St, Chicago, IL",
    },
    vehicle: {
      year: 2022,
      make: "Toyota",
      model: "RAV4",
      vin: "2T3P1RFV1MW123456",
      mileage: 42000,
    },
    payment: {
      cardLast4: "4242",
      paymentIntentId: "pi_secret",
    },
    messages: [{ body: "Gate code is 1234" }],
    internalNotes: "Customer asked to keep address private.",
    serviceAddress: "123 Private St, Chicago, IL",
    paymentIntentId: "pi_secret_top_level",
    accessInstructions: "Use gate code 1234",
    locationNotes: "Park by the garage",
    licensePlate: "ABC1234",
    license_plate: "XYZ9876",
    phone: "312-555-0100",
    email: "jane@example.com",
    bankAccountLast4: "6789",
    payoutAccountId: "acct_secret",
    token: "tok_secret",
    apiKey: "api_secret",
    password: "plaintext",
    ...overrides,
  };
}

test("customer can read own booking but not another customer's booking", () => {
  const actor = { role: ROLES.customer, customerId: "customer-1" };

  assert.equal(canAccessRecord(actor, booking()).ok, true);
  assert.equal(canAccessRecord(actor, booking({ customerId: "customer-2" })).ok, false);
});

test("customer payment and message writes fail closed while integrations are deferred", () => {
  const actor = { role: ROLES.customer, customerId: "customer-1" };
  const ownPayment = { type: "payment", customerId: "customer-1" };
  const ownMessage = { type: "message", customerId: "customer-1" };

  assert.equal(canAccessRecord(actor, ownPayment, "read").ok, true);
  assert.equal(canAccessRecord(actor, ownMessage, "read").ok, true);
  assert.equal(canAccessRecord(actor, ownPayment, "write").ok, false);
  assert.equal(canAccessRecord(actor, ownMessage, "write").ok, false);
});

test("provider can read assigned job data but cannot read unassigned customer data", () => {
  const actor = { role: ROLES.provider, providerId: "provider-1" };
  const assigned = booking({ type: "job" });
  const unassigned = booking({ type: "job", providerId: "provider-2" });

  assert.equal(canAccessRecord(actor, assigned).ok, true);
  assert.equal(canAccessRecord(actor, unassigned).ok, false);
  assert.equal(canAccessRecord(actor, assigned, "read").ok, true);
  assert.equal(canAccessRecord(actor, assigned, "write").ok, false);
  assert.equal(canAccessRecord(actor, booking({ type: "booking" }), "write").ok, false);
  assert.equal(canAccessRecord(actor, booking({ type: "message" }), "write").ok, false);
  assert.equal(canAccessRecord(actor, { type: "provider_profile", providerId: "provider-1" }, "write").ok, true);

  const projected = projectRecordForRole(actor, assigned);
  assert.equal(projected.ok, true);
  assert.deepEqual(Object.keys(projected.record).sort(), [
    "bookingId",
    "estimate",
    "fulfillmentId",
    "id",
    "market",
    "maskedCustomer",
    "maskedVehicle",
    "providerId",
    "scheduledWindow",
    "serviceId",
    "serviceName",
    "status",
  ].sort());
  assert.equal(projected.record.maskedVehicle.vinMasked, "VIN ending 123456");
  assert.equal(projected.record.maskedCustomer.addressSummary, "Service area only");
  assert.equal(projected.record.customer, undefined);
  assert.equal(projected.record.payment, undefined);
  assert.equal(projected.record.messages, undefined);
  assert.equal(projected.record.providerPayout, undefined);
});

test("admin can access operations records but operational projection excludes raw sensitive fields", () => {
  const actor = { role: ROLES.admin, userId: "admin-1" };
  const projected = projectRecordForRole(actor, booking());

  assert.equal(canAccessRecord(actor, booking()).ok, true);
  assert.equal(projected.ok, true);
  assert.equal(projected.record.customer, undefined);
  assert.equal(projected.record.vehicle, undefined);
  assert.equal(projected.record.payment, undefined);
  assert.equal(projected.record.messages, undefined);
  assert.equal(projected.record.serviceAddress, undefined);
  assert.equal(projected.record.internalNotes, undefined);
  assert.equal(projected.record.paymentIntentId, undefined);
  assert.equal(projected.record.accessInstructions, undefined);
  assert.equal(projected.record.locationNotes, undefined);
  assert.equal(projected.record.licensePlate, undefined);
  assert.equal(projected.record.phone, undefined);
  assert.equal(projected.record.email, undefined);
  assert.equal(projected.record.bankAccountLast4, undefined);
  assert.equal(projected.record.payoutAccountId, undefined);
  assert.equal(projected.record.token, undefined);
  assert.equal(projected.record.apiKey, undefined);
  assert.equal(projected.record.password, undefined);
  assert.equal(projected.record.maskedVehicle.vinMasked, "VIN ending 123456");
});

test("support read access is limited and excludes payment, vehicle, and message bodies", () => {
  const actor = { role: ROLES.support, userId: "support-1" };

  assert.equal(canAccessRecord(actor, booking(), "read").ok, true);
  assert.equal(canAccessRecord(actor, booking(), "write").ok, false);
  assert.equal(canAccessRecord(actor, booking({ type: "payment" }), "read").ok, false);

  const projected = projectRecordForRole(actor, booking());
  assert.equal(projected.ok, true);
  assert.equal(projected.record.payment, undefined);
  assert.equal(projected.record.messages, undefined);
  assert.equal(projected.record.maskedCustomer.addressSummary, "Service area only");
});

test("permissions are explicit for dispatcher/admin/support/system roles", () => {
  assert.equal(hasPermission({ role: ROLES.dispatcher }, PERMISSIONS.jobDispatch), true);
  assert.equal(hasPermission({ role: ROLES.admin }, PERMISSIONS.adminManage), true);
  assert.equal(hasPermission({ role: ROLES.support }, PERMISSIONS.adminManage), false);
  assert.equal(hasPermission({ role: ROLES.system }, PERMISSIONS.systemRun), true);
});

test("sanitizeOperationalRecord masks VIN and address and removes raw sensitive containers", () => {
  const safe = sanitizeOperationalRecord(booking());

  assert.equal(safe.customer, undefined);
  assert.equal(safe.vehicle, undefined);
  assert.equal(safe.payment, undefined);
  assert.equal(safe.messages, undefined);
  assert.equal(safe.serviceAddress, undefined);
  assert.equal(safe.internalNotes, undefined);
  assert.equal(safe.paymentIntentId, undefined);
  assert.equal(safe.accessInstructions, undefined);
  assert.equal(safe.locationNotes, undefined);
  assert.equal(safe.licensePlate, undefined);
  assert.equal(safe.license_plate, undefined);
  assert.equal(safe.phone, undefined);
  assert.equal(safe.email, undefined);
  assert.equal(safe.bankAccountLast4, undefined);
  assert.equal(safe.payoutAccountId, undefined);
  assert.equal(safe.providerPayout, undefined);
  assert.equal(safe.token, undefined);
  assert.equal(safe.apiKey, undefined);
  assert.equal(safe.password, undefined);
  assert.equal(safe.maskedVehicle.vinMasked, "VIN ending 123456");
  assert.equal(safe.maskedCustomer.addressSummary, "Service area only");
});

test("sanitizeOperationalRecord recursively drops nested sensitive fields", () => {
  const safe = sanitizeOperationalRecord(booking({
    metadata: {
      workflow: "dispatch",
      customerContact: { phone: "312-555-0100", ok: false },
      auditDetails: {
        changedBy: "dispatcher-1",
        serviceLocationInstructions: "Gate code 1234",
        context: {
          gateCode: "1234",
          locationInstructions: "Behind garage",
          estimate: {
            customerTotal: 129,
            providerEarnings: 92,
            paymentIntentClientSecret: "pi_secret_123",
          },
        },
      },
    },
  }));

  assert.equal(safe.metadata.workflow, "dispatch");
  assert.equal(safe.metadata.customerContact, undefined);
  assert.equal(safe.metadata.auditDetails.changedBy, "dispatcher-1");
  assert.equal(safe.metadata.auditDetails.serviceLocationInstructions, undefined);
  assert.equal(safe.metadata.auditDetails.context.gateCode, undefined);
  assert.equal(safe.metadata.auditDetails.context.locationInstructions, undefined);
  assert.equal(safe.metadata.auditDetails.context.estimate.customerTotal, 129);
  assert.equal(safe.metadata.auditDetails.context.estimate.providerEarnings, 92);
  assert.equal(safe.metadata.auditDetails.context.estimate.paymentIntentClientSecret, undefined);
});

test("sanitizeOperationalRecord rebuilds malicious masked customer and vehicle objects", () => {
  const safe = sanitizeOperationalRecord(booking({
    customer: undefined,
    vehicle: undefined,
    maskedCustomer: {
      displayName: "Masked Customer",
      phoneMasked: "Phone ending 0100",
      phone: "312-555-0100",
      exactAddress: "123 Private St, Chicago, IL",
      addressSummary: "123 Private St, Chicago, IL",
      supportDetails: "do not leak",
    },
    maskedVehicle: {
      year: 2022,
      make: "Toyota",
      model: "RAV4",
      vinMasked: "VIN ending 3456",
      vin: "2T3P1RFV1MW123456",
      licensePlate: "ABC1234",
      plate: "ABC1234",
    },
  }));

  assert.deepEqual(Object.keys(safe.maskedCustomer).sort(), ["addressSummary", "displayName", "phoneMasked"].sort());
  assert.equal(safe.maskedCustomer.displayName, "Masked Customer");
  assert.equal(safe.maskedCustomer.phoneMasked, "Phone ending 0100");
  assert.equal(safe.maskedCustomer.addressSummary, "Address hidden");
  assert.equal(safe.maskedCustomer.phone, undefined);
  assert.equal(safe.maskedCustomer.exactAddress, undefined);
  assert.equal(safe.maskedVehicle.year, 2022);
  assert.equal(safe.maskedVehicle.vinMasked, "VIN ending 3456");
  assert.equal(safe.maskedVehicle.vin, undefined);
  assert.equal(safe.maskedVehicle.licensePlate, undefined);
  assert.equal(safe.maskedVehicle.plate, undefined);
});

test("address summaries fail closed for one-part, two-part, and multi-part exact addresses", () => {
  assert.equal(sanitizeOperationalRecord(booking({
    customer: { displayName: "Jane Driver", address: "123 Private St" },
  })).maskedCustomer.addressSummary, "Service area only");

  assert.equal(sanitizeOperationalRecord(booking({
    customer: { displayName: "Jane Driver", address: "123 Private St, Chicago" },
  })).maskedCustomer.addressSummary, "Service area only");

  assert.equal(sanitizeOperationalRecord(booking({
    customer: { displayName: "Jane Driver", address: "123 Private St, Chicago, IL" },
  })).maskedCustomer.addressSummary, "Service area only");
});

test("supplied masked address summaries fail closed when they contain exact-address signals", () => {
  for (const addressSummary of ["123 Private St", "123 Private St, Unit 2", "Private St, Unit 2"]) {
    const safe = sanitizeOperationalRecord(booking({
      customer: undefined,
      maskedCustomer: { displayName: "Masked Customer", addressSummary },
    }));

    assert.equal(safe.maskedCustomer.addressSummary, "Address hidden");
  }
});

test("sanitizeMaskedVehicle drops object-valued year and mileage", () => {
  const safe = sanitizeOperationalRecord(booking({
    vehicle: undefined,
    maskedVehicle: {
      year: { value: "2022", vin: "2T3P1RFV1MW123456" },
      mileage: { value: "42,000", address: "123 Private St" },
      make: "Toyota",
      model: "RAV4",
      vinMasked: "VIN ending 3456",
    },
  }));

  assert.equal(safe.maskedVehicle.year, undefined);
  assert.equal(safe.maskedVehicle.mileage, undefined);
  assert.equal(safe.maskedVehicle.make, "Toyota");
  assert.equal(safe.maskedVehicle.model, "RAV4");
});

test("customer estimate projection excludes provider and internal economics", () => {
  const actor = { role: ROLES.customer, customerId: "customer-1" };
  const projected = projectRecordForRole(actor, booking({
    estimate: {
      status: "approved",
      customerTotal: 129,
      total: 129,
      subtotal: 110,
      taxes: 9,
      serviceFee: 10,
      providerEarnings: 92,
      margin: 27,
      internalFees: 8,
      paymentIntentId: "pi_secret",
      paymentIntentClientSecret: "pi_secret_client",
    },
  }));

  assert.equal(projected.ok, true);
  assert.deepEqual(projected.record.estimate, {
    status: "approved",
    total: 129,
    customerTotal: 129,
    subtotal: 110,
    taxes: 9,
    serviceFee: 10,
  });
});

test("provider estimate projection uses provider-safe whitelist without margin, fees, or payment secrets", () => {
  const record = booking({
    estimate: {
      status: "approved",
      customerTotal: 129,
      total: 129,
      currency: "USD",
      providerEarnings: 92,
      providerPayout: 92,
      payoutStatus: "pending",
      margin: 27,
      platformMargin: 27,
      internalFees: 8,
      paymentIntentId: "pi_secret",
      paymentIntentClientSecret: "pi_secret_client",
      payment: { clientSecret: "secret" },
    },
  });

  const provider = projectRecordForRole({ role: ROLES.provider, providerId: "provider-1" }, { ...record, type: "job" });
  const admin = projectRecordForRole({ role: ROLES.admin }, record);

  assert.deepEqual(provider.record.estimate, {
    status: "approved",
    total: 129,
    customerTotal: 129,
    currency: "USD",
    providerEarnings: 92,
    providerPayout: 92,
    payoutStatus: "pending",
  });
  assert.equal(provider.record.estimate.margin, undefined);
  assert.equal(provider.record.estimate.platformMargin, undefined);
  assert.equal(provider.record.estimate.internalFees, undefined);
  assert.equal(provider.record.estimate.paymentIntentId, undefined);
  assert.equal(provider.record.estimate.paymentIntentClientSecret, undefined);
  assert.equal(provider.record.estimate.payment, undefined);
  assert.equal(admin.record.estimate.providerEarnings, 92);
  assert.equal(admin.record.estimate.margin, 27);
  assert.equal(admin.record.estimate.platformMargin, 27);
  assert.equal(admin.record.estimate.internalFees, 8);
  assert.equal(admin.record.estimate.paymentIntentId, undefined);
  assert.equal(admin.record.estimate.paymentIntentClientSecret, undefined);
});

test("customer and provider estimate projection fails closed for malformed estimate arrays", () => {
  const estimate = [{
    customerTotal: 129,
    margin: 27,
    internalFees: 8,
    paymentIntentClientSecret: "pi_secret_client",
  }];

  const customer = projectRecordForRole(
    { role: ROLES.customer, customerId: "customer-1" },
    booking({ estimate }),
  );
  const provider = projectRecordForRole(
    { role: ROLES.provider, providerId: "provider-1" },
    booking({ type: "job", estimate }),
  );

  assert.equal(customer.ok, true);
  assert.equal(provider.ok, true);
  assert.equal(customer.record.estimate, undefined);
  assert.equal(provider.record.estimate, undefined);
});

test("customer estimate projection deeply scrubs forbidden economics and payment fields inside allowed totals", () => {
  const projected = projectRecordForRole({ role: ROLES.customer, customerId: "customer-1" }, booking({
    estimate: {
      status: "approved",
      customerTotal: {
        amount: 129,
        providerEarnings: 92,
        providerPayout: 92,
        payoutStatus: "pending",
        margin: 27,
        internalFees: 8,
        feeBreakdown: {
          customerFee: 10,
          internalFee: 3,
          internalFees: 5,
        },
        cardLast4: "4242",
        bankAccount: "acct_secret",
        processorToken: "tok_secret",
        authToken: "tok_secret",
        apiKey: "api_secret",
        api_key: "api_secret_snake",
        "api-key": "api_secret_kebab",
        password: "plaintext",
        payment: { clientSecret: "secret" },
        paymentSecret: "pay_secret",
        paymentGateway: { token: "tok_secret" },
      },
      total: {
        amount: 129,
        providerPayout: { amount: 92 },
        nested: {
          providerEarnings: 92,
          payoutStatus: "pending",
          platformMargin: 27,
          processorSecret: "sk_secret",
          paymentIntentClientSecret: "pi_secret_client",
        },
      },
    },
  }));

  assert.deepEqual(projected.record.estimate, {
    status: "approved",
    total: {
      amount: 129,
      nested: {},
    },
    customerTotal: {
      amount: 129,
      feeBreakdown: {
        customerFee: 10,
      },
    },
  });
  assert.equal(JSON.stringify(projected.record.estimate).includes("secret"), false);
  assert.equal(JSON.stringify(projected.record.estimate).includes("margin"), false);
  assert.equal(JSON.stringify(projected.record.estimate).includes("internalFee"), false);
  assert.equal(JSON.stringify(projected.record.estimate).includes("providerEarnings"), false);
});

test("provider estimate projection deeply scrubs nested margin, internal fees, and payment containers", () => {
  const projected = projectRecordForRole({ role: ROLES.provider, providerId: "provider-1" }, booking({
    type: "job",
    estimate: {
      status: "approved",
      total: {
        amount: 129,
        providerEarnings: 92,
        providerPayout: { amount: 92 },
        platformMargin: 27,
        internalFees: 8,
        payment: { clientSecret: "secret" },
        paymentInfo: { cardLast4: "4242", brand: "visa" },
        paymentMetadata: { processorToken: "tok_secret" },
        paymentProcessorData: { apiKey: "api_secret" },
        authToken: "tok_secret",
        cardLast4: "4242",
        bankAccount: "acct_secret",
        paymentGateway: { token: "tok_secret" },
      },
      customerTotal: {
        amount: 129,
        paymentDetails: { clientSecret: "secret" },
        paymentSecret: "pay_secret",
      },
      providerEarnings: {
        amount: 92,
        margin: 27,
        internalFee: 3,
        paymentIntentId: "pi_secret",
      },
      providerPayout: {
        amount: 92,
        payment: { clientSecret: "secret" },
        feeBreakdown: { internalFees: 5, providerFee: 2 },
      },
      currency: "USD",
    },
  }));

  assert.deepEqual(projected.record.estimate, {
    status: "approved",
    total: {
      amount: 129,
    },
    customerTotal: {
      amount: 129,
    },
    currency: "USD",
    providerEarnings: {
      amount: 92,
    },
    providerPayout: {
      amount: 92,
      feeBreakdown: { providerFee: 2 },
    },
  });
  assert.equal(JSON.stringify(projected.record.estimate).includes("secret"), false);
  assert.equal(JSON.stringify(projected.record.estimate).includes("margin"), false);
  assert.equal(JSON.stringify(projected.record.estimate).includes("internalFee"), false);
  assert.equal(JSON.stringify(projected.record.estimate).includes("payment"), false);
});

test("sanitizeLogMetadata redacts docs never-log raw categories", () => {
  const safe = sanitizeLogMetadata({
    bookingId: "BK-1",
    vin: "2T3P1RFV1MW123456",
    serviceAddress: "123 Private St",
    paymentIntentId: "pi_secret",
    cardLast4: "4242",
    messageBody: "Gate code is 1234",
    phone: "312-555-0100",
    email: "jane@example.com",
    licensePlate: "ABC1234",
    license_plate: "XYZ9876",
    accessInstructions: "Use gate code 1234",
    gateCode: "1234",
    serviceLocationInstructions: "Use side gate",
    locationInstructions: "Park by garage",
    customerContact: "312-555-0100",
    contact: "jane@example.com",
    supportDetails: "customer contact notes",
    locationNotes: "Park by the garage",
    bankAccountLast4: "6789",
    payoutAccountId: "acct_secret",
    token: "tok_secret",
    secret: "client_secret",
    password: "plaintext",
    apiKey: "api_secret",
    api_key: "api_secret_snake",
    "api-key": "api_secret_kebab",
    nested: { text: "private text", ok: true },
  });

  assert.equal(safe.bookingId, "BK-1");
  assert.equal(safe.vin, "[REDACTED]");
  assert.equal(safe.serviceAddress, "[REDACTED]");
  assert.equal(safe.paymentIntentId, "[REDACTED]");
  assert.equal(safe.cardLast4, "[REDACTED]");
  assert.equal(safe.messageBody, "[REDACTED]");
  assert.equal(safe.phone, "[REDACTED]");
  assert.equal(safe.email, "[REDACTED]");
  assert.equal(safe.licensePlate, "[REDACTED]");
  assert.equal(safe.license_plate, "[REDACTED]");
  assert.equal(safe.accessInstructions, "[REDACTED]");
  assert.equal(safe.gateCode, "[REDACTED]");
  assert.equal(safe.serviceLocationInstructions, "[REDACTED]");
  assert.equal(safe.locationInstructions, "[REDACTED]");
  assert.equal(safe.customerContact, "[REDACTED]");
  assert.equal(safe.contact, "[REDACTED]");
  assert.equal(safe.supportDetails, "[REDACTED]");
  assert.equal(safe.locationNotes, "[REDACTED]");
  assert.equal(safe.bankAccountLast4, "[REDACTED]");
  assert.equal(safe.payoutAccountId, "[REDACTED]");
  assert.equal(safe.token, "[REDACTED]");
  assert.equal(safe.secret, "[REDACTED]");
  assert.equal(safe.password, "[REDACTED]");
  assert.equal(safe.apiKey, "[REDACTED]");
  assert.equal(safe.api_key, "[REDACTED]");
  assert.equal(safe["api-key"], "[REDACTED]");
  assert.equal(safe.nested.text, "[REDACTED]");
  assert.equal(safe.nested.ok, true);
});

test("payments, messaging, and notifications stay feature flagged", () => {
  const env = {
    [FEATURE_FLAGS.payments]: "false",
    [FEATURE_FLAGS.messaging]: "0",
    [FEATURE_FLAGS.notifications]: "true",
  };

  assert.equal(requireFeatureFlag(FEATURE_FLAGS.payments, env), false);
  assert.equal(requireFeatureFlag(FEATURE_FLAGS.messaging, env), false);
  assert.equal(requireFeatureFlag(FEATURE_FLAGS.notifications, env), true);
});
