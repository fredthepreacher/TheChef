"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CatererWorld from "./CatererWorld";
import RapperWorld from "./RapperWorld";
import SplitHandle from "./SplitHandle";

type Side = "chef" | "rapper" | "";

/**
 * The cinematic split-screen experience — React port of the original
 * script.js drag / lock / unlock logic. Preserves the exact CSS-variable
 * contract (--split, --chefOpacity, --rapOpacity, --centerOpacity) and
 * body classes (is-locked, locked-chef, locked-rapper) so the original
 * stylesheet works unchanged.
 */
export default function SplitStage() {
  const stageRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const chefHeroRef = useRef<HTMLDivElement>(null);
  const rapHeroRef = useRef<HTMLDivElement>(null);

  const splitRef = useRef(50);
  const draggingRef = useRef(false);
  const lockedRef = useRef(false);

  const [locked, setLocked] = useState<Side>("");
  const [chefNavVisible, setChefNavVisible] = useState(false);
  const [rapNavVisible, setRapNavVisible] = useState(false);

  /* ── 1. SET SPLIT POSITION ── */
  const setSplit = useCallback((v: number) => {
    const split = Math.max(0, Math.min(100, v));
    splitRef.current = split;

    const root = document.documentElement;
    root.style.setProperty("--split", split + "%");
    handleRef.current?.setAttribute("aria-valuenow", String(Math.round(split)));

    const chef = Math.max(0, Math.min(1, (split - 58) / 24));
    const rap = Math.max(0, Math.min(1, (42 - split) / 24));
    const center = 1 - Math.max(chef, rap);

    root.style.setProperty("--chefOpacity", chef.toFixed(3));
    root.style.setProperty("--rapOpacity", rap.toFixed(3));
    root.style.setProperty("--centerOpacity", center.toFixed(3));

    setChefNavVisible(chef > 0.05);
    setRapNavVisible(rap > 0.05);

    if (chefHeroRef.current) {
      chefHeroRef.current.style.opacity = String(chef);
      chefHeroRef.current.style.pointerEvents = chef > 0.1 ? "auto" : "none";
    }
    if (rapHeroRef.current) {
      rapHeroRef.current.style.opacity = String(rap);
      rapHeroRef.current.style.pointerEvents = rap > 0.1 ? "auto" : "none";
    }
  }, []);

  /* ── 2. LOCK ── */
  const doLock = useCallback((side: Exclude<Side, "">) => {
    lockedRef.current = true;
    setLocked(side);
    document.body.classList.add("is-locked");
    document.body.classList.toggle("locked-chef", side === "chef");
    document.body.classList.toggle("locked-rapper", side === "rapper");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* ── 3. UNLOCK ── */
  const doUnlock = useCallback(() => {
    lockedRef.current = false;
    setLocked("");
    document.body.classList.remove("is-locked", "locked-chef", "locked-rapper");
    window.scrollTo({ top: 0 });
    setSplit(50);
  }, [setSplit]);

  /* ── 4. SNAP LOGIC (drag-end) ── */
  const snapOrLock = useCallback(() => {
    const split = splitRef.current;
    if (split >= 85) {
      setSplit(100);
      doLock("chef");
    } else if (split <= 15) {
      setSplit(0);
      doLock("rapper");
    } else {
      setSplit(50);
    }
  }, [setSplit, doLock]);

  /* ── 5. POINTER HELPERS ── */
  const updateFromClientX = useCallback(
    (clientX: number) => {
      const rect = stageRef.current?.getBoundingClientRect();
      const left = rect?.left ?? 0;
      const width = rect?.width || window.innerWidth;
      setSplit(((clientX - left) / width) * 100);
    },
    [setSplit]
  );

  /* ── 6. DRAG EVENTS (handle) ── */
  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (lockedRef.current) return;
      draggingRef.current = true;
      handleRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
      updateFromClientX(e.clientX);
    },
    [updateFromClientX]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (draggingRef.current) updateFromClientX(e.clientX);
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      snapOrLock();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [updateFromClientX, snapOrLock]);

  /* ── 7. TOUCH EVENTS (mobile swipe anywhere on stage) ── */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onTouchMove = (e: TouchEvent) => {
      if (lockedRef.current) return;
      updateFromClientX(e.touches[0].clientX);
    };
    const onTouchEnd = () => {
      if (lockedRef.current) return;
      snapOrLock();
    };
    stage.addEventListener("touchmove", onTouchMove, { passive: true });
    stage.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
    };
  }, [updateFromClientX, snapOrLock]);

  /* ── 8. KEYBOARD ACCESSIBILITY ── */
  const onHandleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (lockedRef.current) return;
      const split = splitRef.current;
      if (e.key === "ArrowRight") { setSplit(split + 8); e.preventDefault(); }
      if (e.key === "ArrowLeft")  { setSplit(split - 8); e.preventDefault(); }
      if (e.key === "Home") setSplit(0);
      if (e.key === "End") setSplit(100);
      if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) snapOrLock();
      if (e.key === "Escape") doUnlock();
    },
    [setSplit, snapOrLock, doUnlock]
  );

  /* Escape anywhere unlocks */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && lockedRef.current) doUnlock();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [doUnlock]);

  /* ── INIT + CLEANUP ── */
  useEffect(() => {
    setSplit(50);
    return () => {
      // leaving the homepage: clear lock state so gallery/reviews render clean
      document.body.classList.remove("is-locked", "locked-chef", "locked-rapper");
    };
  }, [setSplit]);

  return (
    <main id="stage" className="stage" ref={stageRef}>
      <CatererWorld navVisible={chefNavVisible} />
      <RapperWorld navVisible={rapNavVisible} />

      {/* CENTER SPLIT LABELS */}
      <div className="center-labels" id="centerLabels">
        <div className="split-label caterer-label">
          <span className="split-label-tag">← Swipe Right</span>
          <span className="split-label-name">The Chef Catering</span>
        </div>
        <div className="split-label rapper-label">
          <span className="split-label-tag">Swipe Left →</span>
          <span className="split-label-name">The Chef Music</span>
        </div>
      </div>

      {/* FIXED HERO CONTENT (split/reveal phase) */}
      <div className="hero-content caterer-content" ref={chefHeroRef}>
        <p className="eyebrow">Private Chef · Luxury Catering · Crafted With Soul</p>
        <div className="hero-divider"></div>
        <h1 className="hero-name">The Chef</h1>
        <p className="hero-sub">Unforgettable food for every occasion worth celebrating.</p>
        <div className="cta-row">
          <a className="btn-primary" href="#caterer-menu">View Menu</a>
          <a className="btn-ghost" href="#caterer-book">Book Now</a>
        </div>
      </div>

      <div className="hero-content rapper-content" ref={rapHeroRef}>
        <p className="eyebrow">Artist · Songwriter · Original Sound</p>
        <div className="hero-divider"></div>
        <h1 className="hero-name">The Chef</h1>
        <p className="hero-sub">Raw lyricism. Bold identity. Music built from real life.</p>
        <div className="cta-row" style={{ justifyContent: "flex-end" }}>
          <a className="btn-primary" href="#rapper-music">Listen Now</a>
          <a className="btn-ghost" href="#rapper-shows">Shows</a>
        </div>
      </div>

      {/* DRAG HANDLE */}
      <SplitHandle
        ref={handleRef}
        locked={locked !== ""}
        onPointerDown={onHandlePointerDown}
        onKeyDown={onHandleKeyDown}
      />

      <div className="hint" id="hint">Drag to explore both sides</div>

      <button
        className="unlock-btn"
        id="unlockBtn"
        aria-label="Unlock and return to split view"
        style={{ display: locked ? "flex" : "none" }}
        onClick={doUnlock}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
        </svg>
        <span className="unlock-label">
          {locked === "chef"
            ? "⇄  Unlock  —  switch to Rapper"
            : locked === "rapper"
            ? "⇄  Unlock  —  switch to Caterer"
            : "⇄  Unlock  —  switch sides"}
        </span>
      </button>
    </main>
  );
}
