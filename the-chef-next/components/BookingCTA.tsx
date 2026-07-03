import { CATERING_EMAIL, CATERING_PHONE, mailto, tel } from "@/data/contact";

/**
 * Booking CTA — mailto/tel for now.
 * TODO (future): swap the mailto for a booking form posting to an API route
 * (app/api/inquiry/route.ts) with the email provider key in an env var.
 * Do NOT hardcode secrets here.
 */
export default function BookingCTA() {
  return (
    <section className="booking-cta" id="caterer-book">
      <img
        className="booking-logo"
        src="/assets/the-logo-tight.jpg"
        alt="The Chef Catering Services — Five Star Meals on Wheels"
      />
      <p className="section-tag" style={{ textAlign: "center" }}>Reserve Your Date</p>
      <h2 className="section-title">Ready to Book?</h2>
      <p className="section-body">
        Available for private events, celebrations, and special occasions. Reach out to check availability and discuss
        your custom menu.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <a className="btn-primary" href={mailto(CATERING_EMAIL, "Catering Inquiry")}>Send an Inquiry</a>
        <a className="btn-ghost" href={tel(CATERING_PHONE)}>Call Directly</a>
      </div>
    </section>
  );
}
