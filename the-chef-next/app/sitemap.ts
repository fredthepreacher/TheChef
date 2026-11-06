import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/catering/inquiry`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/gallery`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/reviews`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
