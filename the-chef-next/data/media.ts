/**
 * Curated launch media. Only optimized web renditions live in /public —
 * never the original Drive MOV files. See docs/LAUNCH-2026-11-06.md → Media.
 */

export type LoopVideo = { src: string; poster: string };

/** Entertainer hero performance loop (muted, decorative, 8–12s).
 *  `null` until an optimized rendition from IMG_3725.MOV is approved. */
export const ENTERTAINER_HERO: LoopVideo | null = null;

export type EndorsementVideo = {
  id: string;
  src: string;
  poster: string;
  /** Visible caption — must match what is actually said/shown in the clip. */
  caption: string;
  /** Accessible description of the clip for screen readers. */
  label: string;
  width: number;
  height: number;
};

/** "Book The Chef" vertical endorsement (Book section). */
export const BOOK_THE_CHEF_VIDEO: EndorsementVideo | null = null;

/** Second endorsement clip (Reviews / social proof). */
export const REVIEW_VIDEO: EndorsementVideo | null = null;
