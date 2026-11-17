import Link from "next/link";
import type { Metadata } from "next";
import { CATERING_PHONE, CATERING_PHONE_DISPLAY, CHEF_NAME, tel } from "@/data/contact";
import "@/app/crm/crm.css";
import "../event.css";

/**
 * Stable "request received" URL. The form swaps the address bar to this path
 * after a successful submit (so ad platforms can count conversions by URL);
 * this page is what a reload or a bookmark of that URL shows. Never indexed.
 */
export const metadata: Metadata = {
  title: "Request received",
  robots: { index: false, follow: false },
};

export default function InquiryThanksPage() {
  return (
    <main className="inquiry-root event-root">
      <div className="inquiry-wrap">
        <Link href="/" className="event-back">← The Chef Catering</Link>
        <section className="crm-panel event-success" style={{ marginTop: 36 }}>
          <p className="event-kicker">Request received</p>
          <h1>Thank you — {CHEF_NAME} has your request.</h1>
          <p>
            Chef reviews every request personally and will contact you to confirm availability and the details.
            Nothing is reserved until Chef confirms it with you.
          </p>
          <p className="event-fine">
            Need to add something or have a close date? Call{" "}
            <a href={tel(CATERING_PHONE)}>{CATERING_PHONE_DISPLAY}</a>.
          </p>
          <Link href="/">Return to the website</Link>
        </section>
      </div>
    </main>
  );
}
