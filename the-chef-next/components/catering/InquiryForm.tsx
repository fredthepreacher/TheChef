"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { MENU_NOTES_MAX } from "@/lib/crm/domain";
import { menuCategories } from "@/data/menu";
import { CATERING_PHONE, CATERING_PHONE_DISPLAY, CHEF_NAME, tel } from "@/data/contact";
import { groupSelection, itemKey } from "@/lib/catering/menu-catalog";
import { useEventMenu } from "@/lib/catering/event-menu-store";

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

/** Customer-facing service types → existing CRM service_style values. */
const SERVICE_TYPES = [
  { value: "drop_off", label: "Drop-off", hint: "Chef delivers the food ready to serve" },
  { value: "full_service", label: "Staffed catering", hint: "Setup and service at your event" },
  { value: "private_chef", label: "Private chef", hint: "Chef cooks for you and your guests" },
  { value: "unsure", label: "Other / not sure", hint: "Chef will recommend the right fit" },
] as const;

const BUDGETS = [
  "",
  "Under $1,000",
  "$1,000 – $2,500",
  "$2,500 – $5,000",
  "$5,000 – $10,000",
  "$10,000+",
  "Prefer to discuss",
];

const EVENT_TYPES = [
  "Wedding",
  "Birthday",
  "Baby shower",
  "Corporate event",
  "Church gathering",
  "Graduation",
  "Holiday party",
  "Private dinner",
  "Memorial / repast",
];

type Summary = { date: string; guests: string; location: string; type: string };

export default function InquiryForm({
  selectedPackage,
  initialService,
}: {
  selectedPackage: string;
  initialService: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [minDate, setMinDate] = useState<string>();
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary>({ date: "", guests: "", location: "", type: "" });
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string>();
  const requestId = useRef<string>();
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const { selected, toggle, remove, clear, isFull } = useEventMenu();
  const groups = groupSelection(selected);

  useEffect(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setMinDate(d.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    if (!ready || !key || !widget.current || !window.turnstile) return;
    widgetId.current = window.turnstile.render(widget.current, {
      sitekey: key,
      action: "catering_inquiry",
      "response-field": false,
      theme: "dark",
      callback: (value: string) => setToken(value),
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    });
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
    };
  }, [ready, key]);

  function resetTurnstile() {
    if (widgetId.current) {
      window.turnstile?.reset(widgetId.current);
      setToken("");
    }
  }

  function onFormChange(e: React.FormEvent<HTMLFormElement>) {
    const f = new FormData(e.currentTarget);
    setSummary({
      date: String(f.get("requested_date") ?? ""),
      guests: String(f.get("guest_count") ?? ""),
      location: String(f.get("event_location") ?? ""),
      type: String(f.get("event_type") ?? ""),
    });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    // Same UUID for a retry after an unknown outcome (network error), so the
    // server can de-duplicate; a fresh one after any definitive rejection.
    requestId.current ??= crypto.randomUUID();
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/catering/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(form),
          selected_menu_items: selected,
          request_id: requestId.current,
          consent: form.get("consent") === "on",
          turnstile_token: token,
        }),
      });
      const result = await response.json().catch(() => ({}));
      setMessage(result.message ?? "Unable to submit. Please try again or call Chef.");
      setSuccess(response.ok);
      if (response.ok) {
        clear();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        if (response.status !== 409) requestId.current = undefined;
        resetTurnstile();
      }
    } catch {
      setMessage(
        "We could not confirm receipt. Please retry with the same details or call Chef directly.",
      );
      resetTurnstile();
    } finally {
      setBusy(false);
    }
  }

  if (success)
    return (
      <section className="crm-panel event-success" role="status" aria-live="polite">
        <p className="event-kicker">Request received</p>
        <h2>Your request is in.</h2>
        <p>{message}</p>
        <ol className="event-next">
          <li><strong>{CHEF_NAME} reviews</strong> your date, guest count and menu.</li>
          <li><strong>You receive a custom quote</strong> — add or trim dishes to fit your budget.</li>
          <li><strong>Approve the quote and pay the deposit</strong> to reserve your date.</li>
        </ol>
        <p className="event-fine">
          Your date is <strong>not reserved</strong> until your quote is approved and the required deposit is paid.
          Need to add something or have a close date? Call <a href={tel(CATERING_PHONE)}>{CATERING_PHONE_DISPLAY}</a>.
        </p>
        <Link href="/">Return to the website</Link>
      </section>
    );

  return (
    <form className="inquiry-form event-form" onSubmit={submit} onChange={onFormChange}>
      <input type="hidden" name="package_interest" value={selectedPackage} />

      {/* 1 — MENU */}
      <fieldset disabled={busy}>
        <legend><span className="event-step">1</span> Your menu</legend>
        <p className="event-help">
          Tap dishes to add them. Chef confirms every selection — and can add or remove items to fit your budget.
        </p>

        {groups.length > 0 ? (
          <div className="event-selected" aria-live="polite">
            <p className="event-selected-head">
              {selected.length} {selected.length === 1 ? "dish" : "dishes"} selected
            </p>
            {groups.map((g) => (
              <div className="event-menu-group" key={g.category}>
                <p className="event-menu-group-title">{g.category}</p>
                <ul className="event-chip-list">
                  {g.items.map((i) => (
                    <li key={i.key}>
                      <button type="button" className="event-chip" onClick={() => remove(i.key)} aria-label={`Remove ${i.name}`}>
                        {i.name} <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="event-empty">No dishes selected yet — pick a few below, or describe what you&apos;d like in the notes.</p>
        )}

        <div className="event-picker">
          {menuCategories.filter((c) => c.columns).map((cat) => {
            const open = openCat === cat.id;
            const items = cat.columns!.flat();
            const count = items.filter((i) => selected.includes(itemKey(cat.title, i.name))).length;
            return (
              <div className={`event-picker-cat${open ? " open" : ""}`} key={cat.id}>
                <button
                  type="button"
                  className="event-picker-toggle"
                  aria-expanded={open}
                  aria-controls={`pick-${cat.id}`}
                  onClick={() => setOpenCat(open ? null : cat.id)}
                >
                  <span>{cat.title}</span>
                  {count > 0 && <span className="lux-cat-count">{count}</span>}
                  <span className="event-picker-caret" aria-hidden="true">{open ? "−" : "+"}</span>
                </button>
                {open && (
                  <div className="event-picker-items" id={`pick-${cat.id}`}>
                    {items.map((item) => {
                      const k = itemKey(cat.title, item.name);
                      const on = selected.includes(k);
                      return (
                        <button
                          type="button"
                          key={item.name}
                          className={`lux-item-pick${on ? " is-picked" : ""}`}
                          aria-pressed={on}
                          disabled={!on && isFull}
                          onClick={() => toggle(k)}
                        >
                          <span className="lux-item-text">
                            <span className="lux-item-name">{item.name}</span>
                            <span className="lux-item-note">{item.note}</span>
                          </span>
                          <span className="lux-item-mark" aria-hidden="true">{on ? "✓" : "+"}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <label>
          Menu ideas or special requests
          <textarea
            name="menu_notes"
            maxLength={MENU_NOTES_MAX}
            placeholder="Anything not on the menu, portion ideas, a family recipe, a theme…"
          />
        </label>
      </fieldset>

      {/* 2 — EVENT */}
      <fieldset disabled={busy}>
        <legend><span className="event-step">2</span> Your event</legend>
        <div className="crm-columns">
          <label>
            Event type
            <input
              name="event_type"
              list="event-type-options"
              placeholder="Wedding, birthday, corporate dinner…"
              maxLength={200}
              required
            />
            <datalist id="event-type-options">
              {EVENT_TYPES.map((t) => <option key={t} value={t} />)}
            </datalist>
          </label>
          <label>
            Event date
            <input name="requested_date" type="date" min={minDate} required />
          </label>
          <label>
            Start time (if known)
            <input name="requested_start_time" type="time" />
          </label>
          <label>
            Estimated guests
            <input name="guest_count" type="number" inputMode="numeric" min="1" max="10000" required />
          </label>
          <label>
            Event city &amp; ZIP
            <input name="event_location" autoComplete="address-level2" placeholder="e.g. St. Louis, 63101" minLength={2} maxLength={200} required />
          </label>
          <label>
            Venue name (if known)
            <input name="venue_name" maxLength={200} />
          </label>
        </div>
        <label>
          Venue street address (if known)
          <input name="venue_address" autoComplete="street-address" maxLength={200} />
        </label>

        <div className="event-radio-group" role="radiogroup" aria-labelledby="service-type-label">
          <p id="service-type-label" className="event-radio-legend">Type of service</p>
          <div className="event-radio-grid">
            {SERVICE_TYPES.map((s) => (
              <label className="event-radio" key={s.value}>
                <input
                  type="radio"
                  name="service_style"
                  value={s.value}
                  defaultChecked={s.value === initialService}
                  required
                />
                <span>
                  <strong>{s.label}</strong>
                  <small>{s.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </div>

        <label>
          Does your venue require a certificate of insurance?
          <select name="coi_required" defaultValue="unknown">
            <option value="unknown">Not sure</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </fieldset>

      {/* 3 — CONTACT */}
      <fieldset disabled={busy}>
        <legend><span className="event-step">3</span> Your details</legend>
        <div className="crm-columns">
          <label>
            First name
            <input name="first_name" autoComplete="given-name" required maxLength={200} />
          </label>
          <label>
            Last name
            <input name="last_name" autoComplete="family-name" required maxLength={200} />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
          <label>
            Phone
            <input name="phone" type="tel" autoComplete="tel" required maxLength={30} />
          </label>
        </div>
        <label>
          How should Chef contact you?
          <select name="preferred_contact_method" defaultValue="email">
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
        </label>
      </fieldset>

      {/* 4 — EXTRAS */}
      <fieldset disabled={busy}>
        <legend><span className="event-step">4</span> Final touches</legend>
        <label>
          Dietary needs / allergies
          <textarea name="dietary_notes" maxLength={4000} placeholder="Allergies, vegetarian guests, no pork, gluten-free…" />
        </label>
        <label>
          Special requests
          <textarea
            name="inquiry_notes"
            maxLength={4000}
            placeholder="Setup needs, rentals, timing, venue rules or anything else Chef should know"
          />
        </label>
        <div className="crm-columns">
          <label>
            Budget range (optional)
            <select name="budget" defaultValue="">
              {BUDGETS.map((b) => (
                <option key={b} value={b}>{b || "Choose a range"}</option>
              ))}
            </select>
          </label>
          <label>
            How did you hear about Chef? (optional)
            <input name="referral_source" maxLength={200} placeholder="Google, Instagram, a friend…" />
          </label>
        </div>
      </fieldset>

      <div className="inquiry-honey" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* REVIEW */}
      <section className="event-review" aria-labelledby="event-review-title">
        <h2 id="event-review-title">Review your request</h2>
        <dl className="event-review-grid">
          <div><dt>Event</dt><dd>{summary.type || "—"}</dd></div>
          <div><dt>Date</dt><dd>{summary.date || "—"}</dd></div>
          <div><dt>Guests</dt><dd>{summary.guests || "—"}</dd></div>
          <div><dt>Location</dt><dd>{summary.location || "—"}</dd></div>
          <div><dt>Menu</dt><dd>{selected.length ? `${selected.length} ${selected.length === 1 ? "dish" : "dishes"}` : "Chef to suggest"}</dd></div>
        </dl>
        <p className="event-promise">
          Submitting sends your request to {CHEF_NAME}. It <strong>does not reserve your date or confirm a price</strong>.
          Your date is reserved once your custom quote is approved and the required deposit is paid.
        </p>
      </section>

      <label className="inquiry-check">
        <input type="checkbox" name="consent" required />
        <span>
          I agree to be contacted about this catering request. This does not subscribe me to marketing messages.
        </span>
      </label>
      <p className="event-fine">
        Your details are used by The Chef Catering only to respond to your request and plan your event.
      </p>
      {key && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            onReady={() => setReady(true)}
          />
          <div ref={widget} />
        </>
      )}
      {message && (
        <p className="crm-notice" role="alert">
          {message}
        </p>
      )}
      <button className="event-submit" disabled={busy || Boolean(key && !token)} type="submit">
        {busy ? "Sending your request…" : "Send My Event Request"}
      </button>
    </form>
  );
}
