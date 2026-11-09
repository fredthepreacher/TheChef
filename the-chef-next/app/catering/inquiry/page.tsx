import Link from "next/link";
import type { Metadata } from "next";
import InquiryForm from "@/components/catering/InquiryForm";
import { packageOptions } from "@/lib/crm/domain";
import { CATERING_PHONE, CATERING_PHONE_DISPLAY, CHEF_NAME, tel } from "@/data/contact";
import { THANKSGIVING, feastByPackage, feastById, longDate } from "@/data/thanksgiving";
import { PRIVACY_NOTICE_APPROVED } from "@/data/launch";
import { visibleUnlessDraftInProduction } from "@/lib/site";
import "@/app/crm/crm.css";
import "./event.css";

type Params = { package?: string; service?: string; occasion?: string; feast?: string };

const thanksgivingMode = (p: Params) =>
  visibleUnlessDraftInProduction(THANKSGIVING.approved) &&
  (p.occasion === "thanksgiving" || Boolean(feastById(p.feast) ?? feastByPackage(p.package)));

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const tg = thanksgivingMode(await searchParams);
  return {
    title: tg ? "Reserve Your Thanksgiving Feast" : "Build My Event — Catering Request",
    description: tg
      ? `Choose your Thanksgiving feast, sides and pies. Chef Frankie confirms every order. Order by ${longDate(THANKSGIVING.orderByISO)}.`
      : "Build your catering menu and tell Chef Frankie about your event. Chef reviews availability, confirms your selections and sends a custom quote.",
    alternates: { canonical: "/catering/inquiry" },
  };
}

const SERVICES = ["drop_off", "full_service", "private_chef", "unsure"] as const;

export default async function InquiryPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const p = await searchParams;
  const service = SERVICES.find((v) => v === p.service) ?? "unsure";
  // Thanksgiving mode: ?occasion=thanksgiving[&feast=family] (or a feast package
  // name in ?package=) — only while the offer is visible (owner gate).
  const tgFeast = feastById(p.feast) ?? feastByPackage(p.package);
  const thanksgiving = thanksgivingMode(p);
  const selected =
    packageOptions.find((v) => v === p.package && !v.startsWith("Thanksgiving ")) ?? "Unsure";
  return (
    <main className="inquiry-root event-root">
      <div className="inquiry-wrap">
        <Link href={thanksgiving ? "/thanksgiving" : "/"} className="event-back">
          {thanksgiving ? "← Thanksgiving feasts" : "← The Chef Catering"}
        </Link>
        <p className="crm-eyebrow" style={{ marginTop: 36 }}>
          Five star meals · served with love
        </p>
        {thanksgiving ? (
          <>
            <h1>Reserve Your Thanksgiving Feast</h1>
            <p className="event-lede">
              Choose your feast, sides and pies. {CHEF_NAME} confirms availability, your selections and the details
              with you before your order is final. Order by {longDate(THANKSGIVING.orderByISO)}.
            </p>
            <ol className="event-progress" aria-label="How it works">
              <li>Choose your feast</li>
              <li>Your details</li>
              <li>Chef confirms</li>
              <li>Your feast is reserved</li>
            </ol>
          </>
        ) : (
          <>
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
          </>
        )}
        <p className="event-call">
          Prefer to talk? <a href={tel(CATERING_PHONE)}>{CATERING_PHONE_DISPLAY}</a>
        </p>
        <InquiryForm
          selectedPackage={selected}
          initialService={service}
          thanksgivingFeast={thanksgiving ? (tgFeast?.id ?? "family") : null}
          privacyVisible={visibleUnlessDraftInProduction(PRIVACY_NOTICE_APPROVED)}
        />
      </div>
    </main>
  );
}
