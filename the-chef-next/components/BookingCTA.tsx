import { CATERING_PHONE, tel } from "@/data/contact";

/**
 * Catering-only structured intake, with a direct phone fallback.
 */
export default function BookingCTA() {
  return (
    <section className="booking-cta" id="caterer-book">
      <img
        className="booking-logo"
        src="/assets/brand/the-chef-catering-logo.png"
        alt="The Chef Catering Services — Five Star Meals on Wheels"
        width={320}
        height={320}
        loading="lazy"
      />
      <p className="section-tag" style={{ textAlign: "center" }}>Reserve Your Date</p>
      <h2 className="section-title">Ready to Book?</h2>
      <p className="section-body">
        Available for private events, celebrations, and special occasions. Reach out to check availability and discuss
        your custom menu.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <a className="btn-primary" href="/catering/inquiry">Send an Inquiry</a>
        <a className="btn-ghost" href={tel(CATERING_PHONE)}>Call Directly</a>
      </div>
    </section>
  );
}
