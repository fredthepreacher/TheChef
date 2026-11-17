/**
 * Thanksgiving 2026 feast offer — the single source for the /thanksgiving
 * landing page, the Thanksgiving mode of Build My Event, and the server-side
 * order summary + price snapshot written to the CRM lead.
 *
 * Source: Chef's own carousel designs (cards 1–4 of
 * chef_thanksgiving_carousel_ads_2026.zip, "client-supplied designs, not
 * redrawn"). CLIENT-PROVIDED, NOT YET CONFIRMED FOR PUBLICATION: the ad guide
 * itself asks Chef to verify prices, servings, menu, the Nov 20 cutoff and
 * the free-pie terms first.
 *
 * Gate: while `approved` is false the page and the Thanksgiving form mode
 * exist on previews/local only (with a draft notice); a production deployment
 * returns 404 for /thanksgiving and ignores the Thanksgiving query params.
 */

export type FeastId = "intimate" | "family" | "gathering" | "grand";

export type Feast = {
  id: FeastId;
  name: string;
  /** CRM `package_interest` value (must exist in lib/crm/domain.ts → packageOptions). */
  packageInterest:
    | "Thanksgiving Intimate Feast"
    | "Thanksgiving Family Feast"
    | "Thanksgiving Gathering Feast"
    | "Thanksgiving Grand Feast";
  minGuests: number;
  maxGuests: number;
  price: number;
  mains: string;
  sides: number;
  pies: number;
  /** Intimate Feast: "Cornbread or biscuits" (guest picks one). */
  breadChoice: boolean;
};

export const THANKSGIVING = {
  /** Flip to true only after Chef confirms prices, servings, menu, cutoff,
   *  how orders are received (pickup/delivery/area) and payment terms. */
  approved: false,
  year: 2026,
  /** Thanksgiving Day 2026 (4th Thursday of November). */
  dayISO: "2026-11-26",
  /** "Order by Nov 20" from the client's cards. */
  orderByISO: "2026-11-20",
  /** Chef's original cards said "FREE PIE!" (undefined terms; every feast
   *  already includes pies). The final ad creative dropped it (Nov 9), so this
   *  stays null and the site makes no free-pie claim unless Chef defines one. */
  freePieTerms: null as string | null,
  /** Pickup / delivery / service area — unknown, so nothing is promised. */
  fulfilmentNote: null as string | null,
  feasts: [
    {
      id: "intimate",
      name: "The Intimate Feast",
      packageInterest: "Thanksgiving Intimate Feast",
      minGuests: 6,
      maxGuests: 8,
      price: 350,
      mains: "Herb-roasted turkey & gravy",
      sides: 3,
      pies: 1,
      breadChoice: true,
    },
    {
      id: "family",
      name: "The Family Feast",
      packageInterest: "Thanksgiving Family Feast",
      minGuests: 9,
      maxGuests: 12,
      price: 500,
      mains: "Herb-roasted turkey & gravy",
      sides: 4,
      pies: 2,
      breadChoice: false,
    },
    {
      id: "gathering",
      name: "The Gathering Feast",
      packageInterest: "Thanksgiving Gathering Feast",
      minGuests: 13,
      maxGuests: 16,
      price: 650,
      mains: "Turkey & slow-smoked brisket",
      sides: 5,
      pies: 3,
      breadChoice: false,
    },
    {
      id: "grand",
      name: "The Grand Feast",
      packageInterest: "Thanksgiving Grand Feast",
      minGuests: 17,
      maxGuests: 20,
      price: 750,
      mains: "Turkey & slow-smoked brisket",
      sides: 6,
      pies: 3,
      breadChoice: false,
    },
  ] satisfies Feast[] as Feast[],
  sides: [
    "Cornbread Stuffing",
    "Mashed Potatoes & Gravy",
    "Candied Sweet Potatoes",
    "Baked Mac & Cheese",
    "Collard Greens",
    "Mixed Vegetables",
    "Rice & Peas",
    "Corn on the Cob",
    "Garden Salad",
  ],
  pies: ["Pumpkin", "Pecan", "Apple", "Cherry", "Key Lime", "Chocolate Silk"],
  breads: ["Cornbread", "Biscuits"],
};

export const feastById = (id: string | undefined | null) =>
  THANKSGIVING.feasts.find((f) => f.id === id);

export const feastByPackage = (pkg: string | undefined | null) =>
  THANKSGIVING.feasts.find((f) => f.packageInterest === pkg);

export const isThanksgivingPackage = (pkg: string) => Boolean(feastByPackage(pkg));

/** What each feast includes, as display lines. */
export function feastIncludes(f: Feast): string[] {
  return [
    f.mains,
    `${f.sides} holiday sides`,
    f.breadChoice ? "Cornbread or biscuits" : "Cornbread & biscuits",
    `${f.pies} homemade ${f.pies === 1 ? "pie" : "pies"}`,
  ];
}

export const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/** "Friday, November 20" style label for an ISO date (no timezone drift). */
export function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export type ThanksgivingOrder = {
  feast: FeastId;
  sides: string[];
  pies: string[];
  bread: string;
};

/**
 * Server-side summary folded into `menu_notes` (→ event menu workspace).
 * Built from validated catalog values only, so the advertised price on the
 * lead cannot be edited by the browser.
 */
export function composeThanksgivingNotes(order: ThanksgivingOrder, guestNotes: string) {
  const f = feastById(order.feast)!;
  const lines = [
    `Thanksgiving ${THANKSGIVING.year} order request — ${f.name} (serves ${f.minGuests}–${f.maxGuests}, listed at ${usd(f.price)})`,
    `Sides (${order.sides.length} of ${f.sides}): ${order.sides.join(", ") || "Chef to suggest"}`,
    `Pies (${order.pies.length} of ${f.pies}): ${order.pies.join(", ") || "Chef to suggest"}`,
  ];
  if (f.breadChoice) lines.push(`Bread: ${order.bread || "either"}`);
  const notes = guestNotes.trim();
  return notes ? `${lines.join("\n")}\n\nGuest notes:\n${notes}` : lines.join("\n");
}

/** Package snapshot stored on the lead (what the guest saw when ordering). */
export function feastSnapshot(f: Feast) {
  return {
    badge: f.packageInterest,
    occasion: `thanksgiving-${THANKSGIVING.year}`,
    guests: `Serves ${f.minGuests}–${f.maxGuests}`,
    price: { prefix: "", strong: usd(f.price) },
    features: feastIncludes(f),
  };
}
