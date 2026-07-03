/**
 * Gallery data — single source of truth for grid cards AND lightbox.
 * (The old gallery.html kept two separate lists whose indexes had
 * drifted out of sync; driving both from this array fixes that.)
 *
 * Photo placement rules (per brand guidelines):
 * - Signature Dishes: food only, no people
 * - Events & Setup: event/setup photos only
 * - Happy Clients: people only
 * - Hero image reserved for chef_at_island.jpg
 * - No duplicate photos across sections
 */

export type GalleryCategory = "food" | "events" | "people";

export type GalleryImage = {
  src: string;
  alt: string;
  caption: string;
  category: GalleryCategory;
  /** Optional extra info for event/people cards */
  tag?: string;
  description?: string;
};

export const heroImage = {
  src: "/assets/chef_at_island.jpg",
  alt: "The Chef crafting a luxury catering spread",
};

/** Signature Dishes — hero trio */
export const foodHero: GalleryImage[] = [
  { src: "/assets/lamb_chops_presentation.jpg", alt: "Lamb chops with lobster tail and asparagus", caption: "Lamb Chops & Lobster Tail", category: "food" },
  { src: "/assets/lobster_presentation.jpg", alt: "Grilled lobster tail plate", caption: "Grilled Lobster Tail", category: "food" },
  { src: "/assets/food_boil.jpg", alt: "Seafood boil with shrimp, crab and sides", caption: "Seafood Boil Plate", category: "food" },
];

/** Signature Dishes — masonry row */
export const foodMasonry: GalleryImage[] = [
  { src: "/assets/plantains.jpg", alt: "Caramelized plantains on a serving tray", caption: "Caramelized Plantains", category: "food" },
  { src: "/assets/presentation_10.jpg", alt: "Plated signature appetizer bites", caption: "Signature Bites", category: "food" },
  { src: "/assets/presentation_1.jpg", alt: "Dessert trifle cups with strawberries", caption: "Dessert Trifle Cups", category: "food" },
  { src: "/assets/group36.jpg", alt: "Wonton and herb dish close-up", caption: "Wonton Herb Creation", category: "food" },
  { src: "/assets/presentation_7.jpg", alt: "Charcuterie and fruit spread", caption: "Charcuterie & Fruit Board", category: "food" },
  { src: "/assets/presentation_9.jpg", alt: "Tiered fruit cup display", caption: "Tiered Fruit Display", category: "food" },
];

/** Signature Dishes — 4-col strip */
export const foodStrip: GalleryImage[] = [
  { src: "/assets/dessert2.jpg", alt: "Pastry board with muffins and chocolate strawberries", caption: "Dessert Board", category: "food" },
  { src: "/assets/dessert_presentation.jpg", alt: "Signature dessert presentation", caption: "Signature Desserts", category: "food" },
  { src: "/assets/presentation_8.jpg", alt: "Pastry and macaron spread", caption: "Pastry Spread", category: "food" },
  { src: "/assets/presentation_4.jpg", alt: "Colorful catering fruit and appetizer spread", caption: "Catering Spread", category: "food" },
];

/** Signature Dishes — final masonry */
export const foodFinal: GalleryImage[] = [
  { src: "/assets/oxtail.png", alt: "Braised oxtail in savory sauce", caption: "Braised Oxtail", category: "food" },
  { src: "/assets/spaghetti_meatballs.png", alt: "Spaghetti and meatballs with melted cheese", caption: "Spaghetti & Meatballs", category: "food" },
  { src: "/assets/presentation_2.jpg", alt: "Full catering counter spread", caption: "Full Catering Spread", category: "food" },
];

/** Events & Setup */
export const eventImages: GalleryImage[] = [
  {
    src: "/assets/catering1.jpg",
    alt: "Gallery arts corporate catering event",
    caption: "Gallery & Arts Catering",
    category: "events",
    tag: "Corporate Event",
    description: "Upscale appetizer service for a private gallery opening",
  },
  {
    src: "/assets/outside.jpg",
    alt: "Outdoor community catering buffet",
    caption: "Outdoor Community Feast",
    category: "events",
    tag: "Community Event",
    description: "Full buffet setup for a community gathering at the park",
  },
  {
    src: "/assets/fire_rescue.jpg",
    alt: "The Chef catering for the City of North Port Fire Rescue team",
    caption: "Feeding First Responders — North Port Fire Rescue",
    category: "events",
    tag: "Community Service",
    description: "Proud to serve the men and women of North Port Fire Rescue",
  },
];

/** Happy Clients */
export const peopleImages: GalleryImage[] = [
  {
    src: "/assets/group33.jpg",
    alt: "Chef and catering team at Visual Arts Center event",
    caption: "Visual Arts Center Event",
    category: "people",
    tag: "Arts Center Event",
    description: "The team after a successful gallery catering",
  },
  {
    src: "/assets/group35.jpg",
    alt: "Chef with clients at private kitchen event",
    caption: "Kitchen Side Moments",
    category: "people",
    tag: "Private Event",
    description: "Every client becomes part of the story",
  },
  {
    src: "/assets/pplserved.jpg",
    alt: "The Chef with a group of clients, women and children",
    caption: "The People We Serve",
    category: "people",
    tag: "Community Connection",
    description: "Family, community, and every occasion worth celebrating",
  },
];

/** Flat list in display order — lightbox navigates through this. */
export const allImages: GalleryImage[] = [
  ...foodHero,
  ...foodMasonry,
  ...foodStrip,
  ...foodFinal,
  ...eventImages,
  ...peopleImages,
];

/** Lightbox index of an image within the flat list. */
export const lightboxIndex = (img: GalleryImage) =>
  allImages.findIndex((i) => i.src === img.src);
