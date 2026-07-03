import type { Metadata } from "next";
import Link from "next/link";
import GalleryGrid from "@/components/GalleryGrid";
import BodyClass from "@/components/BodyClass";
import { BRAND } from "@/data/contact";

export const metadata: Metadata = {
  title: "Gallery — The Chef in Action",
  description:
    "Signature dishes, live event setups, and happy clients. See The Chef Catering Services' five-star plating, luxury spreads, and the people we serve.",
  alternates: { canonical: "/gallery" },
  openGraph: {
    title: "Gallery — The Chef in Action",
    description: "Signature dishes, live events, and happy clients — the world behind every five-star experience.",
    images: [{ url: "/assets/chef_at_island.jpg" }],
  },
};

export default function GalleryPage() {
  return (
    <>
      <BodyClass className="gallery-page" />

      {/* NAV */}
      <nav className="gallery-nav">
        <Link className="nav-logo-wrap" href="/">
          <img className="nav-logo-img" src="/assets/the-logo.jpg" alt="The Chef Catering Services logo" />
          <div>
            <div className="nav-logo-text">{BRAND.catering}</div>
            <div className="nav-logo-sub">{BRAND.tagline}</div>
          </div>
        </Link>
        <Link className="nav-back" href="/">
          <svg viewBox="0 0 24 24"><polyline points="15,18 9,12 15,6" /></svg>
          Back to Site
        </Link>
      </nav>

      <GalleryGrid />
    </>
  );
}
