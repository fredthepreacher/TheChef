import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SPRINGS,
  decideSnap,
  isSettled,
  releaseVelocity,
  splitVisuals,
  stepSpring,
  type SpringConfig,
} from "../lib/split-physics";

test("a release settles by position when the finger is still", () => {
  assert.equal(decideSnap(50, 0), 50);
  assert.equal(decideSnap(62, 0), 50);
  assert.equal(decideSnap(69, 0), 50);
  assert.equal(decideSnap(71, 0), 100);
  assert.equal(decideSnap(31, 0), 50);
  assert.equal(decideSnap(29, 0), 0);
  assert.equal(decideSnap(100, 0), 100);
  assert.equal(decideSnap(0, 0), 0);
});

test("a fast swipe commits early, and direction decides the side", () => {
  assert.equal(decideSnap(58, 300), 100, "flick toward Catering from just past centre");
  assert.equal(decideSnap(42, -300), 0, "flick toward Entertainer");
  assert.equal(decideSnap(60, 40), 50, "a slow drift does not commit");
});

test("reversing direction before release cancels the commit", () => {
  assert.equal(decideSnap(80, -250), 50, "pulled back from the Catering side");
  assert.equal(decideSnap(20, 250), 50, "pulled back from the Entertainer side");
  assert.equal(decideSnap(55, -400), 0, "a hard reverse flick crosses to the other side");
});

test("a tiny drag or a tap never leaves the centre", () => {
  assert.equal(decideSnap(51, 60), 50);
  assert.equal(decideSnap(48.5, -120), 50);
  assert.equal(decideSnap(53, 135), 50);
});

test("release velocity uses only recent movement", () => {
  const moving = [{ t: 0, p: 50 }, { t: 40, p: 54 }, { t: 80, p: 58 }];
  assert.equal(Math.round(releaseVelocity(moving, 85)), 100);
  assert.equal(releaseVelocity(moving, 400), 0, "finger rested before lifting");
  assert.equal(releaseVelocity([{ t: 0, p: 50 }], 5), 0, "one sample is not a velocity");
  const wild = [{ t: 0, p: 10 }, { t: 10, p: 90 }];
  assert.equal(releaseVelocity(wild, 12), 600, "capped");
});

function run(from: number, velocity: number, target: number, cfg: SpringConfig, frameMs = 1000 / 60) {
  let s = { x: from, v: velocity };
  let ms = 0;
  let min = from;
  let max = from;
  // stepSpring caps a single step at 64ms, so count steps rather than wall time.
  for (let i = 0; i < 2000 && !isSettled(s, target); i++) {
    s = stepSpring(s, target, frameMs, cfg);
    ms += Math.min(frameMs, 64);
    min = Math.min(min, s.x);
    max = Math.max(max, s.x);
  }
  return { ms, min, max, end: s.x };
}

test("the lock spring settles on the edge without bouncing or leaving the stage", () => {
  const r = run(72, 180, 100, SPRINGS.lock);
  assert.ok(r.ms < 900, `settles in under 0.9s (took ${Math.round(r.ms)}ms)`);
  assert.ok(r.max <= 100 && r.min >= 0);
  assert.ok(Math.abs(r.end - 100) < 0.05);
});

test("returning to centre overshoots by less than one percent", () => {
  const r = run(66, 0, 50, SPRINGS.center);
  assert.ok(r.ms < 1100, `settles in about a second (took ${Math.round(r.ms)}ms)`);
  assert.ok(r.min > 49, `no visible bounce (min ${r.min.toFixed(2)})`);
});

test("the spring survives dropped frames and a throttled tab", () => {
  for (const frame of [8, 16.7, 33, 120, 900]) {
    const r = run(0, 0, 50, SPRINGS.unlock, frame);
    assert.ok(Number.isFinite(r.end) && Math.abs(r.end - 50) < 0.05, `stable at ${frame}ms frames`);
    assert.ok(r.max < 51);
  }
});

test("the visuals are continuous and symmetric", () => {
  const centre = splitVisuals(50);
  assert.deepEqual([centre.chef, centre.rapper, centre.center, centre.handle], [0, 0, 1, 1]);
  assert.equal(splitVisuals(100).chef, 1);
  assert.equal(splitVisuals(0).rapper, 1);
  assert.equal(splitVisuals(100).handle, 0, "the divider is gone when a side is fully open");
  assert.equal(splitVisuals(0).handle, 0);
  for (let p = 0; p <= 100; p += 1) {
    const a = splitVisuals(p);
    const b = splitVisuals(100 - p);
    assert.ok(Math.abs(a.chef - b.rapper) < 1e-9, "mirror image");
    const next = splitVisuals(Math.min(100, p + 1));
    assert.ok(Math.abs(next.chef - a.chef) < 0.09 && Math.abs(next.center - a.center) < 0.09, "no jumps");
  }
});
