import type { Metadata } from "next";
import Link from "next/link";
import ReviewsSection from "@/components/ReviewsSection";
import BodyClass from "@/components/BodyClass";
import { CATERING_EMAIL, CATERING_PHONE, BRAND, mailto, tel } from "@/data/contact";

export const metadata: Metadata = {
  title: "Client Reviews",
  description:
    "9 verified five-star reviews for The Chef Catering Services — weddings, baby showers, corporate events, and private dinners. Real clients, real experiences.",
  alternates: { canonical: "/reviews" },
  openGraph: {
    title: "Client Reviews | The Chef Catering Services",
    description: "Five-star reviews from weddings, corporate events, and private dinners.",
    images: [{ url: "/assets/client_photo_1.jpg" }],
  },
};

export default function ReviewsPage() {
  return (
    <>
      <BodyClass className="reviews-page" />

      {/* NAV */}
      <nav className="rv-nav">
        <Link className="rv-nav-brand" href="/">
          <img className="rv-nav-logo" src="/assets/the-logo.jpg" alt="The Chef Catering logo" />
          <div>
            <div className="rv-nav-name">{BRAND.catering}</div>
            <div className="rv-nav-sub">{BRAND.tagline}</div>
          </div>
        </Link>
        <Link className="rv-back" href="/">
          <svg viewBox="0 0 24 24"><polyline points="15,18 9,12 15,6" /></svg>
          Back to Site
        </Link>
      </nav>

      {/* HERO */}
      <div className="rv-hero">
        <span className="rv-hero-tag">Real Clients · Real Experiences</span>
        <h1 className="rv-hero-title">What Our Clients<br /><em>Are Saying</em></h1>
        <div className="rv-hero-rule">
          <span></span><span className="rv-rule-icon">✦</span><span></span>
        </div>
        <p className="rv-hero-sub">
          From intimate dinners to large celebrations, our clients trust The Chef to deliver unforgettable
          experiences — every single time.
        </p>
      </div>

      {/* TRUST BANNER */}
      <div className="rv-trust">
        <div className="rv-trust-item">
          <div>
            <div className="rv-trust-stars">★★★★★</div>
            <div className="rv-trust-text">5 Star Rating</div>
          </div>
        </div>
        <div className="rv-trust-item">
          <div>
            <div className="rv-trust-num">200+</div>
            <div className="rv-trust-text">Events Catered</div>
          </div>
        </div>
        <div className="rv-trust-item">
          <div className="rv-trust-text" style={{ textAlign: "center", lineHeight: 1.8 }}>
            Private Events &nbsp;·&nbsp; Corporate Catering<br />
            Weddings &nbsp;·&nbsp; Luxury Dining Experiences
          </div>
        </div>
        <div className="rv-trust-item">
          <div>
            <div className="rv-trust-num">8+</div>
            <div className="rv-trust-text">Years of Excellence</div>
          </div>
        </div>
      </div>

      {/* CLIENT PHOTO BANNER — preserves the corrected photo framing:
          left photo uses .guest-photo (center 22%), right photo uses
          .guest-photo-right (center top) so no heads get cropped. */}
      <div className="rv-photo-banner">
        <div className="rv-photo-card">
          <img className="guest-photo" src="/assets/client_photo_1.jpg" alt="The Chef with clients at a private event" />
          <div className="rv-photo-overlay">
            <div className="rv-photo-caption">
              <strong>The Chef &amp; Guests</strong>
              Private Dining · Five Star Experience
            </div>
          </div>
        </div>
        <div className="rv-photo-card">
          <img className="guest-photo-right" src="/assets/client_photo_2.jpg" alt="The Chef with a satisfied client" />
          <div className="rv-photo-overlay">
            <div className="rv-photo-caption">
              <strong>The Chef &amp; Clients</strong>
              Every Occasion, Delivered With Excellence
            </div>
          </div>
        </div>
      </div>

      {/* TESTIMONIALS */}
      <ReviewsSection />

      {/* CTA */}
      <div className="rv-cta">
        <p className="rv-cta-tag">✦ &nbsp; Ready to Create Your Own Experience? &nbsp; ✦</p>
        <h2 className="rv-cta-title">Join Our Growing Family<br />of Happy Clients</h2>
        <p className="rv-cta-sub">
          Every event is a new opportunity to exceed expectations. Let&apos;s create something unforgettable together.
        </p>
        <div className="rv-cta-btns">
          <a
            className="btn-primary"
            href={mailto(CATERING_EMAIL, "Quote Request")}
            style={{ background: "var(--gold)", color: "#0a0800", boxShadow: "0 8px 30px rgba(201,168,76,.30)" }}
          >
            Request a Quote
          </a>
          <a className="btn-ghost" href={tel(CATERING_PHONE)}>Schedule Consultation</a>
        </div>
      </div>

      <footer className="rv-footer">
        <span className="rv-footer-brand">{BRAND.cateringFull}</span>
        <span className="rv-footer-copy">© 2025 The Chef Catering Services · Five Star Meals on Wheels · All Rights Reserved</span>
      </footer>
    </>
  );
}
