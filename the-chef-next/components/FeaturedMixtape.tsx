"use client";

import { useState } from "react";
import { featuredProject } from "@/data/tracks";

/** Cinematic featured-project banner for "From Overlooked to Overbooked". */
export default function FeaturedMixtape() {
  const [coverError, setCoverError] = useState(false);

  return (
    <div className="mixtape-feature">
      <div className="mixtape-cover">
        {coverError ? (
          <div className="mixtape-cover-fallback" aria-hidden="true">
            <span>The Chef</span>
          </div>
        ) : (
          <img
            src={featuredProject.cover}
            alt={`${featuredProject.title} — ${featuredProject.artist} mixtape cover`}
            loading="lazy"
            onError={() => setCoverError(true)}
          />
        )}
      </div>
      <div className="mixtape-info">
        <p className="mixtape-label">✦ &nbsp;{featuredProject.label}&nbsp; ✦</p>
        <h3 className="mixtape-title">{featuredProject.title}</h3>
        <p className="mixtape-artist">{featuredProject.artist}</p>
        <p className="mixtape-desc">{featuredProject.description}</p>
        <div className="mixtape-ctas">
          <a className="btn-primary mixtape-btn-ember" href="#rapper-tracks">Listen Now</a>
          <a className="btn-ghost" href="#rapper-contact">Book The Chef</a>
        </div>
      </div>
    </div>
  );
}
