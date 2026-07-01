const DEFAULT_MAX_TRAVEL_MILES = 10;
const DEFAULT_AVAILABILITY_RANK = 999;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function includesValue(values, value) {
  return asArray(values).includes(value);
}

function normalizeService(serviceOrId) {
  if (typeof serviceOrId === "string") {
    return { id: serviceOrId };
  }

  return serviceOrId ?? {};
}

function normalizeFulfillment(fulfillmentOrId) {
  if (typeof fulfillmentOrId === "string") {
    return { id: fulfillmentOrId };
  }

  return fulfillmentOrId ?? {};
}

function getProviderDistanceMiles(provider, request = {}) {
  const providerDistances = request.providerDistances ?? {};
  const explicitDistance = providerDistances[provider.id];

  if (Number.isFinite(explicitDistance)) {
    return explicitDistance;
  }

  if (Number.isFinite(provider.distance)) {
    return provider.distance;
  }

  return null;
}

function getTravelCapMiles(provider) {
  if (Number.isFinite(provider.serviceArea?.maxTravelMiles)) {
    return provider.serviceArea.maxTravelMiles;
  }

  if (Number.isFinite(provider.maxTravelMiles)) {
    return provider.maxTravelMiles;
  }

  return DEFAULT_MAX_TRAVEL_MILES;
}

function hasExplicitServiceAreaCoverage(provider, request = {}) {
  const providerCoverage = request.providerCoverage ?? request.coverageByProviderId ?? {};

  return (
    providerCoverage[provider.id] === true ||
    provider.serviceArea?.coversRequest === true ||
    provider.serviceArea?.covered === true ||
    provider.coversServiceLocation === true
  );
}

function getEarliestSlot(provider) {
  return provider.availability?.earliestSlot ?? provider.earliest ?? null;
}

function getAvailabilityRank(provider) {
  if (Number.isFinite(provider.availability?.rank)) {
    return provider.availability.rank;
  }

  if (getEarliestSlot(provider)) {
    return DEFAULT_AVAILABILITY_RANK;
  }

  return Number.POSITIVE_INFINITY;
}

function serviceNeedsProviderConfirmation(service) {
  return (
    service?.requiresFluidSpec === true ||
    service?.requiresPartsFitment === true ||
    service?.providerConfirmationRequired === true ||
    service?.quoteType === "tbd_provider_confirmed"
  );
}

function providerCanConfirmParts(provider) {
  return provider.providerConfirmedParts === true || provider.compliance?.providerConfirmedParts === true;
}

function specialtyMatches(provider, service) {
  const serviceId = service?.id;
  const specialties = asArray(provider.specialtyServiceIds);

  if (serviceId && specialties.includes(serviceId)) {
    return true;
  }

  const serviceName = String(service?.name ?? "").toLowerCase();
  return asArray(provider.specialties).some((specialty) => serviceName.includes(String(specialty).toLowerCase().split(" ")[0]));
}

function getComplianceScore(provider) {
  const compliance = provider.compliance ?? {};
  const certifications = asArray(provider.certifications);
  let score = 0;

  if (compliance.verified === true) score += 10;
  if (compliance.insured === true) score += 8;
  if (compliance.backgroundChecked === true) score += 6;
  if (providerCanConfirmParts(provider)) score += 6;
  score += Math.min(certifications.length * 2, 6);

  return score;
}

function scoreProvider(provider, request = {}) {
  const service = normalizeService(request.service ?? request.serviceId);
  const distanceMiles = getProviderDistanceMiles(provider, request);
  const availabilityRank = getAvailabilityRank(provider);
  const rating = Number.isFinite(provider.rating) ? provider.rating : 0;
  const availabilityScore = Math.max(0, 120 - availabilityRank * 25);
  const distanceScore = distanceMiles == null ? 0 : Math.max(0, 60 - distanceMiles * 5);
  const ratingScore = Math.round(rating * 10);
  const specialtyScore = specialtyMatches(provider, service) ? 20 : 0;
  const complianceScore = getComplianceScore(provider);

  return {
    total: availabilityScore + distanceScore + ratingScore + specialtyScore + complianceScore,
    components: {
      availability: availabilityScore,
      distance: Math.round(distanceScore * 10) / 10,
      rating: ratingScore,
      specialty: specialtyScore,
      compliance: complianceScore,
    },
  };
}

function explainEligibility(provider, request = {}) {
  const service = normalizeService(request.service ?? request.serviceId);
  const fulfillment = normalizeFulfillment(request.fulfillment ?? request.fulfillmentId);
  const serviceId = service.id;
  const fulfillmentId = fulfillment.id;
  const distanceMiles = getProviderDistanceMiles(provider, request);
  const travelCapMiles = getTravelCapMiles(provider);
  const earliestSlot = getEarliestSlot(provider);
  const reasons = [];
  const exclusions = [];

  if (!serviceId || !includesValue(provider.serviceIds, serviceId)) {
    exclusions.push("Service not supported");
  } else {
    reasons.push("Supports selected service");
  }

  if (!fulfillmentId || !includesValue(provider.fulfillmentModes, fulfillmentId)) {
    exclusions.push("Fulfillment mode not supported");
  } else {
    reasons.push(`Supports ${fulfillmentId} fulfillment`);
  }

  if (provider.availability?.available === false || !earliestSlot) {
    exclusions.push("No bookable availability");
  } else {
    reasons.push(`Earliest ${earliestSlot}`);
  }

  if (fulfillmentId === "mobile") {
    if (distanceMiles == null && !hasExplicitServiceAreaCoverage(provider, request)) {
      exclusions.push("Travel distance unavailable");
    } else if (distanceMiles != null && distanceMiles > travelCapMiles) {
      exclusions.push(`Outside ${travelCapMiles} mi mobile service area`);
    } else if (distanceMiles != null) {
      reasons.push(`${distanceMiles} mi away within ${travelCapMiles} mi travel cap`);
    } else {
      reasons.push("Service area coverage confirmed");
    }
  }

  if (serviceNeedsProviderConfirmation(service) && !providerCanConfirmParts(provider)) {
    exclusions.push("Provider-confirmed parts/fitment not supported");
  } else if (serviceNeedsProviderConfirmation(service)) {
    reasons.push("Can confirm parts and fitment before dispatch");
  }

  if (specialtyMatches(provider, service)) {
    reasons.push("Specialty match");
  }

  if (provider.compliance?.verified === true || provider.compliance?.insured === true) {
    reasons.push("Verified trust/compliance signals");
  }

  return {
    provider,
    providerId: provider.id,
    eligible: exclusions.length === 0,
    reasons,
    exclusions,
    distanceMiles,
    travelCapMiles,
    earliestSlot,
  };
}

function evaluateProviderMatches(providers, request = {}) {
  return asArray(providers).map((provider) => {
    const eligibility = explainEligibility(provider, request);
    const score = eligibility.eligible ? scoreProvider(provider, request) : { total: 0, components: {} };

    return {
      ...eligibility,
      score: score.total,
      scoreComponents: score.components,
    };
  });
}

function sortProviderMatches(matches) {
  return [...matches].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const availabilityDelta = getAvailabilityRank(a.provider) - getAvailabilityRank(b.provider);
    if (availabilityDelta !== 0) return availabilityDelta;

    const aDistance = a.distanceMiles ?? Number.POSITIVE_INFINITY;
    const bDistance = b.distanceMiles ?? Number.POSITIVE_INFINITY;
    if (aDistance !== bDistance) return aDistance - bDistance;

    const ratingDelta = (b.provider.rating ?? 0) - (a.provider.rating ?? 0);
    if (ratingDelta !== 0) return ratingDelta;

    return String(a.provider.id).localeCompare(String(b.provider.id));
  });
}

function rankProviderMatches(providers, request = {}) {
  return getProviderMatchingResults(providers, request).matches;
}

function getProviderMatchingResults(providers, request = {}) {
  const evaluated = evaluateProviderMatches(providers, request);
  const matches = sortProviderMatches(evaluated.filter((match) => match.eligible));

  return {
    matches,
    evaluated,
    ineligible: evaluated.filter((match) => !match.eligible),
  };
}

function chooseSelectedProvider({ providers, selectedProviderId, request } = {}) {
  const { matches, evaluated } = getProviderMatchingResults(providers, request);
  const selectedMatch = evaluated.find((match) => match.providerId === selectedProviderId);

  if (selectedMatch?.eligible) {
    return selectedMatch;
  }

  return matches[0] ?? null;
}

module.exports = {
  DEFAULT_MAX_TRAVEL_MILES,
  explainEligibility,
  getProviderMatchingResults,
  rankProviderMatches,
  chooseSelectedProvider,
  serviceNeedsProviderConfirmation,
};
