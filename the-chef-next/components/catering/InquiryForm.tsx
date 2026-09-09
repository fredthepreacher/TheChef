"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { packageOptions, label } from "@/lib/crm/domain";
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
export default function InquiryForm({
  selectedPackage,
}: {
  selectedPackage: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string>();
  const requestId = useRef<string>();
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
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
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    requestId.current ??= crypto.randomUUID();
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/catering/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(form),
          request_id: requestId.current,
          consent: form.get("consent") === "on",
          turnstile_token: token,
        }),
      });
      const result = await response.json();
      setMessage(result.message ?? "Unable to submit. Please try again.");
      setSuccess(response.ok);
      if (!response.ok && widgetId.current) {
        window.turnstile?.reset(widgetId.current);
        setToken("");
      }
    } catch {
      setMessage(
        "We could not confirm receipt. Please retry with the same details or call Chef directly.",
      );
      if (widgetId.current) {
        window.turnstile?.reset(widgetId.current);
        setToken("");
      }
    } finally {
      setBusy(false);
    }
  }
  if (success)
    return (
      <section className="crm-panel" role="status">
        <h2>Thank you for thinking of The Chef.</h2>
        <p>{message}</p>
        <Link href="/">Return to the website</Link>
      </section>
    );
  return (
    <form className="inquiry-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>Your details</legend>
        <div className="crm-columns">
          <label>
            First name
            <input
              name="first_name"
              autoComplete="given-name"
              required
              maxLength={200}
            />
          </label>
          <label>
            Last name
            <input
              name="last_name"
              autoComplete="family-name"
              required
              maxLength={200}
            />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <label>
            Phone
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              maxLength={30}
            />
          </label>
        </div>
        <label>
          How should Chef contact you?
          <select name="preferred_contact_method">
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
        </label>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Your occasion</legend>
        <div className="crm-columns">
          <label>
            Event type
            <input
              name="event_type"
              placeholder="Wedding, birthday, corporate dinner…"
              maxLength={200}
              required
            />
          </label>
          <label>
            Requested date
            <input name="requested_date" type="date" required />
          </label>
          <label>
            Start time (if known)
            <input name="requested_start_time" type="time" />
          </label>
          <label>
            Estimated guests
            <input
              name="guest_count"
              type="number"
              min="1"
              max="10000"
              required
            />
          </label>
          <label>
            Venue name (if known)
            <input name="venue_name" maxLength={200} />
          </label>
          <label>
            Venue address, city, state and ZIP
            <input name="venue_address" maxLength={200} />
          </label>
        </div>
        <label>
          Does your venue require a certificate of insurance?
          <select name="coi_required">
            <option value="unknown">Unsure</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Food &amp; service</legend>
        <div className="crm-columns">
          <label>
            Package of interest
            <select name="package_interest" defaultValue={selectedPackage}>
              {packageOptions.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Service style
            <select name="service_style">
              {[
                "unsure",
                "drop_off",
                "buffet",
                "plated",
                "private_chef",
                "full_service",
              ].map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Approximate budget
            <input
              name="budget"
              maxLength={200}
              placeholder="A range is welcome"
            />
          </label>
          <label>
            How did you hear about us?
            <input name="referral_source" maxLength={200} />
          </label>
        </div>
        <label>
          Menu ideas
          <textarea
            name="menu_notes"
            maxLength={4000}
            placeholder="Entrées, sides, appetizers, desserts or a custom menu"
          />
        </label>
        <label>
          Dietary needs / allergies
          <textarea name="dietary_notes" maxLength={4000} />
        </label>
        <label>
          Tell us your vision
          <textarea
            name="inquiry_notes"
            maxLength={4000}
            placeholder="Staffing, rentals, setup needs, venue requirements or anything else Chef should know"
          />
        </label>
      </fieldset>
      <div className="inquiry-honey" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="inquiry-check">
        <input type="checkbox" name="consent" required />
        <span>
          I agree to be contacted about this catering inquiry. This does not
          subscribe me to marketing messages.
        </span>
      </label>
      <p>
        Your details are used by The Chef Catering to respond to your request
        and plan your event. Submitting does not reserve a date or confirm a
        price.
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
      <button disabled={busy || Boolean(key && !token)} type="submit">
        {busy ? "Sending inquiry…" : "Send catering inquiry"}
      </button>
    </form>
  );
}
