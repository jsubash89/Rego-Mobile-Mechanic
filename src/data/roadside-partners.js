export const roadsideServiceTypes = [
  {
    id: "tow",
    label: "Tow / disabled vehicle",
    emergency: true,
    description: "Vehicle cannot be safely driven and needs towing or recovery.",
  },
  {
    id: "lockout",
    label: "Lockout",
    emergency: true,
    description: "Keys are locked in the vehicle or access is blocked.",
  },
  {
    id: "fuel_delivery",
    label: "Fuel delivery",
    emergency: true,
    description: "Vehicle is out of fuel or charge in an unsafe or urgent setting.",
  },
  {
    id: "battery_jump_emergency",
    label: "Jump / battery emergency",
    emergency: true,
    description: "Battery issue needs immediate roadside response rather than a scheduled mechanic visit.",
  },
  {
    id: "flat_tire_emergency",
    label: "Flat tire emergency",
    emergency: true,
    description: "Flat tire is urgent, on-road, or unsafe and needs immediate roadside response.",
  },
  {
    id: "unsafe_location",
    label: "Unsafe location",
    emergency: true,
    description: "Customer is stopped in traffic, exposed to danger, or needs emergency assistance first.",
  },
  {
    id: "diagnostic",
    label: "Non-emergency diagnostic",
    emergency: false,
    description: "Vehicle is parked safely and can wait for a ReGo booking.",
  },
  {
    id: "maintenance",
    label: "Scheduled maintenance",
    emergency: false,
    description: "Oil, brakes, inspection, or other planned work for the normal ReGo booking path.",
  },
];

export const roadsidePartners = [
  {
    id: "roadside-network-chicago",
    name: "Roadside Network Chicago",
    operatorType: "third_party_partner",
    markets: ["chicago"],
    serviceTypes: ["tow", "lockout", "fuel_delivery", "battery_jump_emergency", "flat_tire_emergency"],
    availability: "24/7",
    slaEstimate: "30–60 min typical partner ETA",
    coverage: "Chicago metro and close-in suburbs",
    contactChannels: [
      { type: "phone", label: "Call partner dispatch", value: "(312) 555-0199" },
      { type: "url", label: "Open partner intake", value: "https://partners.example.com/rego/chicago-roadside" },
    ],
    disclosure: "Roadside Network Chicago is a third-party roadside operator. ReGo does not operate towing, lockout, fuel delivery, emergency flat-tire response, or emergency battery dispatch.",
  },
  {
    id: "national-roadside-app",
    name: "National Roadside App",
    operatorType: "third_party_partner",
    markets: ["chicago", "detroit", "indianapolis", "milwaukee", "national_fallback"],
    serviceTypes: ["tow", "lockout", "fuel_delivery", "battery_jump_emergency", "flat_tire_emergency"],
    availability: "App-based partner coverage varies by driver supply",
    slaEstimate: "45–90 min estimated partner ETA",
    coverage: "Multi-market app handoff fallback",
    contactChannels: [
      { type: "app", label: "Open partner app", value: "national-roadside://rego-handoff" },
      { type: "url", label: "Web handoff", value: "https://partners.example.com/rego/national-roadside" },
    ],
    disclosure: "National Roadside App is a third-party roadside marketplace. ReGo only provides a handoff and does not dispatch or operate roadside services.",
  },
  {
    id: "safety-first-support",
    name: "Safety-first support guidance",
    operatorType: "support_guidance",
    markets: ["chicago", "detroit", "indianapolis", "milwaukee", "national_fallback"],
    serviceTypes: ["unsafe_location"],
    availability: "Immediate safety guidance",
    slaEstimate: "Call 911 or local emergency services now if anyone is in danger",
    coverage: "All markets as safety guidance only",
    contactChannels: [
      { type: "phone", label: "Emergency services", value: "911" },
      { type: "support", label: "ReGo support note", value: "support-placeholder@rego.example" },
    ],
    disclosure: "If you are in an unsafe location, contact emergency services first. ReGo is not an emergency response operator and will not dispatch a ReGo provider for roadside emergencies.",
  },
];

export default roadsidePartners;
