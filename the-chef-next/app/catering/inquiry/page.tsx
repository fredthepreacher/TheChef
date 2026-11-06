import Link from "next/link";
import type { Metadata } from "next";
import InquiryForm from "@/components/catering/InquiryForm";
import { packageOptions } from "@/lib/crm/domain";
import { CATERING_PHONE, CATERING_PHONE_DISPLAY, CHEF_NAME, tel } from "@/data/contact";
import "@/app/crm/crm.css";
import "./event.css";

export const metadata: Metadata = {
  title: "Build My Event — Catering Request",
  description:
    "Build your catering menu and tell Chef Frankie about your event. Chef reviews availability, confirms your selections and sends a custom quote.",
  alternates: { canonical: "/catering/inquiry" },
};

const SERVICES = ["drop_off", "full_service", "private_chef", "unsure"] as const;

export default async function InquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string; service?: string }>;
}) {
  const p = await searchParams;
  const selected = packageOptions.find((v) => v === p.package) ?? "Unsure";
  const service = SERVICES.find((v) => v === p.service) ?? "unsure";
  return (
    <main className="inquiry-root event-root">
      <div className="inquiry-wrap">
        <Link href="/" className="event-back">← The Chef Catering</Link>
        <p className="crm-eyebrow" style={{ marginTop: 36 }}>
          Five star meals · served with love
        </p>
        <h1>Build My Event</h1>
        <p className="event-lede">
          Build your menu and tell {CHEF_NAME} about your event. We&apos;ll review availability, confirm your
          selections, and send your custom quote.
        </p>
        <ol className="event-progress" aria-label="How it works">
          <li>Choose your menu</li>
          <li>Event details</li>
          <li>Chef sends your quote</li>
          <li>Deposit locks your date</li>
        </ol>
        <p className="event-call">
          Prefer to talk? <a href={tel(CATERING_PHONE)}>{CATERING_PHONE_DISPLAY}</a>
        </p>
        <InquiryForm selectedPackage={selected} initialService={service} />
      </div>
    </main>
  );
}
