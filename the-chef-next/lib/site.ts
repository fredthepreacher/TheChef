/**
 * Canonical site origin + indexing policy.
 *
 * NEXT_PUBLIC_SITE_URL must be set to the purchased custom domain before the
 * production launch (e.g. https://example.com — no trailing slash). Until
 * then the current Vercel production alias is used.
 *
 * Only a Vercel *production* deployment is indexable. Previews, branch
 * deployments and local builds send noindex + disallow-all robots so the
 * staging site never competes with the real domain in search.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://thechef-zeta.vercel.app").replace(/\/+$/, "");

export const SITE_INDEXABLE =
  process.env.VERCEL_ENV === "production" || process.env.SITE_INDEXABLE === "true";
