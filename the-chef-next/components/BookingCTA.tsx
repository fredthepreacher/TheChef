import { CATERING_PHONE, CATERING_PHONE_DISPLAY, tel } from "@/data/contact";
import { BOOK_THE_CHEF_VIDEO } from "@/data/media";
import EndorsementVideo from "./catering/EndorsementVideo";

/**
 * Book The Chef — structured catering intake with a direct phone fallback,
 * plus the vertical "Book the Chef" endorsement clip when one is approved.
 */
export default function BookingCTA() {
  const clip = BOOK_THE_CHEF_VIDEO;
  return (
    <section className={`booking-cta${clip ? " booking-cta--with-video" : ""}`} id="caterer-book">
      {clip && <EndorsementVideo clip={clip} />}
      <div className="booking-cta-copy">
        <img
          className="booking-logo"
          src="/assets/brand/the-chef-catering-logo.png"
          alt="The Chef Catering Services — Five Star Meals on Wheels"
          width={320}
          height={320}
          loading="lazy"
        />
        <p className="section-tag" style={{ textAlign: "center" }}>Book The Chef · Reserve Your Date</p>
        <h2 className="section-title">Ready to Book?</h2>
        <p className="section-body">
          Build your menu and tell Chef Frankie about your event. We&apos;ll review availability, confirm your
          selections, and send your custom quote.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a className="btn-primary" href="/catering/inquiry">Build My Event</a>
          <a className="btn-ghost" href={tel(CATERING_PHONE)}>Call {CATERING_PHONE_DISPLAY}</a>
        </div>
      </div>
    </section>
  );
}
