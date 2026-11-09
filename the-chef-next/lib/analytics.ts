/**
 * Ad measurement hooks — Google Tag Manager + dataLayer. INERT BY DEFAULT.
 *
 * Nothing loads and nothing is sent until the owner sets NEXT_PUBLIC_GTM_ID
 * in Vercel. GA4, Google Ads and Meta Pixel tags are configured inside that
 * GTM container (not in this code). Do not set the ID before the privacy
 * notice is approved (data/launch.ts → PRIVACY_NOTICE_APPROVED).
 *
 *   NEXT_PUBLIC_GTM_ID                   e.g. GTM-XXXXXXX
 *   NEXT_PUBLIC_CONSENT_DEFAULT          Consent Mode v2 defaults:
 *                                        "denied" (code default) — all denied
 *                                        "granted" — all granted
 *                                        "region" (intended production setting)
 *                                          — granted globally, but ad signals
 *                                          denied when the browser sends Global
 *                                          Privacy Control, and everything
 *                                          denied in the EEA, UK and CH
 *                                        ads_data_redaction is always on.
 *   NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION Search Console meta-tag token
 *                                        (app/layout.tsx; independent of GTM)
 *
 * dataLayer events (no names, emails, phone numbers or free text — ever):
 *   inquiry_start  { inquiry_kind: "catering" | "thanksgiving" }
 *                  → first interaction with the request form
 *   generate_lead  { event_id, package_interest, service_style, guest_count,
 *                    occasion, value?, currency? }
 *                  → once, only after the request POST succeeds. event_id is
 *                    the request's `request_id` UUID (also stored on the CRM
 *                    lead) for de-duplication with server-side events later.
 *                    value/currency only for priced Thanksgiving feasts.
 *   click_to_call  { link_page } → any tel: link click
 * Plus GTM's own page_view/history events. Never loaded on /crm, /proposal or
 * /api: operator screens and private proposal links (their URLs carry access
 * tokens) must not reach ad platforms.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export const GTM_ID = (process.env.NEXT_PUBLIC_GTM_ID ?? "").trim();
export const ANALYTICS_ENABLED = /^GTM-[A-Z0-9]+$/.test(GTM_ID);
const consentEnv = process.env.NEXT_PUBLIC_CONSENT_DEFAULT;
export const CONSENT_DEFAULT: "granted" | "denied" | "region" =
  consentEnv === "granted" || consentEnv === "region" ? consentEnv : "denied";

/** EU 27 + IS, LI, NO (EEA) + GB + CH — denied by default in "region" mode. */
export const CONSENT_DENIED_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO", "GB", "CH",
];

/**
 * The inline Consent Mode v2 bootstrap, run before gtm.js is queued.
 * Region-specific defaults take precedence over the global one in Google's
 * tags, so the order of the two default calls does not matter.
 */
export function consentBootstrap(mode: typeof CONSENT_DEFAULT): string {
  const all = (v: string) =>
    `{ad_storage:'${v}',ad_user_data:'${v}',ad_personalization:'${v}',analytics_storage:'${v}',wait_for_update:500}`;
  const lines: string[] = [];
  if (mode === "region") {
    lines.push(
      `var gpc=navigator.globalPrivacyControl===true?'denied':'granted';` +
        `gtag('consent','default',{ad_storage:gpc,ad_user_data:gpc,ad_personalization:gpc,analytics_storage:'granted'});`,
      `gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',region:${JSON.stringify(
        CONSENT_DENIED_REGIONS,
      )},wait_for_update:500});`,
    );
  } else {
    lines.push(`gtag('consent','default',${all(mode)});`);
  }
  // Redact ad-click identifiers wherever ad_storage ends up denied.
  lines.push(`gtag('set','ads_data_redaction',true);`);
  return lines.join("");
}

/** Paths that must never load or receive tracking. */
export const isUntrackedPath = (path: string) => /^\/(crm|proposal|api)(\/|$)/.test(path);

function push(event: string, params: Record<string, string | number | undefined>) {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  if (isUntrackedPath(window.location.pathname)) return;
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""));
  (window.dataLayer = window.dataLayer || []).push({ event, ...clean });
}

export function trackLead(e: {
  requestId: string;
  packageInterest: string;
  serviceStyle: string;
  guestCount: number;
  occasion: "catering" | "thanksgiving";
  value?: number;
}) {
  push("generate_lead", {
    event_id: e.requestId,
    package_interest: e.packageInterest,
    service_style: e.serviceStyle,
    guest_count: e.guestCount,
    occasion: e.occasion,
    value: e.value,
    currency: e.value ? "USD" : undefined,
  });
}

export function trackCallClick(path: string) {
  push("click_to_call", { link_page: path });
}

export function trackInquiryStart(kind: "catering" | "thanksgiving") {
  push("inquiry_start", { inquiry_kind: kind });
}
