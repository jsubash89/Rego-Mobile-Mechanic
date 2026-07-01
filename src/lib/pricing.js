const DEFAULT_PLATFORM_FEE = 9;
const QUOTE_TYPES = {
  fixed: "fixed",
  range: "range",
  tbdProviderConfirmed: "tbd_provider_confirmed",
};

function asMoneyAmount(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function isOilChange(service) {
  return service?.id === "oil-change" || service?.requiresFluidSpec === true;
}

function requiresProviderConfirmation(service) {
  return service?.providerConfirmationRequired === true || service?.quoteType === QUOTE_TYPES.tbdProviderConfirmed;
}

function oilPartsAreTbd(service, oil) {
  if (!isOilChange(service) || !oil) {
    return false;
  }

  if (oil.partsTbd === true || oil.quoteType === QUOTE_TYPES.tbdProviderConfirmed) {
    return true;
  }

  return oil.id === "recommended" && requiresProviderConfirmation(service);
}

function servicePartsAreTbd(service, oil) {
  if (isOilChange(service)) {
    return oilPartsAreTbd(service, oil);
  }

  return service?.requiresPartsFitment === true && service?.quoteType !== QUOTE_TYPES.fixed;
}

function calculateEstimate({ service, oil, fulfillment, platformFee = DEFAULT_PLATFORM_FEE } = {}) {
  if (!service) {
    throw new Error("calculateEstimate requires a service");
  }

  const labor = asMoneyAmount(service.price);
  const travel = asMoneyAmount(fulfillment?.fee);
  const platform = asMoneyAmount(platformFee);
  const partsTbd = servicePartsAreTbd(service, oil);
  const parts = isOilChange(service) && oil ? asMoneyAmount(oil.price) : 0;
  const subtotal = labor + parts + travel + platform;
  const providerConfirmationRequired = requiresProviderConfirmation(service) || partsTbd;
  const quoteType = partsTbd ? QUOTE_TYPES.tbdProviderConfirmed : service.quoteType ?? QUOTE_TYPES.fixed;
  const totalTbd = partsTbd;

  return {
    labor,
    parts,
    travel,
    platform,
    subtotal,
    total: subtotal,
    partsTbd,
    totalTbd,
    quoteType,
    providerConfirmationRequired,
    lineItems: [
      { id: "labor", label: "Labor estimate", amount: labor, tbd: false },
      { id: "parts", label: isOilChange(service) ? "Parts / oil" : "Parts", amount: parts, tbd: partsTbd },
      { id: "travel", label: "Travel / coordination", amount: travel, tbd: false },
      { id: "platform", label: "Platform fee", amount: platform, tbd: false },
    ],
  };
}

function formatEstimateAmount(amount, { tbd = false, formatter } = {}) {
  if (tbd) {
    return "TBD";
  }

  const format = formatter ?? ((value) => `$${value}`);
  return format(asMoneyAmount(amount));
}

function getEstimateStatusCopy(estimate, { service, provider } = {}) {
  if (!estimate) {
    return {
      label: "Estimate unavailable",
      summary: "Choose a service and fulfillment option to see the MVP estimate.",
      totalLabel: "TBD",
    };
  }

  const providerName = provider?.name ?? "the selected provider";

  if (estimate.totalTbd || estimate.partsTbd || estimate.quoteType === QUOTE_TYPES.tbdProviderConfirmed) {
    return {
      label: "Provider-confirmed estimate",
      summary: `${providerName} will confirm exact ${service?.requiresFluidSpec ? "oil spec, filter, " : ""}parts, and arrival window before any charge is captured. Labor, travel, and platform fees are shown now; final due today remains TBD until confirmation.`,
      totalLabel: "TBD until provider confirms",
    };
  }

  if (estimate.quoteType === QUOTE_TYPES.range) {
    return {
      label: "Estimated range",
      summary: `${providerName} will verify parts and scope before dispatch. Any change from this estimate requires customer approval.`,
      totalLabel: "Estimate before provider confirmation",
    };
  }

  if (estimate.providerConfirmationRequired) {
    return {
      label: "Provider confirmation next",
      summary: `${providerName} will confirm availability and arrival window before any charge is captured.`,
      totalLabel: "Estimated due today",
    };
  }

  return {
    label: "Fixed MVP estimate",
    summary: "This static MVP estimate is ready to confirm. No payment is captured in the prototype.",
    totalLabel: "Due today",
  };
}

module.exports = {
  DEFAULT_PLATFORM_FEE,
  QUOTE_TYPES,
  calculateEstimate,
  formatEstimateAmount,
  getEstimateStatusCopy,
};
