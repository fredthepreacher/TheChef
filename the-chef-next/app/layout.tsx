import type { Metadata } from "next";
import "./globals.css";
import "./launch.css";
import "./refine.css";
import { CATERING_EMAIL } from "@/data/contact";
import { SITE_INDEXABLE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  // Set NEXT_PUBLIC_SITE_URL to the purchased domain before launch (lib/site.ts).
  metadataBase: new URL(SITE_URL),
  // Previews / branch deployments / local builds are never indexed.
  robots: SITE_INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
  title: {
    default: "The Chef | Luxury Catering & Entertainment",
    template: "%s | The Chef",
  },
  description:
    "The Chef — private chef and luxury event catering by Chef Frankie, plus original music from The Chef, Entertainer. Build your menu and request a custom quote for weddings, corporate events, and celebrations.",
  keywords: [
    "private chef",
    "luxury catering",
    "event catering",
    "wedding catering",
    "corporate catering",
    "The Chef Catering Services",
    "The Chef Entertainer",
    "The Chef Music",
  ],
  openGraph: {
    title: "The Chef | Luxury Catering & Entertainment",
    description:
      "One name, two crafts: luxury private-chef catering and original music. Build your event menu and book The Chef.",
    type: "website",
    images: [
      {
        url: "/assets/chef_at_island.jpg",
        width: 1200,
        height: 630,
        alt: "The Chef crafting a luxury catering spread",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Chef | Luxury Catering & Entertainment",
    description:
      "Luxury private-chef catering and original music. Build your event menu and book The Chef.",
    images: ["/assets/chef_at_island.jpg"],
  },
};

/**
 * JSON-LD structured data — verified facts only. No self-served
 * aggregateRating (not eligible for LocalBusiness rich results and not
 * independently verified), no priceRange, and no address/areaServed until the
 * owner confirms the real service area.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FoodEstablishment",
  name: "The Chef Catering Services",
  alternateName: "The Chef",
  url: SITE_URL,
  description:
    "Private chef and luxury catering for weddings, corporate events, church gatherings, and celebrations. Five star meals, served with love.",
  email: CATERING_EMAIL,
  telephone: "+1-314-500-3601",
  servesCuisine: ["Soul Food", "Caribbean", "American", "Seafood"],
  image: `${SITE_URL}/assets/chef_at_island.jpg`,
  founder: { "@type": "Person", name: "Chef Frankie" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Same font set as the original site — visual identity preserved */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Syne:wght@500;600;700;800&family=DM+Sans:wght@300;400;500;700&family=Cinzel:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
