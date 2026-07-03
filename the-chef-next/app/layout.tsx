import type { Metadata } from "next";
import "./globals.css";
import { CATERING_EMAIL, CATERING_PHONE_DISPLAY } from "@/data/contact";

export const metadata: Metadata = {
  metadataBase: new URL("https://thechef.vercel.app"), // TODO: replace with the final custom domain
  title: {
    default: "The Chef | Luxury Catering & Music",
    template: "%s | The Chef",
  },
  description:
    "The Chef — private chef, luxury event catering, and original music. Unforgettable food experiences for weddings, corporate events, and celebrations, plus bold original sound from The Chef Music.",
  keywords: [
    "private chef",
    "luxury catering",
    "event catering",
    "wedding catering",
    "corporate catering",
    "The Chef Catering Services",
    "The Chef Music",
  ],
  openGraph: {
    title: "The Chef | Luxury Catering & Music",
    description:
      "One name, two crafts: luxury private-chef catering and original music. Book The Chef for your next unforgettable event.",
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
    title: "The Chef | Luxury Catering & Music",
    description:
      "Luxury private-chef catering and original music. Book The Chef for your next unforgettable event.",
    images: ["/assets/chef_at_island.jpg"],
  },
};

/** JSON-LD structured data — helps Google & AI search understand the business. */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FoodEstablishment",
  name: "The Chef Catering Services",
  alternateName: "The Chef",
  description:
    "Private chef and luxury catering for weddings, corporate events, church gatherings, and celebrations. Five star meals, served with love.",
  email: CATERING_EMAIL,
  telephone: "+1-314-500-3601",
  servesCuisine: ["Soul Food", "Caribbean", "American", "Seafood"],
  priceRange: "$$-$$$",
  image: "/assets/chef_at_island.jpg",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5",
    reviewCount: "9",
  },
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
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&family=Cinzel:wght@400;700;900&display=swap"
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
