import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATERING_EMAIL, CATERING_PHONE, CATERING_PHONE_DISPLAY, CHEF_NAME, mailto, tel } from "@/data/contact";
import { PRIVACY_NOTICE_APPROVED } from "@/data/launch";
import { SITE_INDEXABLE, visibleUnlessDraftInProduction } from "@/lib/site";
import "@/app/crm/crm.css";
import "@/app/catering/inquiry/event.css";

/**
 * DRAFT privacy notice — describes what this codebase actually does. Owner
 * review required (data/launch.ts → PRIVACY_NOTICE_APPROVED) before it goes
 * live and before NEXT_PUBLIC_GTM_ID is set. Not legal advice.
 */
export const metadata: Metadata = {
  title: "Privacy Notice",
  alternates: { canonical: "/privacy" },
  robots:
    PRIVACY_NOTICE_APPROVED && SITE_INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
};

export default function PrivacyPage() {
  if (!visibleUnlessDraftInProduction(PRIVACY_NOTICE_APPROVED)) notFound();
  return (
    <main className="inquiry-root event-root">
      <div className="inquiry-wrap privacy-doc">
        {!PRIVACY_NOTICE_APPROVED && (
          <p className="crm-notice" role="note">
            Draft for owner review — not yet published. Effective date to be set on approval.
          </p>
        )}
        <Link href="/" className="event-back">← The Chef</Link>
        <h1>Privacy Notice</h1>
        <p className="event-lede">
          This notice explains what The Chef Catering Services ({CHEF_NAME}) collects through this website and how it
          is used.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Your catering request.</strong> When you send a request we receive the details you enter: your name,
            email, phone, preferred contact method, event type, date, time, guest count, city and ZIP, venue details,
            menu choices, dietary notes, special requests, budget range and how you heard about us.
          </li>
          <li>
            <strong>Spam protection.</strong> The request form uses Cloudflare Turnstile, which checks your browser to
            tell people from bots. To limit abuse we keep one-way hashed (unreadable) versions of your network address
            and email for rate limiting.
          </li>
          <li>
            <strong>Facebook and Instagram lead forms.</strong> If you send a request through one of our lead forms on
            Facebook or Instagram, Meta passes us the details you enter there (such as your name, email and phone), and
            we use them the same way as a request sent on this website.
          </li>
          <li>
            <strong>How you found us.</strong> If you arrive through an ad or a tagged link, we keep the campaign details
            from that link (for example the ad source and campaign name, and an ad-click ID) with your request, so we
            know which ads bring us customers.
          </li>
          <li>
            <strong>Ad measurement (when switched on).</strong> We may use Google Tag Manager to run Google Analytics,
            Google Ads and Meta (Facebook/Instagram) measurement tags. These use cookies and similar technologies to
            measure visits and which ads lead to requests. We never send your name, email, phone number or request
            details to these services from this website. If your browser sends a Global Privacy Control signal, ad
            measurement is switched off for your visit, and visitors in the European Economic Area, the UK and
            Switzerland are not measured for ads by default.
          </li>
          <li>
            <strong>Your menu picks.</strong> Dishes you select on the menu are remembered in your own browser so you can
            finish your request later. They contain no personal details.
          </li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To respond to your request, prepare your quote or order and plan your event.</li>
          <li>To keep records of our bookings and payments.</li>
          <li>To prevent spam and abuse.</li>
          <li>To understand which of our ads and links bring us requests.</li>
        </ul>
        <p>We do not sell your personal information, and sending a request does not sign you up for marketing.</p>

        <h2>Who helps us</h2>
        <p>
          Our website and request system run on service providers that process data for us: Vercel (website hosting),
          Supabase (secure database), Cloudflare (spam protection), Meta (our Facebook and Instagram lead forms) and,
          when ad measurement is switched on, Google and Meta. Each processes data under its own terms and privacy
          policy.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>
            Ask us to see, correct or delete the information you sent: email{" "}
            <a href={mailto(CATERING_EMAIL, "Privacy request")}>{CATERING_EMAIL}</a> or call{" "}
            <a href={tel(CATERING_PHONE)}>{CATERING_PHONE_DISPLAY}</a>.
          </li>
          <li>
            You can block or delete cookies in your browser settings, and manage ad personalization in your Google and
            Meta account settings.
          </li>
        </ul>

        <h2>Keeping your information</h2>
        <p>
          We keep request and booking records for as long as we need them to serve you and to meet our business and
          legal record-keeping needs, then delete them.
        </p>

        <h2>Changes</h2>
        <p>If we change how we handle information, we will update this page.</p>
      </div>
    </main>
  );
}
