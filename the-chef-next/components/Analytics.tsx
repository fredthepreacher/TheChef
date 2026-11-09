"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { captureAttribution } from "@/lib/attribution";
import { ANALYTICS_ENABLED, CONSENT_DEFAULT, GTM_ID, isUntrackedPath, trackCallClick } from "@/lib/analytics";

/**
 * Site-wide measurement shell (contract: lib/analytics.ts).
 * - Always (first-party, no network): records campaign params from tagged
 *   landing URLs for the catering request.
 * - Only when NEXT_PUBLIC_GTM_ID is set, and never on /crm, /proposal, /api:
 *   sets Consent Mode v2 defaults, loads the GTM container and counts tel:
 *   link clicks. GTM handles page views (incl. client-side navigations).
 */
export default function Analytics() {
  const pathname = usePathname() ?? "/";
  const untracked = isUntrackedPath(pathname);

  useEffect(() => {
    if (!untracked) captureAttribution();
  }, [pathname, untracked]);

  useEffect(() => {
    if (!ANALYTICS_ENABLED || untracked) return;
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="tel:"]');
      if (link) trackCallClick(window.location.pathname);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [untracked]);

  if (!ANALYTICS_ENABLED || untracked) return null;
  const c = JSON.stringify(CONSENT_DEFAULT);

  return (
    <>
      {/* No-JS fallback (server-rendered; same path rules as the script). */}
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
          title="Google Tag Manager"
        />
      </noscript>
      <Script id="gtm" strategy="afterInteractive">
      {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}` +
        `gtag('consent','default',{ad_storage:${c},ad_user_data:${c},ad_personalization:${c},analytics_storage:${c},wait_for_update:500});` +
        `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});` +
        `var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;` +
        `j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})` +
        `(window,document,'script','dataLayer',${JSON.stringify(GTM_ID)});`}
      </Script>
    </>
  );
}
