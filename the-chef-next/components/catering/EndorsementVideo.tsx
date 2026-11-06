import type { EndorsementVideo as Clip } from "@/data/media";

/**
 * User-controlled testimonial/endorsement clip in a phone-shaped frame.
 * Never autoplays and never plays sound on its own: preload="none" keeps it
 * off the critical path, the poster shows until the guest taps play.
 */
export default function EndorsementVideo({ clip }: { clip: Clip }) {
  return (
    <figure className="endorse-frame">
      <video
        className="endorse-video"
        controls
        playsInline
        preload="none"
        poster={clip.poster}
        width={clip.width}
        height={clip.height}
        aria-label={clip.label}
      >
        <source src={clip.src} type="video/mp4" />
      </video>
      <figcaption>{clip.caption}</figcaption>
    </figure>
  );
}
