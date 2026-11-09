/**
 * First-party campaign attribution (browser only).
 *
 * When a visitor lands from an ad or a tagged link, the UTM parameters and
 * ad-click IDs are kept in sessionStorage for the visit and sent with the
 * catering request (validated by lib/crm/domain.ts → attributionSchema and
 * stored in leads.inquiry). Nothing personal is read or stored here, and the
 * latest tagged landing wins. Storage failures are ignored.
 */

const KEY = "chef.attribution.v1";
export const ATTRIBUTION_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
] as const;

export type Attribution = Partial<Record<(typeof ATTRIBUTION_PARAMS)[number], string>> & {
  landing_path?: string;
  captured_at?: string;
  /** Meta browser/click cookies — only exist once a Meta Pixel (via GTM) runs. */
  fbc?: string;
  fbp?: string;
};

/** Record campaign params from the current URL, if it carries any. */
export function captureAttribution() {
  try {
    const url = new URL(window.location.href);
    const found: Attribution = {};
    for (const k of ATTRIBUTION_PARAMS) {
      const v = url.searchParams.get(k);
      if (v) found[k] = v.slice(0, 300);
    }
    if (!Object.keys(found).length) return;
    found.landing_path = url.pathname.slice(0, 300);
    found.captured_at = new Date().toISOString();
    window.sessionStorage.setItem(KEY, JSON.stringify(found));
  } catch {
    /* storage blocked — attribution is best-effort */
  }
}

function cookie(name: string) {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)).slice(0, 300) : undefined;
}

/** Stored campaign params plus Meta's _fbc/_fbp cookies, read at submit time. */
export function readAttribution(): Attribution | undefined {
  let v: Attribution = {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Attribution) : undefined;
    if (parsed && typeof parsed === "object") v = parsed;
  } catch {
    /* ignore */
  }
  try {
    const fbc = cookie("_fbc");
    const fbp = cookie("_fbp");
    if (fbc) v.fbc = fbc;
    if (fbp) v.fbp = fbp;
  } catch {
    /* ignore */
  }
  return Object.keys(v).length ? v : undefined;
}
