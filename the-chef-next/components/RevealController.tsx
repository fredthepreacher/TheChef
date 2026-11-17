"use client";

import { useEffect } from "react";

/**
 * Scroll-reveal for `[data-reveal]` blocks inside one world.
 *
 * Progressive: content is fully visible until this runs. It then marks the
 * root `reveal-ready` (which arms the hidden state in refine.css) and fades
 * each block up as it enters the viewport — once, never again. Skipped
 * entirely for prefers-reduced-motion or browsers without IntersectionObserver.
 * Uses the CSS `translate` property so hover `transform`s still compose.
 */
export default function RevealController({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-revealed");
          io.unobserve(e.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    root.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    root.classList.add("reveal-ready");
    return () => {
      io.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, [rootId]);

  return null;
}
