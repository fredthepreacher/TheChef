"use client";

import { useRef, useState } from "react";
import type { Track } from "@/data/tracks";

/**
 * One playable track card: cover art, title, artist, native audio controls.
 * - preload="metadata": no full downloads until the user hits play
 * - only one track plays at a time (all other <audio> elements pause)
 * - missing cover file -> styled fallback, never a broken image
 */
export default function TrackCard({ track }: { track: Track }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [coverError, setCoverError] = useState(false);

  const onPlay = () => {
    document.querySelectorAll("audio").forEach((el) => {
      if (el !== audioRef.current) el.pause();
    });
  };

  return (
    <div className="mtrack-card">
      <div className="mtrack-cover">
        {coverError ? (
          <div className="mtrack-cover-fallback" aria-hidden="true">
            <span>{track.title.charAt(0)}</span>
          </div>
        ) : (
          <img
            src={track.cover}
            alt={`${track.title} — ${track.artist} cover art`}
            loading="lazy"
            onError={() => setCoverError(true)}
          />
        )}
        <span className="mtrack-badge">{track.type}</span>
      </div>
      <div className="mtrack-info">
        <div className="mtrack-title">{track.title}</div>
        <div className="mtrack-artist">
          {track.artist} <span className="mtrack-length">· {track.length}</span>
        </div>
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          src={track.audio}
          onPlay={onPlay}
          className="mtrack-audio"
        >
          Your browser does not support the audio element.
        </audio>
      </div>
    </div>
  );
}
