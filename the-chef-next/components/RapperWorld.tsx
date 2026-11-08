"use client";

import { ENTERTAINER_BOOKING, mailto, tel } from "@/data/contact";
import { SHOW_UNVERIFIED_STATS, UPCOMING_SHOWS } from "@/data/launch";
import CurrentYear from "./CurrentYear";
import EntertainerHeroVideo from "./EntertainerHeroVideo";
import MusicSection from "./MusicSection";

/** Format an ISO date ("2026-12-31") as { day: "Dec 31", year: "2026" } without timezone drift. */
function showDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return { day: `${month} ${d}`, year: String(y) };
}

/**
 * The Entertainer side of the split-screen (internal name: "rapper" — kept so
 * the original split CSS contract stays untouched; all visible copy says
 * Entertainer / Music).
 */
export default function RapperWorld({ navVisible }: { navVisible: boolean }) {
  const booking = ENTERTAINER_BOOKING;
  const hasShows = UPCOMING_SHOWS.length > 0;

  return (
    <section className="world rapper" id="rapperWorld">
      <nav className={`nav rapper-nav${navVisible ? " visible" : ""}`} id="rapperNav" aria-label="Entertainer">
        <div className="nav-inner">
          <span className="nav-logo">The Chef</span>
          <a className="nav-link" href="#rapper-about">About</a>
          <a className="nav-link" href="#rapper-music">Music</a>
          {hasShows && <a className="nav-link" href="#rapper-shows">Shows</a>}
          <a
            className="nav-link btn-primary"
            href={booking ? "#rapper-contact" : "#rapper-music"}
            style={{ padding: "8px 16px", fontSize: 11, background: "var(--ember)", color: "#fff" }}
          >
            {booking ? "Book" : "Listen"}
          </a>
        </div>
      </nav>

      <div className="rapper-hero-wrap">
        {/* background performance loop — behind the portrait + text */}
        <EntertainerHeroVideo />
        <img
          className="portrait rapper-img"
          src="/assets/chef-rapper.jpg"
          alt="The Chef — Entertainer, artist portrait"
        />
        <div className="hero-inline">
          <p className="eyebrow">Artist · Songwriter · Performer</p>
          <div className="hero-divider"></div>
          <h1 className="hero-name">The Chef</h1>
          <p className="hero-sub">
            Raw lyricism. Bold identity. A sound built from the streets, the kitchen, and everything in between.
          </p>
          <div className="cta-row" style={{ justifyContent: "flex-end" }}>
            <a className="btn-primary" href="#rapper-music">Listen Now</a>
            {booking ? (
              <a className="btn-ghost" href="#rapper-contact">Book The Entertainer</a>
            ) : (
              <a className="btn-ghost" href="#rapper-about">Meet The Artist</a>
            )}
          </div>
        </div>
      </div>

      <div className="page-sections">
        {/* ABOUT */}
        <section className="section" id="rapper-about">
          <p className="section-tag">The Artist</p>
          <h2 className="section-title">The Story Behind The Sound</h2>
          <div className={`about-grid${SHOW_UNVERIFIED_STATS ? "" : " about-grid--solo"}`}>
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
            {SHOW_UNVERIFIED_STATS && (
              <div className="about-stats">
                <div className="stat-card"><div className="stat-num">50K+</div><div className="stat-label">Total Streams</div></div>
                <div className="stat-card"><div className="stat-num">12+</div><div className="stat-label">Original Tracks</div></div>
                <div className="stat-card"><div className="stat-num">30+</div><div className="stat-label">Live Shows</div></div>
                <div className="stat-card"><div className="stat-num">3</div><div className="stat-label">Projects Dropped</div></div>
              </div>
            )}
          </div>

          <div className="artist-photos">
            <img
              src="/assets/music/promo/promo-03.jpeg"
              alt="The Chef — artist portrait under red studio light"
              width={800}
              height={1197}
              loading="lazy"
            />
            <img
              src="/assets/music/promo/promo-02.jpeg"
              alt="The Chef — artist portrait, locs and red light"
              width={800}
              height={1193}
              loading="lazy"
            />
          </div>
        </section>

        {/* MUSIC — featured upcoming album + playable singles */}
        <MusicSection />

        {/* SHOWS — only real, confirmed dates (data/launch.ts → UPCOMING_SHOWS) */}
        {hasShows && (
          <section className="section" id="rapper-shows">
            <p className="section-tag">Live Performances</p>
            <h2 className="section-title">Upcoming Shows</h2>
            <div className="shows-list">
              {UPCOMING_SHOWS.map((s) => {
                const d = showDate(s.date);
                return (
                  <div className="show-row" key={`${s.date}-${s.venue}`}>
                    <div className="show-date">{d.day}<span>{d.year}</span></div>
                    <div className="show-info">
                      <div className="show-venue">{s.venue}</div>
                      <div className="show-city">{s.city}</div>
                    </div>
                    {s.ticketUrl && (
                      <a className="show-ticket" href={s.ticketUrl} target="_blank" rel="noopener noreferrer">
                        Get Tickets
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* BOOKING — only when the owner has approved a real contact route */}
        {booking && (
          <section className="rapper-cta" id="rapper-contact">
            <p className="section-tag" style={{ textAlign: "center" }}>Booking &amp; Features</p>
            <h2
              className="section-title"
              style={{ fontFamily: "var(--font-artist)", fontWeight: 700, letterSpacing: "-.01em", textAlign: "center" }}
            >
              Book The Entertainer
            </h2>
            <p className="section-body" style={{ textAlign: "center", margin: "0 auto 36px", maxWidth: 440 }}>
              Performances, features, appearances and press — reach The Chef directly.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {booking.email && (
                <a className="btn-primary" href={mailto(booking.email, "Entertainer Booking Inquiry")}>Book a Performance</a>
              )}
              {booking.phone && (
                <a
                  className="btn-primary"
                  href={tel(booking.phone)}
                  style={{ background: "rgba(255,80,20,.18)", color: "#fff", border: "1px solid rgba(255,80,20,.35)", boxShadow: "none" }}
                >
                  Call {booking.phoneDisplay ?? ""}
                </a>
              )}
            </div>
          </section>
        )}

        <footer className="site-footer">
          <span className="footer-logo">The Chef Music</span>
          <span>© <CurrentYear /> The Chef — Entertainer · All Rights Reserved</span>
        </footer>
      </div>
    </section>
  );
}
