import { CATERING_PHONE, CATERING_PHONE_DISPLAY, CHEF_NAME, tel } from "@/data/contact";
import { DELIVERY_LANE_ENABLED } from "@/data/launch";

/**
 * Conversion sections for the catering world. Copy here only states facts that
 * are true by construction of the process (request → Chef review → custom
 * quote → deposit locks the date). Anything the owner has not approved yet
 * (deposit %, timing, delivery rules, cancellations) stays out.
 */

const lanes = [
  {
    id: "event",
    title: "Catering Event",
    body: "Weddings, birthdays, corporate dinners, church gatherings and celebrations. Pick your dishes and Chef builds the spread around your guest count.",
    href: "/catering/inquiry",
    cta: "Plan My Event",
  },
  {
    id: "private-chef",
    title: "Private Chef",
    body: "An intimate dinner or special occasion with Chef Frankie cooking for you and your guests.",
    href: "/catering/inquiry?service=private_chef",
    cta: "Request Private Chef",
  },
];

export function ServiceLanes() {
  return (
    <section className="section cat-lanes" id="caterer-services" aria-labelledby="caterer-services-title">
      <p className="section-tag">Choose What You Need</p>
      <h2 className="section-title" id="caterer-services-title">How can Chef serve you?</h2>
      <div className={`cat-lane-grid${DELIVERY_LANE_ENABLED ? " cat-lane-grid--three" : ""}`}>
        {lanes.map((l) => (
          <a className="cat-lane" href={l.href} key={l.id}>
            <h3>{l.title}</h3>
            <p>{l.body}</p>
            <span className="cat-lane-cta">{l.cta} →</span>
          </a>
        ))}
        {/* Lane B (scheduled delivery) renders only once its business rules are confirmed. */}
      </div>
    </section>
  );
}

const steps = [
  { t: "Choose your menu", d: "Tap the dishes you love — or tell Chef you want something custom." },
  { t: "Share your event details", d: "Date, guest count, location and any dietary needs." },
  { t: "Chef confirms & quotes", d: `${CHEF_NAME} checks availability and sends your custom quote. Add or trim dishes to fit your budget.` },
  { t: "Approve & pay the deposit", d: "Your quote shows the deposit, the remaining balance and when each is due." },
  { t: "Your date is locked", d: "Once the deposit is received, your date is reserved and Chef starts planning." },
];

export function HowItWorks() {
  return (
    <section className="section cat-how" id="caterer-how" aria-labelledby="caterer-how-title">
      <p className="section-tag">How It Works</p>
      <h2 className="section-title" id="caterer-how-title">From first bite to booked date</h2>
      <ol className="cat-steps">
        {steps.map((s, i) => (
          <li className="cat-step" key={s.t}>
            <span className="cat-step-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
          </li>
        ))}
      </ol>
      <p className="cat-how-note">Submitting a request does not reserve your date — the deposit does.</p>
    </section>
  );
}

const faqs: { q: string; a: string }[] = [
  {
    q: "Does submitting a request reserve my date?",
    a: "No. Your request lets Chef review availability and prepare a custom quote. Your date is reserved only after you approve the quote and the required deposit is paid.",
  },
  {
    q: "Can I change the menu or work within a budget?",
    a: "Yes. Every quote is custom — add dishes, swap them or trim the menu to fit your budget, and Chef will update your quote. Special requests that aren't on the menu are welcome too.",
  },
  {
    q: "What if a guest has allergies or dietary needs?",
    a: "Note them in your request. Chef reviews every allergy and dietary note with you before your menu is confirmed.",
  },
  {
    q: "How will I hear back?",
    a: `${CHEF_NAME} follows up by your preferred contact method (email or phone). If your event is soon, call ${CATERING_PHONE_DISPLAY} after sending your request.`,
  },
];

export function CateringFAQ() {
  return (
    <section className="section cat-faq" id="caterer-faq" aria-labelledby="caterer-faq-title">
      <p className="section-tag">Questions</p>
      <h2 className="section-title" id="caterer-faq-title">Good to know</h2>
      <div className="cat-faq-list">
        {faqs.map((f) => (
          <details className="cat-faq-item" key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
        {/* Deposit % / balance timing / cancellation FAQs: add only after the owner approves the
            wording (data/launch.ts → DEPOSIT_POLICY_APPROVED). */}
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section className="cat-final" id="caterer-start" aria-labelledby="caterer-start-title">
      <p className="section-tag" style={{ textAlign: "center" }}>✦ Five Star Meals · Served With Love ✦</p>
      <h2 className="section-title" id="caterer-start-title">Every event deserves<br />a five-star experience.</h2>
      <p className="section-body">
        Build your menu and tell {CHEF_NAME} about your event. We&apos;ll review availability, confirm your selections,
        and send your custom quote.
      </p>
      <div className="cat-final-btns">
        <a
          className="btn-primary"
          href="/catering/inquiry"
          style={{ background: "var(--gold)", color: "#0a0800", boxShadow: "0 8px 30px rgba(201,168,76,.30)" }}
        >
          Start My Catering Request
        </a>
        <a className="btn-ghost" href={tel(CATERING_PHONE)}>Call {CATERING_PHONE_DISPLAY}</a>
      </div>
    </section>
  );
}
