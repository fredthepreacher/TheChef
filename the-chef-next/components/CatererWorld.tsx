"use client";

import Link from "next/link";
import CatererMenu from "./CatererMenu";
import ReviewsPreview from "./ReviewsPreview";
import BookingCTA from "./BookingCTA";

/** The caterer side of the split-screen — luxury catering brand world. */
export default function CatererWorld({ navVisible }: { navVisible: boolean }) {
  return (
    <section className="world caterer" id="catererWorld">
      <nav className={`nav caterer-nav${navVisible ? " visible" : ""}`} id="catererNav">
        <div className="nav-inner">
          <span className="nav-logo">The Chef</span>
          <a className="nav-link" href="#caterer-about">About</a>
          <a className="nav-link" href="#caterer-menu">Menu</a>
          <a className="nav-link" href="#caterer-reviews">Reviews</a>
          <Link className="nav-link" href="/gallery">Our Work</Link>
          <a className="nav-link btn-primary" href="#caterer-book" style={{ padding: "8px 16px", fontSize: 11 }}>
            Book Now
          </a>
        </div>
      </nav>

      <div className="caterer-hero-wrap">
        <img
          className="portrait chef-img"
          src="/assets/chef-caterer.jpg"
          alt="The Chef — private chef and luxury caterer in the kitchen"
        />
        <div className="hero-inline">
          <p className="eyebrow">Private Chef · Luxury Catering · Crafted With Soul</p>
          <div className="hero-divider"></div>
          <h1 className="hero-name">The Chef</h1>
          <p className="hero-sub">
            Unforgettable food experiences for private events, celebrations, and every occasion worth savoring.
          </p>
          <div className="cta-row">
            <a className="btn-primary" href="#caterer-menu">View Menu</a>
            <a className="btn-ghost" href="#caterer-book">Book Catering</a>
          </div>
        </div>
      </div>

      <div className="page-sections">
        {/* ABOUT */}
        <section className="section" id="caterer-about">
          <p className="section-tag">The Story</p>
          <h2 className="section-title">
            More Than a Meal.<br />It&apos;s an Experience.
          </h2>
          <div className="about-grid">
            <div className="about-text">
              <p>
                The Chef brings bold flavors, refined technique, and genuine passion to every plate. From intimate
                family dinners to large-scale private events, every detail is crafted to leave a lasting impression.
              </p>
              <p>
                With a background rooted in soulful cooking and elevated presentation, the service bridges comfort
                food tradition with luxury execution — plated beautifully and served with professionalism.
              </p>
              <p>
                Available for private dinners, corporate events, church gatherings, celebrations, and custom catering
                packages.
              </p>
            </div>
            <div className="about-stats">
              <div className="stat-card"><div className="stat-num">200+</div><div className="stat-label">Events Catered</div></div>
              <div className="stat-card"><div className="stat-num">5★</div><div className="stat-label">Avg. Client Rating</div></div>
              <div className="stat-card"><div className="stat-num">8+</div><div className="stat-label">Years Experience</div></div>
              <div className="stat-card"><div className="stat-num">12</div><div className="stat-label">Signature Dishes</div></div>
            </div>
          </div>
        </section>

        {/* LUXURY MENU (accordion cards, menu docs, packages, CTA) */}
        <CatererMenu />

        {/* REVIEWS PREVIEW */}
        <ReviewsPreview />

        {/* BOOKING CTA */}
        <BookingCTA />

        <footer className="site-footer">
          <span className="footer-logo">The Chef Catering</span>
          <span>© 2025 The Chef Catering · All Rights Reserved</span>
        </footer>
      </div>
    </section>
  );
}
