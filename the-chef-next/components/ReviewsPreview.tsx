import Link from "next/link";
import { homeReviews } from "@/data/reviews";

/** Homepage catering reviews preview — three cards + link to the full reviews page. */
export default function ReviewsPreview() {
  return (
    <section className="section" id="caterer-reviews">
      <p className="section-tag">Client Love</p>
      <h2 className="section-title">What Guests Are Saying</h2>
      <p className="section-body" style={{ marginBottom: 36 }}>
        Real reviews from real clients — from weddings and corporate events to private dinners and baby showers.
      </p>

      <div className="reviews-grid">
        {homeReviews.map((r) => (
          <div className="review-card" key={r.name}>
            <div className="review-stars">★★★★★</div>
            <p className="review-text">
              {r.quote.map((seg, i) =>
                seg.strong ? <strong key={i} style={{ color: "#fff" }}>{seg.text}</strong> : <span key={i}>{seg.text}</span>
              )}
            </p>
            <p className="review-author">— <strong>{r.name}</strong> · {r.event}</p>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <Link
          href="/reviews"
          className="btn-primary"
          style={{
            background: "transparent",
            color: "var(--gold)",
            border: "1px solid rgba(201,168,76,.45)",
            boxShadow: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Read All Reviews
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
        </Link>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,.28)", letterSpacing: ".06em" }}>9 verified client reviews</p>
      </div>
    </section>
  );
}
