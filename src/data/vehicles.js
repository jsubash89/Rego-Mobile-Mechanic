export const initialVehicle = {
  year: "2021",
  make: "Toyota",
  model: "RAV4",
  mileage: "42,800",
  vin: "JTMW1RFV1MD000000",
};

export const seedVehicles = [
  {
    id: "demo-rav4",
    ...initialVehicle,
    vinLast4: initialVehicle.vin.slice(-4),
    trim: undefined,
    engine: undefined,
    fuelType: undefined,
    driveType: undefined,
    bodyClass: "Sport Utility Vehicle",
    source: "curated",
    decodeConfidence: "medium",
    decodedAt: undefined,
  },
];
