/**
 * Pure maths for the homepage split: where a released drag should settle,
 * the spring that carries it there, and the opacities derived from the
 * divider position. No DOM access, so it runs in tests as-is.
 *
 * Position is the divider's place across the stage in percent:
 * 0 = Entertainer fills the screen, 50 = even split, 100 = Catering fills it.
 * Velocity is percent per second.
 */

export type SnapTarget = 0 | 50 | 100;

/** How far ahead (seconds) a release velocity is projected. */
const PROJECTION_S = 0.16;
/** A projected position past these lines commits to that side. */
const COMMIT_HIGH = 70;
const COMMIT_LOW = 30;
/** Releases this close to centre need a real flick to leave it. */
const DEADZONE = 4;
const DEADZONE_FLICK = 140;
/** Release velocity is capped so one wild sample can't fling the divider. */
export const MAX_RELEASE_VELOCITY = 600;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Decide where a released drag settles, from position, direction and speed. */
export function decideSnap(position: number, velocity: number): SnapTarget {
  const pos = clamp(position, 0, 100);
  const v = clamp(velocity, -MAX_RELEASE_VELOCITY, MAX_RELEASE_VELOCITY);
  if (Math.abs(pos - 50) < DEADZONE && Math.abs(v) < DEADZONE_FLICK) return 50;
  const projected = pos + v * PROJECTION_S;
  if (projected >= COMMIT_HIGH) return 100;
  if (projected <= COMMIT_LOW) return 0;
  return 50;
}

/** Release velocity from recent samples (time in ms, position in percent). */
export function releaseVelocity(samples: ReadonlyArray<{ t: number; p: number }>, now: number, windowMs = 100): number {
  const recent = samples.filter((s) => now - s.t <= windowMs);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const dt = last.t - first.t;
  // A finger that stopped before lifting has no velocity, whatever it did earlier.
  if (dt < 8 || now - last.t > 60) return 0;
  return clamp(((last.p - first.p) / dt) * 1000, -MAX_RELEASE_VELOCITY, MAX_RELEASE_VELOCITY);
}

export type SpringState = { x: number; v: number };
export type SpringConfig = { stiffness: number; damping: number };

/** Damping for a given stiffness and damping ratio (1 = no overshoot). */
export const dampingFor = (stiffness: number, ratio: number) => 2 * Math.sqrt(stiffness) * ratio;

export const SPRINGS = {
  /** Settling into a side: confident, no bounce. */
  lock: { stiffness: 130, damping: dampingFor(130, 1) },
  /** Returning to the even split: a breath of give, no visible bounce. */
  center: { stiffness: 120, damping: dampingFor(120, 0.9) },
  /** Unlocking: slower and wider, the other world drawing back in. */
  unlock: { stiffness: 60, damping: dampingFor(60, 1) },
  /** The one-time invitation nudge. */
  nudge: { stiffness: 46, damping: dampingFor(46, 0.82) },
} satisfies Record<string, SpringConfig>;

/**
 * Advance a spring toward `target` by `dtMs`. Sub-stepped so a dropped frame
 * can't destabilise it, and held inside 0..100 so it never leaves the stage.
 */
export function stepSpring(state: SpringState, target: number, dtMs: number, cfg: SpringConfig): SpringState {
  let { x, v } = state;
  let remaining = Math.min(dtMs, 64) / 1000;
  while (remaining > 1e-6) {
    const h = Math.min(remaining, 0.004);
    v += (-cfg.stiffness * (x - target) - cfg.damping * v) * h;
    x += v * h;
    if (x <= 0) { x = 0; if (v < 0) v = 0; }
    if (x >= 100) { x = 100; if (v > 0) v = 0; }
    remaining -= h;
  }
  return { x, v };
}

export const isSettled = (state: SpringState, target: number) =>
  Math.abs(state.x - target) < 0.03 && Math.abs(state.v) < 0.6;

const smooth = (t: number) => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };

/** Everything the stage draws, derived from the divider position alone. */
export function splitVisuals(split: number) {
  // The two names leave before a side's hero text arrives (they share the
  // lower part of the screen), so the two are never readable at once.
  const chef = smooth((split - 67) / 22);
  const rapper = smooth((33 - split) / 22);
  return {
    /** Catering hero text. */
    chef,
    /** Entertainer hero text. */
    rapper,
    /** The two name lockups shown at the even split: gone by 21% off centre. */
    center: 1 - smooth((Math.abs(split - 50) - 3) / 18),
    /** The divider dissolves as it reaches either edge. */
    handle: smooth(Math.min(split, 100 - split) / 9),
  };
}

/**
 * Which side the stage is committed to showing: switches the nav on and lets
 * the media take its place for that side, just before the hero text fades in.
 */
export function splitFocus(split: number): "chef" | "rapper" | "" {
  return split >= 66 ? "chef" : split <= 34 ? "rapper" : "";
}
