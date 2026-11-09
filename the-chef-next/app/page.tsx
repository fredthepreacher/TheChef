import type { Metadata } from "next";
import SplitStage from "@/components/SplitStage";
import { THANKSGIVING } from "@/data/thanksgiving";
import { PRIVACY_NOTICE_APPROVED } from "@/data/launch";
import { visibleUnlessDraftInProduction } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "The Chef | Luxury Catering & Entertainment — One Name, Two Crafts" },
  description:
    "Drag to explore two worlds: The Chef Catering — private chef and luxury event catering with a menu you build yourself — and The Chef, Entertainer — original music and bold artistry.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <SplitStage
      seasonal={{
        thanksgiving: visibleUnlessDraftInProduction(THANKSGIVING.approved),
        privacy: visibleUnlessDraftInProduction(PRIVACY_NOTICE_APPROVED),
      }}
    />
  );
}
