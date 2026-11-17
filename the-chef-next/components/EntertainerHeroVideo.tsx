"use client";

import { useEffect, useRef } from "react";
import { ENTERTAINER_HERO } from "@/data/media";

/**
 * Entertainer-side hero background loop — mirror of CateringHeroVideo.
 * - muted / autoplay / loop / playsInline, no controls, no audio track
 * - poster shows until playback starts (and stays if autoplay is blocked,
 *   e.g. iOS Low Power Mode)
 * - pauses while off-screen; prefers-reduced-motion keeps the poster
 * Lives in its own clipped panel (.entertainerHeroPanel): on desktop only the
 * dark area RIGHT of the portrait, so it never crosses into the catering side
 * or behind the artist photo; on phones the dark areas around it.
 */
export default function EntertainerHeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.removeAttribute("autoplay");
      video.pause();
      return;
    }

    video.muted = true;
    video.setAttribute("muted", "");

    const tryPlay = () => {
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => { /* autoplay blocked: poster stays */ });
    };

    if (!("IntersectionObserver" in window)) { tryPlay(); return; }
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? tryPlay() : video.pause()),
      { threshold: 0.05 }
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  if (!ENTERTAINER_HERO) return null;

  return (
    <div className="entertainerHeroPanel" aria-hidden="true">
      <video
        ref={ref}
        className="entertainerHeroVideo"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={ENTERTAINER_HERO.poster}
        tabIndex={-1}
      >
        <source src={ENTERTAINER_HERO.src} type="video/mp4" />
      </video>
      <div className="entertainerHeroVeil" />
    </div>
  );
}
