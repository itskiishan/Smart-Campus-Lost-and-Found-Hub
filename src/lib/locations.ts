export const CAMPUS_LOCATIONS = [
  "All Locations",
  // Ramanujan Block
  "Ramanujan Block - Ground Floor",
  "Ramanujan Block - 1st Floor",
  "Ramanujan Block - 2nd Floor",
  "Ramanujan Block - 3rd Floor",
  // Aryabhatta Block
  "Aryabhatta Block - Ground Floor",
  "Aryabhatta Block - 1st Floor",
  "Aryabhatta Block - 2nd Floor",
  "Aryabhatta Block - 3rd Floor",
  // Bhabha Block
  "Bhabha Block - Ground Floor",
  "Bhabha Block - 1st Floor",
  "Bhabha Block - 2nd Floor",
  "Bhabha Block - 3rd Floor",
  // Kalpana Chawla Block
  "Kalpana Chawla Block - Ground Floor",
  "Kalpana Chawla Block - 1st Floor",
  "Kalpana Chawla Block - 2nd Floor",
  "Kalpana Chawla Block - 3rd Floor",
  // Canteen
  "Canteen - Ground Floor",
  "Canteen - 1st Floor",
  // Other
  "Cricket Net",
] as const;

export type CampusLocation = (typeof CAMPUS_LOCATIONS)[number];

export const LOCATION_GROUPS = [
  {
    label: "Ramanujan Block",
    locations: CAMPUS_LOCATIONS.filter((l) => l.startsWith("Ramanujan")),
  },
  {
    label: "Aryabhatta Block",
    locations: CAMPUS_LOCATIONS.filter((l) => l.startsWith("Aryabhatta")),
  },
  {
    label: "Bhabha Block",
    locations: CAMPUS_LOCATIONS.filter((l) => l.startsWith("Bhabha")),
  },
  {
    label: "Kalpana Chawla Block",
    locations: CAMPUS_LOCATIONS.filter((l) => l.startsWith("Kalpana")),
  },
  {
    label: "Canteen",
    locations: CAMPUS_LOCATIONS.filter((l) => l.startsWith("Canteen")),
  },
  {
    label: "Other",
    locations: ["Cricket Net"] as const,
  },
] as const;

export const ITEM_CATEGORIES = [
  "All Categories",
  "Electronics",
  "Documents",
  "Keys",
  "Clothing",
  "Accessories",
  "Books",
  "Other",
] as const;
