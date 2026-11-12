"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import CatererWorld from "./CatererWorld";
import RapperWorld from "./RapperWorld";
import SplitHandle from "./SplitHandle";
import {
  SPRINGS,
  clamp,
  decideSnap,
  isSettled,
  releaseVelocity,
  splitVisuals,
  stepSpring,
  type SnapTarget,
  type SpringConfig,
} from "@/lib/split-physics";

type Side = "chef" | "rapper";

/** Owner-gated extras, decided on the server (lib/site.ts). */
export type Seasonal = { thanksgiving: boolean; privacy: boolean };

/* The two worlds are large trees. Nothing the split does needs them to
   re-render, so they render once and the engine drives them through the DOM. */
const Caterer = memo(CatererWorld);
const Rapper = memo(RapperWorld);

const SIDE_OF: Record<0 | 100, Side> = { 100: "chef", 0: "rapper" };
/** Finger travel before a touch on the open stage counts as a drag. */
const SLOP_PX = 8;
const CURTAIN_MS = 220;
const NUDGE_KEY = "chef:split-nudged";

/**
 * The homepage split: Catering on the left, Entertainer on the right, and a
 * divider the visitor moves between them.
 *
 * One engine owns the divider position. Dragging tracks the pointer 1:1,
 * releasing hands the position and velocity to a spring, and a side locks
 * only once the spring has arrived, so nothing jumps. Each frame writes
 * compositor-friendly properties (clip-path, transform, opacity) straight to
 * a handful of elements; no layout runs and React does not re-render while
 * the divider moves.
 */
export default function SplitStage({ seasonal }: { seasonal: Seasonal }) {
  const stageRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const unlockRef = useRef<HTMLButtonElement>(null);

  const [locked, setLocked] = useState<Side | "">("");
  const focusUnlockRef = useRef(false);
  const enterRef = useRef<(side: Side, viaKeyboard: boolean) => void>(() => {});
  const unlockFnRef = useRef<(viaKeyboard: boolean) => void>(() => {});
  const suppressClickUntilRef = useRef(0);

  useEffect(() => {
    const stage = stageRef.current;
    const track = trackRef.current;
    const handle = handleRef.current;
    const labels = labelsRef.current;
    const curtain = curtainRef.current;
    if (!stage || !track || !handle || !labels || !curtain) return;

    const chefWorld = stage.querySelector<HTMLElement>("#catererWorld");
    const rapWorld = stage.querySelector<HTMLElement>("#rapperWorld");
    if (!chefWorld || !rapWorld) return;
    const chefHero = chefWorld.querySelector<HTMLElement>(".hero-inline");
    const rapHero = rapWorld.querySelector<HTMLElement>(".hero-inline");

    const root = document.documentElement;
    const body = document.body;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let split = 50;
    let velocity = 0;
    let phase: "idle" | "dragging" | "animating" | "locked" | "curtain" = "idle";
    let raf = 0;
    let lastFrame = 0;
    let target = 50;
    let spring: SpringConfig = SPRINGS.center;
    let onArrive: (() => void) | null = null;
    let stageWidth = stage.clientWidth || window.innerWidth;
    let interacted = false;
    let nudgeTimer = 0;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
    };

    // Last values written, so a frame only touches what changed.
    const drawn = { split: -1, chef: -1, rapper: -1, center: -1, handle: -1, focus: "?", live: "?", value: -1 };

    /* ── DRAW ── */
    const draw = () => {
      const s = split;
      if (s !== drawn.split) {
        drawn.split = s;
        chefWorld.style.clipPath = `inset(0 ${(100 - s).toFixed(3)}% 0 0)`;
        rapWorld.style.clipPath = `inset(0 0 0 ${s.toFixed(3)}%)`;
        track.style.transform = `translate3d(${(s - 50).toFixed(3)}%,0,0)`;
      }
      const v = splitVisuals(s);
      if (v.chef !== drawn.chef && chefHero) {
        drawn.chef = v.chef;
        chefHero.style.opacity = v.chef.toFixed(3);
      }
      if (v.rapper !== drawn.rapper && rapHero) {
        drawn.rapper = v.rapper;
        rapHero.style.opacity = v.rapper.toFixed(3);
      }
      if (v.center !== drawn.center) {
        drawn.center = v.center;
        labels.style.opacity = v.center.toFixed(3);
      }
      if (v.handle !== drawn.handle) {
        drawn.handle = v.handle;
        track.style.opacity = v.handle.toFixed(3);
      }
      // Discrete states change rarely; CSS reads them from the stage.
      const focus = v.chef > 0.5 ? "chef" : v.rapper > 0.5 ? "rapper" : "";
      if (focus !== drawn.focus) { drawn.focus = focus; stage.dataset.focus = focus; }
      const live = v.center > 0.4 ? "1" : "0";
      if (live !== drawn.live) { drawn.live = live; labels.dataset.live = live; }
      const value = Math.round(s);
      if (value !== drawn.value) {
        drawn.value = value;
        handle.setAttribute("aria-valuenow", String(value));
        handle.setAttribute(
          "aria-valuetext",
          value >= 99 ? "Catering" : value <= 1 ? "Entertainer" : value === 50 ? "Even split" : `Catering ${value}%, Entertainer ${100 - value}%`
        );
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (phase === "animating") {
        const dt = lastFrame ? now - lastFrame : 16.7;
        lastFrame = now;
        const next = stepSpring({ x: split, v: velocity }, target, dt, spring);
        split = next.x;
        velocity = next.v;
        if (isSettled(next, target)) {
          split = target;
          velocity = 0;
          phase = "idle";
          draw();
          const done = onArrive;
          onArrive = null;
          done?.();
          return;
        }
        draw();
        raf = requestAnimationFrame(frame);
        return;
      }
      draw();
    };
    const requestDraw = () => { if (!raf) raf = requestAnimationFrame(frame); };

    const animateTo = (to: number, cfg: SpringConfig, then?: () => void) => {
      target = to;
      spring = cfg;
      onArrive = then ?? null;
      phase = "animating";
      lastFrame = 0;
      requestDraw();
    };

    const markInteracted = () => {
      if (interacted) return;
      interacted = true;
      window.clearTimeout(nudgeTimer);
      stage.classList.add("has-interacted");
      try { sessionStorage.setItem(NUDGE_KEY, "1"); } catch { /* private mode */ }
    };

    /* ── LOCK / UNLOCK ── */
    const applyLock = (side: Side) => {
      phase = "locked";
      split = side === "chef" ? 100 : 0;
      velocity = 0;
      draw();
      // The locked layout is plain CSS; hand the worlds back to the stylesheet.
      chefWorld.style.clipPath = "";
      rapWorld.style.clipPath = "";
      if (chefHero) chefHero.style.opacity = "";
      if (rapHero) rapHero.style.opacity = "";
      drawn.split = drawn.chef = drawn.rapper = -1;
      body.classList.add("is-locked");
      body.classList.toggle("locked-chef", side === "chef");
      body.classList.toggle("locked-rapper", side === "rapper");
      setLocked(side);
    };

    const releaseLock = () => {
      body.classList.remove("is-locked", "locked-chef", "locked-rapper");
      setLocked("");
      draw();
    };

    /** Cross through black instead of moving: reduced motion, or a long way to scroll back. */
    const throughCurtain = (midpoint: () => void, after: () => void) => {
      phase = "curtain";
      curtain.classList.add("is-on");
      later(() => {
        midpoint();
        // Give the new composition a moment to paint under the curtain before it lifts.
        later(() => {
          curtain.classList.remove("is-on");
          after();
        }, 60);
      }, CURTAIN_MS);
    };

    const settle = (to: SnapTarget, cfg: SpringConfig) => {
      const arrive = () => { if (to === 50) phase = "idle"; else applyLock(SIDE_OF[to]); };
      if (reduceMotion.matches) {
        if (Math.abs(split - to) < 0.5) { split = to; velocity = 0; phase = "idle"; arrive(); requestDraw(); return; }
        throughCurtain(
          () => { split = to; velocity = 0; draw(); arrive(); },
          () => { if (phase === "curtain") phase = "idle"; }
        );
        return;
      }
      animateTo(to, cfg, arrive);
    };

    const enter = (side: Side, viaKeyboard: boolean) => {
      if (phase === "locked" || phase === "curtain" || phase === "dragging") return;
      markInteracted();
      focusUnlockRef.current = viaKeyboard;
      velocity = 0;
      settle(side === "chef" ? 100 : 0, SPRINGS.lock);
    };

    const unlock = (viaKeyboard: boolean) => {
      if (phase !== "locked") return;
      const reopen = () => {
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
        releaseLock();
        if (viaKeyboard) handle.focus({ preventScroll: true });
      };
      if (reduceMotion.matches) {
        throughCurtain(() => { reopen(); split = 50; velocity = 0; draw(); }, () => { phase = "idle"; });
      } else if (window.scrollY > 4) {
        throughCurtain(reopen, () => animateTo(50, SPRINGS.unlock));
      } else {
        reopen();
        animateTo(50, SPRINGS.unlock);
      }
    };

    enterRef.current = enter;
    unlockFnRef.current = unlock;

    /* ── POINTER ── */
    type Gesture = { id: number; x0: number; y0: number; split0: number; active: boolean };
    let gesture: Gesture | null = null;
    const samples: { t: number; p: number }[] = [];

    const beginDrag = (g: Gesture, x: number) => {
      g.active = true;
      g.x0 = x;
      g.split0 = split;
      phase = "dragging";
      onArrive = null;
      velocity = 0;
      samples.length = 0;
      samples.push({ t: performance.now(), p: split });
      stage.classList.add("is-dragging");
      markInteracted();
      try { stage.setPointerCapture(g.id); } catch { /* pointer already gone */ }
    };

    const endDrag = (cancelled: boolean) => {
      const g = gesture;
      gesture = null;
      if (!g) return;
      try { stage.releasePointerCapture(g.id); } catch { /* not captured */ }
      if (!g.active) return;
      stage.classList.remove("is-dragging");
      // A drag that ends over a link or a name must not also click it.
      suppressClickUntilRef.current = performance.now() + 350;
      const v = cancelled ? 0 : releaseVelocity(samples, performance.now());
      const to = decideSnap(split, v);
      velocity = v;
      focusUnlockRef.current = false;
      settle(to, to === 50 ? SPRINGS.center : SPRINGS.lock);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (phase === "locked" || phase === "curtain" || gesture) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const el = e.target as Element | null;
      const onHandle = !!el?.closest(".handle");
      // Links and buttons keep their own behaviour; the two names allow both a tap and a drag.
      if (!onHandle && el?.closest("a, button:not([data-split-enter]), input, select, textarea")) return;
      stageWidth = stage.clientWidth || window.innerWidth;
      gesture = { id: e.pointerId, x0: e.clientX, y0: e.clientY, split0: split, active: false };
      if (onHandle) {
        // Grabbing the handle is unambiguous: take over at once, mid-animation included.
        e.preventDefault();
        handle.focus({ preventScroll: true });
        beginDrag(gesture, e.clientX);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const g = gesture;
      if (!g || e.pointerId !== g.id) return;
      if (!g.active) {
        const dx = e.clientX - g.x0;
        const dy = e.clientY - g.y0;
        if (Math.hypot(dx, dy) < SLOP_PX) return;
        // Slightly diagonal still counts as sideways; mostly vertical is left alone.
        if (Math.abs(dx) < Math.abs(dy) * 0.7) { gesture = null; return; }
        beginDrag(g, e.clientX);
      }
      split = clamp(g.split0 + ((e.clientX - g.x0) / stageWidth) * 100, 0, 100);
      const now = performance.now();
      samples.push({ t: now, p: split });
      while (samples.length > 2 && now - samples[0].t > 120) samples.shift();
      requestDraw();
    };

    const onPointerUp = (e: PointerEvent) => { if (gesture && e.pointerId === gesture.id) endDrag(false); };
    const onPointerCancel = (e: PointerEvent) => { if (gesture && e.pointerId === gesture.id) endDrag(true); };
    const onLostCapture = (e: PointerEvent) => { if (gesture?.active && e.pointerId === gesture.id) endDrag(true); };
    const onClickCapture = (e: MouseEvent) => {
      if (performance.now() < suppressClickUntilRef.current) { e.preventDefault(); e.stopPropagation(); }
    };

    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerCancel);
    stage.addEventListener("lostpointercapture", onLostCapture);
    stage.addEventListener("click", onClickCapture, true);

    /* ── KEYBOARD ── */
    const onHandleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "End") { e.preventDefault(); enter("chef", true); }
      else if (e.key === "ArrowLeft" || e.key === "Home") { e.preventDefault(); enter("rapper", true); }
    };
    const onDocKey = (e: KeyboardEvent) => { if (e.key === "Escape" && phase === "locked") unlock(true); };
    handle.addEventListener("keydown", onHandleKey);
    document.addEventListener("keydown", onDocKey);

    /* ── VIEWPORT ── */
    // Everything is drawn in percentages, so a resize or rotation needs no redraw.
    const onResize = () => { stageWidth = stage.clientWidth || window.innerWidth; };
    window.addEventListener("resize", onResize);
    // A tab hidden mid-animation would otherwise resume with one huge time step.
    const onVisibility = () => { lastFrame = 0; };
    document.addEventListener("visibilitychange", onVisibility);

    /* ── INIT ── */
    root.classList.add("split-home");
    stage.classList.add("is-ready");
    draw();

    // One quiet invitation per visit: the divider leans toward Catering and returns.
    let nudged = false;
    try { nudged = sessionStorage.getItem(NUDGE_KEY) === "1"; } catch { /* private mode */ }
    if (nudged) stage.classList.add("has-interacted");
    else if (!reduceMotion.matches) {
      nudgeTimer = window.setTimeout(() => {
        if (interacted || phase !== "idle" || document.hidden) return;
        animateTo(54, SPRINGS.nudge, () => { if (!interacted) animateTo(50, SPRINGS.nudge); });
      }, 1800);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(nudgeTimer);
      timers.forEach((id) => window.clearTimeout(id));
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerCancel);
      stage.removeEventListener("lostpointercapture", onLostCapture);
      stage.removeEventListener("click", onClickCapture, true);
      handle.removeEventListener("keydown", onHandleKey);
      document.removeEventListener("keydown", onDocKey);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      // Leaving the homepage: gallery and reviews must render clean.
      root.classList.remove("split-home");
      body.classList.remove("is-locked", "locked-chef", "locked-rapper");
    };
  }, []);

  // Keyboard users who open a side land on the control that brings them back.
  useEffect(() => {
    if (locked && focusUnlockRef.current) {
      focusUnlockRef.current = false;
      unlockRef.current?.focus({ preventScroll: true });
    }
  }, [locked]);

  // detail === 0 means the click came from the keyboard.
  const onEnterChef = useCallback((e: React.MouseEvent) => enterRef.current("chef", e.detail === 0), []);
  const onEnterRapper = useCallback((e: React.MouseEvent) => enterRef.current("rapper", e.detail === 0), []);
  const onUnlock = useCallback((e: React.MouseEvent) => unlockFnRef.current(e.detail === 0), []);

  return (
    <main id="stage" className="stage" ref={stageRef}>
      <Caterer seasonal={seasonal} />
      <Rapper />

      {/* THE TWO NAMES — each is also a plain button into its side */}
      <div className="center-labels" id="centerLabels" ref={labelsRef}>
        <button type="button" className="split-label caterer-label" data-split-enter="" onClick={onEnterChef}>
          <span className="split-label-tag">Enter</span>
          <span className="split-label-name">
            <span className="split-kicker">The Chef</span>
            <span className="split-word">Catering</span>
          </span>
        </button>
        <button type="button" className="split-label rapper-label" data-split-enter="" onClick={onEnterRapper}>
          <span className="split-label-tag">Enter</span>
          <span className="split-label-name">
            <span className="split-kicker">The Chef</span>
            <span className="split-word">Entertainer</span>
          </span>
        </button>
      </div>

      {/* DIVIDER */}
      <div className="handle-track" ref={trackRef}>
        <SplitHandle ref={handleRef} />
      </div>

      <p className="hint" id="hint" aria-hidden="true">Drag to explore both sides</p>

      <div className="split-curtain" ref={curtainRef} aria-hidden="true" />

      <button
        type="button"
        className="unlock-btn"
        id="unlockBtn"
        ref={unlockRef}
        aria-label={
          locked === "chef"
            ? "Back to both sides, to switch to Entertainer"
            : locked === "rapper"
            ? "Back to both sides, to switch to Catering"
            : "Back to both sides"
        }
        hidden={!locked}
        onClick={onUnlock}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4v16M8 9l-4 3 4 3M16 9l4 3-4 3" />
        </svg>
        <span className="unlock-label">
          {locked === "chef" ? "Switch to Entertainer" : locked === "rapper" ? "Switch to Catering" : "Both sides"}
        </span>
      </button>
    </main>
  );
}
