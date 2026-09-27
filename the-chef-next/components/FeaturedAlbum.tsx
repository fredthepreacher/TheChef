"use client";

import { useState } from "react";
import { featuredProject } from "@/data/tracks";

/** Cinematic "Featured Album Coming Soon" banner for "From Overlooked to Overbooked". */
export default function FeaturedAlbum() {
  const [coverError, setCoverError] = useState(false);

  return (
    <div className="album-feature">
      <div className="album-cover">
        {coverError ? (
          <div className="album-cover-fallback" aria-hidden="true">
            <span>The Chef</span>
          </div>
        ) : (
          <img
            src={featuredProject.cover}
            alt={`${featuredProject.title} — ${featuredProject.artist} album cover`}
            loading="lazy"
            onError={() => setCoverError(true)}
          />
        )}
        <span className="album-badge">{featuredProject.badge}</span>
      </div>
      <div className="album-info">
        <p className="album-label">✦ &nbsp;{featuredProject.label}&nbsp; ✦</p>
        <h3 className="album-title">{featuredProject.title}</h3>
        <p className="album-artist">{featuredProject.byline}</p>
        <p className="album-desc">{featuredProject.description}</p>
        <div className="album-ctas">
          <a className="btn-primary album-btn-ember" href="#rapper-tracks">Hear the Singles</a>
          <a className="btn-ghost" href="#rapper-contact">Book The Chef</a>
        </div>
      </div>
    </div>
  );
}
