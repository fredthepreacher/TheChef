"use client";

import { useEffect } from "react";

/**
 * Adds a class to <body> while mounted.
 * Lets the original stylesheet's `body.gallery-page` / `body.reviews-page`
 * selectors keep working unchanged.
 */
export default function BodyClass({ className }: { className: string }) {
  useEffect(() => {
    const classes = className.split(" ").filter(Boolean);
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [className]);

  return null;
}
