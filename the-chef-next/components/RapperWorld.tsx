"use client";

import { MUSIC_EMAIL, mailto } from "@/data/contact";
import MusicSection from "./MusicSection";

const shows = [
  { date: "TBD", year: "2025", venue: "Venue Name — Add Here", city: "City, State" },
  { date: "TBD", year: "2025", venue: "Venue Name — Add Here", city: "City, State" },
  { date: "TBD", year: "2025", venue: "Venue Name — Add Here", city: "City, State" },
];

/** The music side of the split-screen — The Chef Music brand world. */
export default function RapperWorld({ navVisible }: { navVisible: boolean }) {
  return (
    <section className="world rapper" id="rapperWorld">
      <nav className={`nav rapper-nav${navVisible ? " visible" : ""}`} id="rapperNav">
        <div className="nav-inner">
          <span className="nav-logo">The Chef</span>
          <a className="nav-link" href="#rapper-about">About</a>
          <a className="nav-link" href="#rapper-music">Music</a>
          <a className="nav-link" href="#rapper-shows">Shows</a>
          <a
            className="nav-link btn-primary"
            href="#rapper-contact"
            style={{ padding: "8px 16px", fontSize: 11, background: "var(--ember)", color: "#fff" }}
          >
            Contact
          </a>
        </div>
      </nav>

      <div className="rapper-hero-wrap">
        <img
          className="portrait rapper-img"
          src="/assets/chef-rapper.jpg"
          alt="The Chef Music — artist photo"
        />
        <div className="hero-inline">
          <p className="eyebrow">Artist · Songwriter · Original Sound</p>
          <div className="hero-divider"></div>
          <h1 className="hero-name">The Chef</h1>
          <p className="hero-sub">
            Raw lyricism. Bold identity. A sound built from the streets, the kitchen, and everything in between.
          </p>
          <div className="cta-row" style={{ justifyContent: "flex-end" }}>
            <a className="btn-primary" href="#rapper-music">Listen Now</a>
            <a className="btn-ghost" href="#rapper-shows">Upcoming Shows</a>
          </div>
        </div>
      </div>

      <div className="page-sections">
        {/* ABOUT */}
        <section className="section" id="rapper-about">
          <p className="section-tag">The Artist</p>
          <h2 className="section-title">The Story Behind The Sound</h2>
          <div className="about-grid">
            <div className="about-text">
              <p>
                The Chef channels lived experience into every bar — a perspective forged between hustle, hunger, and
                the relentless grind of building two identities at once. The music carries the same precision brought
                to the kitchen.
              </p>
              <p>
                With a street-cinematic sound that blends sharp lyricism with cinematic production, Chef tells stories
                that feel real because they are. No filters. No compromise. Just authentic craft.
              </p>
              <p>Independently building a legacy one track, one event, one plate at a time.</p>
            </div>
            <div className="about-stats">
              <div className="stat-card"><div className="stat-num">50K+</div><div className="stat-label">Total Streams</div></div>
              <div className="stat-card"><div className="stat-num">12+</div><div className="stat-label">Original Tracks</div></div>
              <div className="stat-card"><div className="stat-num">30+</div><div className="stat-label">Live Shows</div></div>
              <div className="stat-card"><div className="stat-num">3</div><div className="stat-label">Projects Dropped</div></div>
            </div>
          </div>
        </section>

        {/* MUSIC — featured mixtape + playable singles */}
        <MusicSection />

        {/* SHOWS */}
        <section className="section" id="rapper-shows">
          <p className="section-tag">Live Performances</p>
          <h2 className="section-title">Upcoming Shows</h2>
          <p className="section-body">
            Catch The Chef live. Performance dates, venues, and ticket links will be updated here.
          </p>
          <div className="shows-list">
            {shows.map((s, i) => (
              <div className="show-row" key={i}>
                <div className="show-date">{s.date}<span>{s.year}</span></div>
                <div className="show-info">
                  <div className="show-venue">{s.venue}</div>
                  <div className="show-city">{s.city}</div>
                </div>
                <div className="show-ticket">Get Tickets</div>
              </div>
            ))}
          </div>
        </section>

        {/* CONTACT CTA */}
        <section className="rapper-cta" id="rapper-contact">
          <p className="section-tag" style={{ textAlign: "center" }}>Connect</p>
          <h2
            className="section-title"
            style={{ fontFamily: "'Bebas Neue',sans-serif", fontWeight: 400, letterSpacing: ".02em", textAlign: "center" }}
          >
            Work With The Chef
          </h2>
          <p className="section-body" style={{ textAlign: "center", margin: "0 auto 36px", maxWidth: 440 }}>
            Booking inquiries, feature requests, show bookings, and press — all through one channel.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a className="btn-primary" href={mailto(MUSIC_EMAIL, "Show Booking Inquiry")}>Book a Show</a>
            <a className="btn-primary" href={mailto(MUSIC_EMAIL, "Feature Request")} style={{ background: "rgba(255,80,20,.18)", color: "#fff", border: "1px solid rgba(255,80,20,.35)", boxShadow: "none" }}>
              Contact for Features
            </a>
          </div>
        </section>

        <footer className="site-footer">
          <span className="footer-logo">The Chef Music</span>
          <span>© 2025 The Chef Music · All Rights Reserved</span>
        </footer>
      </div>
    </section>
  );
}
