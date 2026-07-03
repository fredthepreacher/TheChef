/**
 * Music data — The Chef Music side.
 *
 * NOTE: cover images should live at the paths below in
 * public/assets/music/covers/. If a cover file is missing, TrackCard
 * renders a styled fallback instead of a broken image.
 */

export type Track = {
  title: string;
  artist: string;
  audio: string;
  cover: string;
  type: string;
  /** rough runtime, shown on the card */
  length: string;
};

export const tracks: Track[] = [
  {
    title: "Patiently Waiting",
    artist: "The Chef",
    audio: "/assets/music/patiently-waiting.mp3",
    cover: "/assets/music/covers/patiently-waiting.jpeg",
    type: "Single",
    length: "2:57",
  },
  {
    title: "Ride With You",
    artist: "The Chef",
    audio: "/assets/music/ride-with-you.mp3",
    cover: "/assets/music/covers/ride-with-you.jpg",
    type: "Single",
    length: "3:17",
  },
  {
    title: "Pain",
    artist: "The Chef",
    audio: "/assets/music/pain-by-the-chef.mp3",
    cover: "/assets/music/covers/pain-the-chef.jpg",
    type: "Single",
    length: "5:20",
  },
];

export const featuredProject = {
  title: "From Overlooked to Overbooked",
  artist: "The Chef",
  cover: "/assets/music/covers/from-overlooked-to-overbooked.jpeg",
  label: "Featured Mixtape",
  description:
    "From overlooked to overbooked — The Chef turns hunger, pressure, pain, and ambition into a sound built for people who had to grind before they were seen.",
};
