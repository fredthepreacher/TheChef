"use client";

import { useEffect, useRef } from "react";

/**
 * Catering-side hero background video.
 * - muted / autoplay / loop / playsInline, no controls, no audio track
 * - poster frame shows until the video can play (and stays if it fails)
 * - pauses while off-screen (or when the caterer world is hidden) to save battery
 * - respects prefers-reduced-motion: stays on the poster frame
 * Sits behind the portrait and hero text — it never affects their layout.
 */
export default function CateringHeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      video.removeAttribute("autoplay");
      video.pause();
      return;
    }

    // React doesn't always serialise `muted` into the SSR markup; iOS needs it for autoplay.
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

  return (
    <>
      <video
        ref={ref}
        className="cateringHeroVideo"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/assets/video/chef-catering-hero-poster.jpg"
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src="/assets/video/chef-catering-hero.mp4" type="video/mp4" />
      </video>
      <div className="cateringHeroVeil" aria-hidden="true" />
    </>
  );
}
