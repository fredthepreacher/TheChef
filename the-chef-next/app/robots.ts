import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://thechef.vercel.app/sitemap.xml", // TODO: replace with the final custom domain
  };
}
