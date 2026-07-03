"use client";

import { forwardRef } from "react";

type Props = {
  locked: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
};

/** The vertical drag handle with the white DRAG pill. */
const SplitHandle = forwardRef<HTMLDivElement, Props>(function SplitHandle(
  { locked, onPointerDown, onKeyDown },
  ref
) {
  return (
    <div
      className={`handle${locked ? " is-locked" : ""}`}
      id="handle"
      ref={ref}
      role="slider"
      aria-label="Drag to reveal The Chef Catering or The Chef Music"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={50}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <div className="handle-pill" id="handlePill">DRAG</div>
    </div>
  );
});

export default SplitHandle;
