export const quoteTypes = {
  fixed: "fixed",
  range: "range",
  tbdProviderConfirmed: "tbd_provider_confirmed",
};

export const services = [
  {
    id: "oil-change",
    name: "Oil change",
    price: 79,
    duration: "45–60 min",
    description: "Synthetic or conventional oil service at your driveway, office, shop, or dealership.",
    includes: ["Oil + filter options", "Fluid top-off", "Maintenance reset", "Disposal included"],
    requiresFluidSpec: true,
    requiresPartsFitment: true,
    providerConfirmationRequired: true,
    quoteType: quoteTypes.tbdProviderConfirmed,
  },
  {
    id: "diagnostic",
    name: "Check-engine diagnostic",
    price: 69,
    duration: "30 min",
    description: "Mobile OBD scan, symptom intake, and repair recommendation before you commit to work.",
    includes: ["Code readout", "Technician notes", "Repair estimate", "Priority rating"],
    requiresFluidSpec: false,
    requiresPartsFitment: false,
    providerConfirmationRequired: true,
    quoteType: quoteTypes.fixed,
  },
  {
    id: "brakes",
    name: "Brake service",
    price: 189,
    duration: "90–150 min",
    description: "Pads, rotors, fluid checks, and safety inspection with mobile or shop fulfillment.",
    includes: ["Pads/rotors quote", "Road-test notes", "Photos", "Warranty options"],
    requiresFluidSpec: false,
    requiresPartsFitment: true,
    providerConfirmationRequired: true,
    quoteType: quoteTypes.range,
  },
  {
    id: "inspection",
    name: "Pre-purchase inspection",
    price: 149,
    duration: "75 min",
    description: "Independent inspection before buying a used vehicle from a private seller or dealer.",
    includes: ["Exterior/interior report", "OBD scan", "Photo evidence", "Buy/no-buy guidance"],
    requiresFluidSpec: false,
    requiresPartsFitment: false,
    providerConfirmationRequired: false,
    quoteType: quoteTypes.fixed,
  },
];

export const oilOptions = [
  { id: "recommended", name: "Mechanic recommendation", price: 0, note: "Tech confirms oil spec by VIN before appointment." },
  { id: "5w30", name: "5W-30 full synthetic", price: 54, note: "Common for many gas engines." },
  { id: "0w20", name: "0W-20 full synthetic", price: 59, note: "Common for newer Honda, Toyota, Ford, and hybrids." },
  { id: "customer", name: "I will provide oil", price: 0, note: "Service includes labor and disposal only." },
];
