"use client";

import { useCallback, useEffect } from "react";
import { allImages } from "@/data/gallery";

type Props = {
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

/** Fullscreen gallery lightbox with prev/next, keyboard, and backdrop close. */
export default function Lightbox({ index, onClose, onNavigate }: Props) {
  const nav = useCallback(
    (d: number) => {
      if (index === null) return;
      onNavigate((index + d + allImages.length) % allImages.length);
    },
    [index, onNavigate]
  );

  useEffect(() => {
    if (index === null) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nav(1);
      if (e.key === "ArrowLeft") nav(-1);
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [index, nav, onClose]);

  const img = index !== null ? allImages[index] : null;

  return (
    <div
      className={`lightbox${img ? " open" : ""}`}
      id="lightbox"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      <button className="lb-close" onClick={onClose} aria-label="Close viewer">✕</button>
      <button className="lb-nav lb-prev" onClick={() => nav(-1)} aria-label="Previous image">‹</button>
      <div className="lb-img-wrap">
        {img && <img id="lb-img" src={img.src} alt={img.alt} />}
      </div>
      <button className="lb-nav lb-next" onClick={() => nav(1)} aria-label="Next image">›</button>
      {img && index !== null && (
        <div className="lb-caption" id="lb-caption">
          {img.caption} &nbsp;·&nbsp; {index + 1} / {allImages.length}
        </div>
      )}
    </div>
  );
}
