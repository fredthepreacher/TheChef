import { CATERING_PHONE, CATERING_PHONE_DISPLAY, tel } from "@/data/contact";
import { BOOK_THE_CHEF_VIDEO } from "@/data/media";
import EndorsementVideo from "./catering/EndorsementVideo";

/** Process facts only — each is true by construction of the request → quote → deposit flow. */
const points = [
  "A menu built around your guests",
  "A custom quote from Chef Frankie",
  "Your date locked with the deposit",
];

/**
 * Book The Chef — placed right after the menu so guests who have just picked
 * dishes meet the strongest social proof (the guest endorsement) and the two
 * booking actions before scrolling further.
 */
export default function BookingCTA() {
  const clip = BOOK_THE_CHEF_VIDEO;
  return (
    <section className={`booking-cta${clip ? " booking-cta--with-video" : ""}`} id="caterer-book">
      {clip && (
        <div className="booking-cta-media" data-reveal="">
          <EndorsementVideo clip={clip} />
        </div>
      )}
      <div className="booking-cta-copy" data-reveal="" style={{ "--reveal-delay": "120ms" } as React.CSSProperties}>
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
        <ul className="booking-points">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <div className="booking-cta-btns">
          <a className="btn-primary" href="/catering/inquiry">Build My Event</a>
          <a className="btn-ghost" href={tel(CATERING_PHONE)}>Call {CATERING_PHONE_DISPLAY}</a>
        </div>
      </div>
    </section>
  );
}
