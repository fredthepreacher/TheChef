"use client";

import { forwardRef } from "react";

/**
 * The divider between the two worlds: a hairline of light with a small glass
 * grip. SplitStage attaches the pointer and keyboard behaviour and moves the
 * surrounding track; this component is only the control's markup.
 */
const SplitHandle = forwardRef<HTMLDivElement>(function SplitHandle(_props, ref) {
  return (
    <div
      className="handle"
      id="handle"
      ref={ref}
      role="slider"
      aria-label="Divider between Catering and Entertainer. Right arrow opens Catering, left arrow opens Entertainer."
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={50}
      aria-valuetext="Even split"
      tabIndex={0}
    >
      <span className="handle-line" aria-hidden="true" />
      <span className="handle-knob" aria-hidden="true">
        <svg className="handle-chevron handle-chevron--left" width="9" height="14" viewBox="0 0 9 14" fill="none">
          <path d="M7.5 1 1.5 7l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg className="handle-chevron handle-chevron--right" width="9" height="14" viewBox="0 0 9 14" fill="none">
          <path d="M1.5 1 7.5 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
});

export default SplitHandle;
