import type { MetadataRoute } from "next";

const BASE = "https://thechef.vercel.app"; // TODO: replace with the final custom domain

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/gallery`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/reviews`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
