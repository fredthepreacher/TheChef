"use client";

import { useEffect } from "react";

/** Fullscreen modal for viewing menu documents. Esc / backdrop click closes. */
export default function MenuModal({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [src, onClose]);

  return (
    <div
      className={`menu-modal-backdrop${src ? " open" : ""}`}
      id="menuModalBackdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Full size menu"
    >
      <div className="menu-modal" onClick={(e) => e.stopPropagation()}>
        <button className="menu-modal-close" onClick={onClose} aria-label="Close menu">✕</button>
        {src && <img id="menuModalImg" src={src} alt="Full size catering menu" />}
      </div>
    </div>
  );
}
