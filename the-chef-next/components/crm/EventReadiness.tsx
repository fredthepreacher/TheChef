import { label } from "@/lib/crm/domain";
import type { EventReadiness as Readiness } from "@/lib/crm/readiness";

export function EventReadiness({ readiness }: { readiness: Readiness }) {
  return (
    <section className="crm-panel crm-readiness">
      <div className="crm-section-heading">
        <div>
          <p className="crm-eyebrow">Operational readiness</p>
          <h2>{label(readiness.status)}</h2>
        </div>
        <strong>{readiness.percentage}%</strong>
      </div>
      <div
        className="crm-progress"
        role="progressbar"
        aria-label="Event readiness"
        aria-valuenow={readiness.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${readiness.percentage}%` }} />
      </div>
      <div className="crm-readiness-grid">
        {readiness.indicators.map((indicator) => (
          <div className="crm-readiness-row" key={indicator.key}>
            <span>
              <strong>{indicator.label}</strong>
              <small>{indicator.detail}</small>
            </span>
            <span className={`crm-state crm-state-${indicator.state}`}>
              {label(indicator.state)}
            </span>
          </div>
        ))}
      </div>
      {readiness.blockers.length > 0 && (
        <div className="crm-blockers">
          <strong>Blockers</strong>
          <ul>
            {readiness.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
