"use client";

import { useEffect, useRef, useState } from "react";
import { ENTERTAINER_FILM } from "@/data/media";

/**
 * Entertainer "film" band — a short, silent, letterboxed loop of Chef's own
 * night-drive footage, placed between the artist story and the music.
 *
 * - Reserves its 16:9 box up front (no layout shift); nothing downloads until
 *   it is within ~400px of the viewport (`preload="none"` + lazy `src`).
 * - Muted autoplay loop while visible, paused off-screen.
 * - Visible pause/play control (WCAG 2.2.2). prefers-reduced-motion and
 *   Save-Data stay on the poster until the visitor presses play.
 * - The rendition has no audio track, so there is no sound control.
 */
export default function EntertainerFilm() {
  const ref = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const [near, setNear] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
    );
    setQuiet(reduce || saveData);
    v.muted = true;
    v.setAttribute("muted", "");
    if (!("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v || !near || quiet || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !userPaused.current) v.play().catch(() => {});
        else if (!e.isIntersecting) v.pause();
      },
      { threshold: 0.3 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [near, quiet]);

  if (!ENTERTAINER_FILM) return null;
  const film = ENTERTAINER_FILM;

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (!near) setNear(true);
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => {});
    } else {
      userPaused.current = true;
      v.pause();
    }
  }

  return (
    <figure className="ent-film" aria-label={film.label}>
      <div className="ent-film-frame">
        <video
          ref={ref}
          className="ent-film-video"
          src={near ? film.src : undefined}
          poster={film.poster}
          muted
          loop
          playsInline
          preload="none"
          width={film.width}
          height={film.height}
          aria-hidden="true"
          tabIndex={-1}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        <span className="ent-film-grain" aria-hidden="true" />
        <button
          type="button"
          className="ent-film-toggle"
          onClick={toggle}
          aria-label={playing ? "Pause film" : "Play film"}
        >
          <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
        </button>
      </div>
      <figcaption className="ent-film-caption">
        <span className="ent-film-kicker">{film.kicker}</span>
        <span className="ent-film-title">{film.title}</span>
      </figcaption>
    </figure>
  );
}
