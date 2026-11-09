import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { THANKSGIVING } from "@/data/thanksgiving";
import { PRIVACY_NOTICE_APPROVED } from "@/data/launch";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/catering/inquiry`, changeFrequency: "monthly", priority: 0.9 },
    // Owner-gated pages appear only once approved.
    ...(THANKSGIVING.approved
      ? [{ url: `${SITE_URL}/thanksgiving`, changeFrequency: "weekly" as const, priority: 0.9 }]
      : []),
    { url: `${SITE_URL}/gallery`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/reviews`, changeFrequency: "monthly", priority: 0.8 },
    ...(PRIVACY_NOTICE_APPROVED
      ? [{ url: `${SITE_URL}/privacy`, changeFrequency: "yearly" as const, priority: 0.2 }]
      : []),
  ];
}
