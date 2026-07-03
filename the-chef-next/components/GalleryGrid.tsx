"use client";

import { useState } from "react";
import Link from "next/link";
import {
  heroImage,
  foodHero,
  foodMasonry,
  foodStrip,
  foodFinal,
  eventImages,
  peopleImages,
  lightboxIndex,
  type GalleryImage,
  type GalleryCategory,
} from "@/data/gallery";
import { CATERING_EMAIL, BRAND, mailto } from "@/data/contact";
import Lightbox from "./Lightbox";

type Filter = "all" | GalleryCategory;

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Everything" },
  { id: "food", label: "Signature Dishes" },
  { id: "events", label: "Events & Setup" },
  { id: "people", label: "Happy Clients" },
];

/** Full gallery experience: cinematic hero, filters, curated sections, lightbox. */
export default function GalleryGrid() {
  const [filter, setFilter] = useState<Filter>("all");
  const [lbIndex, setLbIndex] = useState<number | null>(null);

  const open = (img: GalleryImage) => setLbIndex(lightboxIndex(img));
  const show = (cat: GalleryCategory) => filter === "all" || filter === cat;

  const gi = (img: GalleryImage, extraClass = "") => (
    <div
      key={img.src}
      className={`gi gi-gold-border ${extraClass}`}
      style={{ borderRadius: 10 }}
      onClick={() => open(img)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") open(img); }}
    >
      <img src={img.src} alt={img.alt} />
      <div className="gi-overlay"><span className="gi-label">{img.caption}</span></div>
    </div>
  );

  return (
    <>
      {/* CINEMATIC HERO — hidden when filtering, like the original */}
      {filter === "all" && (
        <div className="gallery-cinema-hero">
          <img src={heroImage.src} alt={heroImage.alt} />
          <div className="cinema-overlay">
            <div className="cinema-content">
              <p className="cinema-tag">Behind Every Plate</p>
              <h1 className="cinema-title">The Chef<br /><em>In Action</em></h1>
              <p className="cinema-sub">
                Precision. Passion. Presentation. Welcome to the world behind every five-star experience.
              </p>
            </div>
            <div className="cinema-logo">
              <img src="/assets/the-logo.jpg" alt="The Chef Catering Services logo" />
            </div>
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      <div className="gallery-filter-wrap">
        <div className="filter-bar">
          {filters.map((f) => (
            <button
              key={f.id}
              className={`filter-btn${filter === f.id ? " active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1 — SIGNATURE DISHES (food only) */}
      {show("food") && (
        <div className="gallery-section" data-cat="food" id="sec-food">
          <div className="section-header">
            <span className="section-tag">Signature Dishes</span>
            <h2 className="section-title">The Plating</h2>
            <span className="section-count">Every dish, made from scratch</span>
          </div>

          <div className="grid-hero" style={{ marginBottom: 6 }}>
            {gi(foodHero[0], "gi-feature")}
            {gi(foodHero[1])}
            {gi(foodHero[2])}
          </div>

          <div className="grid-masonry">
            {foodMasonry.map((img) => gi(img, "fade-in"))}
          </div>

          <div className="grid-4">
            {foodStrip.map((img) => gi(img))}
          </div>

          <div className="grid-masonry" style={{ marginTop: 6 }}>
            {foodFinal.map((img) => gi(img, "fade-in"))}
          </div>
        </div>
      )}

      {/* LOGO INTERLUDE — only on "Everything" view */}
      {filter === "all" && (
        <div className="logo-showcase">
          <img src="/assets/the-logo.jpg" alt="The Chef Catering Services — Five Star Meals on Wheels" />
          <p>Five Star Meals on Wheels &nbsp;·&nbsp; The Chef Catering Services</p>
        </div>
      )}

      {/* SECTION 2 — EVENTS & SETUP */}
      {show("events") && (
        <div className="gallery-section" data-cat="events" id="sec-events">
          <div className="section-header">
            <span className="section-tag">Live Events</span>
            <h2 className="section-title">Events &amp; Setup</h2>
            <span className="section-count">Every occasion, executed flawlessly</span>
          </div>
          <div className="events-strip">
            {eventImages.map((img) => (
              <div
                key={img.src}
                className="event-card fade-in"
                onClick={() => open(img)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") open(img); }}
              >
                <img src={img.src} alt={img.alt} />
                <div className="event-card-overlay">
                  <span className="event-card-tag">{img.tag}</span>
                  <div className="event-card-title">{img.caption.split(" — ")[0]}</div>
                  <div className="event-card-desc">{img.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUOTE — only on "Everything" view */}
      {filter === "all" && (
        <div className="g-quote-strip">
          <blockquote>
            &ldquo;It&apos;s not just catering — it&apos;s <em>an experience</em> they&apos;ll talk about long after
            the last plate is cleared.&rdquo;
            <cite>— The Chef Catering Services</cite>
          </blockquote>
        </div>
      )}

      {/* SECTION 3 — HAPPY CLIENTS */}
      {show("people") && (
        <div className="gallery-section" data-cat="people" id="sec-people">
          <div className="section-header">
            <span className="section-tag">Happy Clients</span>
            <h2 className="section-title">People We&apos;ve Served</h2>
            <span className="section-count">Relationships built around the table</span>
          </div>
          <div className="people-grid">
            {peopleImages.map((img) => (
              <div
                key={img.src}
                className="person-card fade-in"
                onClick={() => open(img)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") open(img); }}
              >
                <img src={img.src} alt={img.alt} />
                <div className="person-overlay">
                  <span className="person-tag">{img.tag}</span>
                  <div className="person-title">{img.caption}</div>
                  <div className="person-desc">{img.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="gallery-cta">
        <p className="section-tag" style={{ textAlign: "center", marginBottom: 16 }}>Reserve Your Experience</p>
        <h2>Ready to Be Our<br /><em>Next Happy Client?</em></h2>
        <p>
          Whether it&apos;s an intimate dinner for 10 or a celebration for 500 — The Chef brings five-star execution,
          warmth, and flavor to every table.
        </p>
        <a className="btn-gold" href={mailto(CATERING_EMAIL, "Event Booking Inquiry")}>Book Your Event</a>
        <Link className="btn-ghost-gold" href="/">Explore the Full Site</Link>
      </div>

      <footer className="gallery-footer">
        <span className="footer-logo-text">{BRAND.cateringFull}</span>
        <span className="footer-copy">© 2025 The Chef Catering Services · Five Star Meals on Wheels · All Rights Reserved</span>
      </footer>

      {/* LIGHTBOX */}
      <Lightbox index={lbIndex} onClose={() => setLbIndex(null)} onNavigate={setLbIndex} />
    </>
  );
}
