"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EndorsementVideo as Clip } from "@/data/media";

type AudioChain = { ctx: AudioContext; gain: GainNode };

const FADE_IN_S = 0.8;
const FADE_OUT_S = 0.25;

/**
 * Endorsement clip in a phone-shaped frame.
 *
 * - Starts muted and loops quietly once it scrolls into view (browsers only
 *   allow muted autoplay). Nothing downloads until it is near the viewport.
 * - "Tap for sound" restarts the clip from the top and fades the audio in.
 *   The fade runs through Web Audio so it also works on iPhone, where
 *   `video.volume` is read-only; older browsers fall back to a volume ramp.
 * - After a with-sound play-through it drops back to the muted loop.
 * - Pause/play control (WCAG 2.2.2). prefers-reduced-motion and Save-Data
 *   keep it on the poster until the guest presses play.
 */
export default function EndorsementVideo({ clip }: { clip: Clip }) {
  const ref = useRef<HTMLVideoElement>(null);
  const audio = useRef<AudioChain | null>(null);
  const userPaused = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(false);
  const [quiet, setQuiet] = useState(false); // reduced motion / save-data: no autoplay

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    setQuiet(reduce || saveData);
    v.muted = true;
    v.setAttribute("muted", "");

    if (!("IntersectionObserver" in window)) {
      setLoaded(true);
      return;
    }
    const near = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setLoaded(true);
          near.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    near.observe(v);
    return () => near.disconnect();
  }, []);

  // Autoplay (muted) while visible; pause when scrolled away.
  useEffect(() => {
    const v = ref.current;
    if (!v || !loaded || quiet || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !userPaused.current) v.play().catch(() => {});
        else if (!e.isIntersecting) v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [loaded, quiet]);

  const chain = useCallback((v: HTMLVideoElement): AudioChain | null => {
    if (audio.current) return audio.current;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      const ctx = new AC();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(v).connect(gain).connect(ctx.destination);
      audio.current = { ctx, gain };
      return audio.current;
    } catch {
      return null;
    }
  }, []);

  const ramp = useCallback((v: HTMLVideoElement, from: number, to: number, seconds: number) => {
    const a = audio.current;
    if (a) {
      const t = a.ctx.currentTime;
      a.gain.gain.cancelScheduledValues(t);
      a.gain.gain.setValueAtTime(from, t);
      a.gain.gain.linearRampToValueAtTime(to, t + seconds);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / (seconds * 1000));
      v.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  const backToMutedLoop = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.loop = true;
    setSound(false);
    if (!quiet && !userPaused.current) v.play().catch(() => {});
  }, [quiet]);

  const toggleSound = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    setLoaded(true);
    if (sound) {
      ramp(v, 1, 0, FADE_OUT_S);
      window.setTimeout(backToMutedLoop, FADE_OUT_S * 1000);
      return;
    }
    const a = chain(v);
    if (a) {
      a.gain.gain.cancelScheduledValues(a.ctx.currentTime);
      a.gain.gain.setValueAtTime(0, a.ctx.currentTime);
      a.ctx.resume().catch(() => {});
    } else {
      v.volume = 0;
    }
    userPaused.current = false;
    v.loop = false;
    v.currentTime = 0;
    v.muted = false;
    v.play()
      .then(() => ramp(v, 0, 1, FADE_IN_S))
      .catch(() => {
        v.muted = true;
      });
    setSound(true);
  }, [sound, chain, ramp, backToMutedLoop]);

  const togglePlay = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    setLoaded(true);
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => {});
    } else {
      userPaused.current = true;
      v.pause();
    }
  }, []);

  return (
    <figure className={`endorse-frame${sound ? " has-sound" : ""}`}>
      <div className="endorse-screen">
        <video
          ref={ref}
          className="endorse-video"
          muted
          loop
          playsInline
          preload="none"
          poster={clip.poster}
          width={clip.width}
          height={clip.height}
          aria-label={clip.label}
          src={loaded ? clip.src : undefined}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={backToMutedLoop}
        />
        <div className="sv-controls">
          <button
            type="button"
            className="sv-btn sv-btn--icon"
            onClick={togglePlay}
            aria-label={playing ? "Pause video" : "Play video"}
          >
            {playing ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
            )}
          </button>
          <button
            type="button"
            className={`sv-btn sv-sound${sound ? " is-on" : ""}`}
            onClick={toggleSound}
            aria-pressed={sound}
          >
            {sound ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            )}
            <span>{sound ? "Sound on" : "Tap for sound"}</span>
          </button>
        </div>
      </div>
      <figcaption>{clip.caption}</figcaption>
    </figure>
  );
}
