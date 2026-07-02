export const CREATE_XYZ_HERO_ASSET = "/images/createxyz-hero-mechanic-card.png";

export const CUSTOMER_NAV_ITEMS = [
  { label: "Service Area", href: "#service-area" },
  { label: "About Us", href: "#about" },
  { label: "Mechanic Sign Up", href: "#mechanic-signup-info" },
];

export const HERO_SERVICES = [
  { id: "oil-change", name: "Oil Change", icon: "▰", engineServiceId: "oil-change" },
  { id: "brakes", name: "Brakes", icon: "◎", engineServiceId: "brakes" },
  { id: "battery", name: "Battery", icon: "▣", engineServiceId: "diagnostic" },
  { id: "tow", name: "Car Tow", icon: "⚑", engineServiceId: null, partnerOnly: true },
  { id: "pickup", name: "Schedule a Pick Up", icon: "▾", engineServiceId: "inspection" },
  { id: "other", name: "Other Services", icon: "•••", engineServiceId: "diagnostic" },
];

export const SCHEDULE_OPTIONS = [
  {
    label: "Specific Date and Time",
    helper: "Pick a preferred appointment window.",
  },
  {
    label: "Flexible Days and Time",
    helper: "Give ReGo room to match the easiest provider slot.",
  },
  {
    label: "Earliest Available",
    helper: "Use the soonest eligible vetted provider.",
  },
];

export const LOCATION_TYPES = ["Home", "Work", "Other", "Garage", "Driveway", "Parking Lot"];

export const CREATE_XYZ_FIDELITY_NOTES = {
  hero: "Uses a local crop from Screenshots/Screenshot 2025-01-29 145902.png for the right-side mechanic photo card; no remote image dependency.",
  roadside: "Car Tow stays visually present but is partner-only and never creates a normal ReGo booking.",
  nav: "Customer nav keeps the create.xyz Mechanic Sign Up label but routes to provider-interest copy, not provider/dispatch demo controls.",
};
