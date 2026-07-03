"use client";

import { tracks } from "@/data/tracks";
import TrackCard from "./TrackCard";
import FeaturedMixtape from "./FeaturedMixtape";

/**
 * The real music section — featured mixtape + three playable singles.
 * Replaces the old placeholder track grid. No empty slots.
 */
export default function MusicSection() {
  return (
    <section className="section music-section" id="rapper-music">
      <p className="section-tag">Music by The Chef</p>
      <h2 className="section-title">The Music</h2>
      <p className="section-body">
        Pain, patience, ambition, and pressure — cooked into every track.
      </p>

      <FeaturedMixtape />

      <div className="track-grid" id="rapper-tracks">
        {tracks.map((t) => (
          <TrackCard track={t} key={t.title} />
        ))}
      </div>
    </section>
  );
}
