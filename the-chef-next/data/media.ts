/**
 * Curated launch media. Only optimized web renditions live in /public —
 * never the original Drive MOV files. Source → rendition mapping, encode
 * settings and the clips deliberately left out are documented in
 * docs/LAUNCH-2026-11-06.md → Media.
 */

export type LoopVideo = { src: string; poster: string };

/** Entertainer hero loop — 65A1C3BB.MOV (full-length studio shot of Chef in
 *  the blue suit; replaces the tighter IMG_3725 crop per client feedback).
 *  0.3–12.9s → 11.8s seamless crossfade loop, dark ember grade + vignette
 *  baked in, 576×1024 H.264, no audio track (0.27 MB from 11.4 MB). */
export const ENTERTAINER_HERO: LoopVideo | null = {
  src: "/assets/video/entertainer-hero-studio.mp4",
  poster: "/assets/video/entertainer-hero-studio-poster.jpg",
};

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

/** IMG_0068.MOV — guest at an event: "…please book The Chef's catering
 *  services." Trimmed at 8.45s (before the end-of-clip "Hey!" + noise burst)
 *  with a 0.47s audio fade-out and a short video fade (Book section). */
export const BOOK_THE_CHEF_VIDEO: EndorsementVideo | null = {
  id: "book-the-chef",
  src: "/assets/video/book-the-chef-endorsement.mp4",
  poster: "/assets/video/book-the-chef-endorsement-poster.jpg",
  caption: "“…please book The Chef.” — event guest",
  label: "Video: a guest at a Chef Frankie event recommends booking The Chef",
  width: 540,
  height: 960,
};

/** IMG_0067.MOV — guest: "The food was amazing. Thank you to The Chef
 *  Catering Services." (Reviews; kept separate from the written reviews). */
export const REVIEW_VIDEO: EndorsementVideo | null = {
  id: "guest-review",
  src: "/assets/video/guest-review-food-was-amazing.mp4",
  poster: "/assets/video/guest-review-food-was-amazing-poster.jpg",
  caption: "“The food was amazing.” — event guest",
  label: "Video review: a guest at a catered event says the food was amazing and thanks The Chef Catering Services",
  width: 540,
  height: 960,
};

export type FilmLoop = LoopVideo & {
  width: number;
  height: number;
  kicker: string;
  title: string;
  /** Accessible description of what the clip shows. */
  label: string;
};

/** 898383c2.MOV — Chef's own night-drive footage (city skyline, Chef at the
 *  wheel, close profile). Edit: 3.6–6.6s + 12.6–24.2s (0.5s crossfade),
 *  avoiding the storefront-logo shots and the black tail; light contrast lift,
 *  vignette, fades to black for a clean loop. 960×540 H.264, 30 fps, 14.1s,
 *  audio removed (1.10 MB from 23.4 MB). Lazy-loaded on the Entertainer side. */
export const ENTERTAINER_FILM: FilmLoop | null = {
  src: "/assets/video/entertainer-night-drive.mp4",
  poster: "/assets/video/entertainer-night-drive-poster.jpg",
  width: 960,
  height: 540,
  kicker: "Visuals",
  title: "After Dark",
  label: "Short silent film: a night city skyline, then The Chef driving through the city at night",
};
