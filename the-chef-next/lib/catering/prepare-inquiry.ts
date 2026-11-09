import { composeMenuNotes, type Inquiry } from "@/lib/crm/domain";
import { packages } from "@/data/menu";
import { composeThanksgivingNotes, feastById, feastSnapshot } from "@/data/thanksgiving";

/**
 * Validated request → the exact `p_inquiry` / `p_snapshot` pair handed to
 * submit_catering_inquiry (shared by the API route and the tests).
 * - Website dish picks (or a Thanksgiving feast order) are folded into
 *   `menu_notes` so they reach the event menu workspace without a migration.
 * - The package snapshot records what the guest saw when ordering; for a
 *   feast it is built from data/thanksgiving.ts, never from browser input.
 */
export function prepareInquiry(fields: Omit<Inquiry, "turnstile_token" | "website">) {
  const feast = fields.thanksgiving ? feastById(fields.thanksgiving.feast) : undefined;
  const inquiry = {
    ...fields,
    menu_notes:
      feast && fields.thanksgiving
        ? composeThanksgivingNotes(fields.thanksgiving, fields.menu_notes)
        : composeMenuNotes(fields.selected_menu_items, fields.menu_notes),
  };
  const snapshot = (feast && feastSnapshot(feast)) ??
    packages.find((p) => p.badge === inquiry.package_interest) ?? {
      badge: inquiry.package_interest,
      price: { prefix: "Custom", strong: "Pricing" },
    };
  return { inquiry, snapshot, feast };
}
