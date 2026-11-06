import Link from "next/link";
import type { Metadata } from "next";
import InquiryForm from "@/components/catering/InquiryForm";
import { packageOptions } from "@/lib/crm/domain";
import { CATERING_PHONE, CATERING_PHONE_DISPLAY, tel } from "@/data/contact";
import "@/app/crm/crm.css";
export const metadata: Metadata = {
  title: "Catering Inquiry",
  description:
    "Tell Chef Frankie about your catering event, menu and guest count.",
};
export default async function InquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string }>;
}) {
  const p = await searchParams;
  const selected = packageOptions.find((v) => v === p.package) ?? "Unsure";
  return (
    <main className="inquiry-root">
      <div className="inquiry-wrap">
        <Link href="/">← The Chef Catering</Link>
        <p className="crm-eyebrow" style={{ marginTop: 36 }}>
          Five star meals · served with love
        </p>
        <h1>
          Let’s create your
          <br />
          next unforgettable occasion.
        </h1>
        <p>
          Share a few details and Chef will follow up to discuss availability,
          your menu and a custom quote.
        </p>
        <p>
          Prefer to talk?{" "}
          <Link href={tel(CATERING_PHONE)}>{CATERING_PHONE_DISPLAY}</Link>
        </p>
        <InquiryForm selectedPackage={selected} />
      </div>
    </main>
  );
}
