import { reviews, type Review } from "@/data/reviews";

const FacebookIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
);

const GoogleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="#4285F4"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
);

const Quote = ({ quote }: { quote: Review["quote"] }) => (
  <>
    {quote.map((seg, i) => (seg.strong ? <strong key={i}>{seg.text}</strong> : <span key={i}>{seg.text}</span>))}
  </>
);

const Platform = ({ platform }: { platform?: Review["platform"] }) =>
  platform ? (
    <div className="rv-card-platform">
      {platform === "facebook" ? <FacebookIcon /> : <GoogleIcon />}
      {platform === "facebook" ? "Facebook Recommendation" : "Google Review"}
    </div>
  ) : null;

const Tags = ({ tags }: { tags?: string[] }) =>
  tags && tags.length > 0 ? (
    <div className="rv-card-tags">
      {tags.map((t) => <span key={t}>{t}</span>)}
    </div>
  ) : null;

/** Testimonials grid — wide featured card first, then the standard cards. */
export default function ReviewsSection() {
  const wide = reviews.find((r) => r.wide);
  const rest = reviews.filter((r) => !r.wide);

  return (
    <div className="rv-section">
      <div className="rv-section-head">
        <span className="rv-section-tag">Client Testimonials</span>
        <h2 className="rv-section-title">Voices From Our Table</h2>
      </div>

      <div className="rv-grid">
        {wide && (
          <div className="rv-card-wide">
            <div className="rv-card">
              <div className="rv-wide-left">
                <div className="rv-card-stars">★★★★★</div>
                <p className="rv-card-quote">&ldquo;<Quote quote={wide.quote} />&rdquo;</p>
                <div className="rv-card-meta">
                  <div className="rv-card-name">{wide.name}</div>
                  <div className="rv-card-event">{wide.event}</div>
                  <Platform platform={wide.platform} />
                </div>
              </div>
              <div className="rv-wide-right">
                {wide.highlights?.map((h, i) => (
                  <div className="rv-wide-highlight" key={i}>
                    <p><Quote quote={h} /></p>
                  </div>
                ))}
                <Tags tags={wide.tags} />
              </div>
            </div>
          </div>
        )}

        {rest.map((r) => (
          <div className="rv-card" key={r.name}>
            <div className="rv-card-stars">★★★★★</div>
            <p className="rv-card-quote">&ldquo;<Quote quote={r.quote} />&rdquo;</p>
            <div className="rv-card-meta">
              <div className="rv-card-name">{r.name}</div>
              <div className="rv-card-event">{r.event}</div>
              <Platform platform={r.platform} />
              <Tags tags={r.tags} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
