import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATERING_PHONE, CATERING_PHONE_DISPLAY, CHEF_NAME, tel } from "@/data/contact";
import { THANKSGIVING, feastIncludes, longDate, usd } from "@/data/thanksgiving";
import { SITE_INDEXABLE, visibleUnlessDraftInProduction } from "@/lib/site";
import CurrentYear from "@/components/CurrentYear";
import "./thanksgiving.css";

/**
 * Thanksgiving 2026 landing page — the destination for the Thanksgiving
 * carousel ads. Content comes only from data/thanksgiving.ts (Chef's own
 * offer). While `THANKSGIVING.approved` is false it renders on previews/local
 * with a draft notice and 404s on production.
 */
const live = THANKSGIVING.approved;
const from = Math.min(...THANKSGIVING.feasts.map((f) => f.price));
const minGuests = Math.min(...THANKSGIVING.feasts.map((f) => f.minGuests));
const maxGuests = Math.max(...THANKSGIVING.feasts.map((f) => f.maxGuests));

export const metadata: Metadata = {
  title: "Thanksgiving Feasts — Order by November 20",
  description: `Thanksgiving dinner, handled. Chef-made turkey, homemade sides and pies for ${minGuests}–${maxGuests} guests, from ${usd(from)}. Order by ${longDate(THANKSGIVING.orderByISO)}.`,
  alternates: { canonical: "/thanksgiving" },
  robots: live && SITE_INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
};

const order = (id: string) => `/catering/inquiry?occasion=thanksgiving&feast=${id}`;

export default function ThanksgivingPage() {
  if (!visibleUnlessDraftInProduction(live)) notFound();
  const orderBy = longDate(THANKSGIVING.orderByISO);
  const day = longDate(THANKSGIVING.dayISO);

  return (
    <main className="tg-root">
      {!live && (
        <p className="tg-draft" role="note">
          Preview draft — feast prices, the order cutoff and terms are awaiting {CHEF_NAME}&apos;s confirmation.
          This page is not public yet.
        </p>
      )}

      <header className="tg-bar">
        <Link href="/" className="tg-brand">
          <img src="/assets/brand/the-chef-catering-logo.png" alt="" width={36} height={36} />
          <span>The Chef Catering</span>
        </Link>
        <a className="tg-bar-call" href={tel(CATERING_PHONE)}>
          Call {CATERING_PHONE_DISPLAY}
        </a>
      </header>

      <section className="tg-hero">
        <div className="tg-hero-text">
          <p className="tg-kicker">Now booking Thanksgiving · {day}</p>
          <h1 className="tg-title">
            This Thanksgiving, <em>you just sit down.</em>
          </h1>
          <p className="tg-lede">
            Turkey, homemade sides and pie — cooked by {CHEF_NAME}. Feasts for {minGuests} to {maxGuests} guests from{" "}
            {usd(from)}.
          </p>
          <ul className="tg-facts" aria-label="Key details">
            <li>Order by {orderBy}</li>
            <li>Limited holiday dates</li>
          </ul>
          <div className="tg-ctas">
            <a className="tg-btn tg-btn-gold" href="#feasts">Choose Your Feast</a>
            <a className="tg-btn tg-btn-ghost" href={tel(CATERING_PHONE)}>Call {CATERING_PHONE_DISPLAY}</a>
          </div>
        </div>
        <figure className="tg-hero-media">
          <img
            src="/assets/thanksgiving/chef-at-the-island.webp"
            alt="Chef Frankie plating a spread at a client's kitchen island"
            width={900}
            height={1160}
            fetchPriority="high"
          />
          <figcaption>Chef Frankie at a client&apos;s home event</figcaption>
        </figure>
      </section>

      <section className="tg-section" id="feasts" aria-labelledby="feasts-title">
        <p className="tg-kicker">Thanksgiving feast packages</p>
        <h2 className="tg-h2" id="feasts-title">Pick the feast that fits your table</h2>
        <div className="tg-feasts">
          {THANKSGIVING.feasts.map((f) => (
            <article className="tg-feast" key={f.id}>
              <p className="tg-feast-serves">Serves {f.minGuests}–{f.maxGuests}</p>
              <h3 className="tg-feast-name">{f.name}</h3>
              <p className="tg-feast-price">{usd(f.price)}</p>
              <ul className="tg-feast-list">
                {feastIncludes(f).map((line) => <li key={line}>{line}</li>)}
              </ul>
              <a className="tg-btn tg-btn-gold tg-feast-cta" href={order(f.id)} aria-label={`Order ${f.name}`}>
                Order This Feast
              </a>
            </article>
          ))}
        </div>
        {THANKSGIVING.freePieTerms && <p className="tg-offer">{THANKSGIVING.freePieTerms}</p>}
      </section>

      <section className="tg-section tg-menu" aria-labelledby="menu-title">
        <div className="tg-menu-text">
          <p className="tg-kicker">Made from scratch</p>
          <h2 className="tg-h2" id="menu-title">
            Sides &amp; <em>sweets</em>
          </h2>
          <p className="tg-note">Choose your sides and pies when you order — Chef confirms every selection.</p>
          <ul className="tg-sides">
            {THANKSGIVING.sides.map((s) => <li key={s}>{s}</li>)}
          </ul>
          <p className="tg-pies">
            <span>Homemade pies</span> {THANKSGIVING.pies.join(" · ")}
          </p>
        </div>
        <figure className="tg-menu-media">
          <img
            src="/assets/thanksgiving/guests-gathered.webp"
            alt="Guests gathered around a kitchen island of Chef Frankie's food at a private event"
            width={800}
            height={968}
            loading="lazy"
          />
        </figure>
      </section>

      <section className="tg-section" aria-labelledby="how-title">
        <p className="tg-kicker">How ordering works</p>
        <h2 className="tg-h2" id="how-title">Three steps to a handled holiday</h2>
        <ol className="tg-steps">
          <li>
            <strong>Choose your feast</strong>
            <span>Pick your feast, sides and pies, and send your order request — it takes about two minutes.</span>
          </li>
          <li>
            <strong>Chef confirms the details</strong>
            <span>
              {CHEF_NAME} confirms availability, your selections, timing and how you&apos;ll receive your feast
              {THANKSGIVING.fulfilmentNote ? ` (${THANKSGIVING.fulfilmentNote})` : ""}.
            </span>
          </li>
          <li>
            <strong>Your feast is reserved</strong>
            <span>Once Chef confirms your order with you, your Thanksgiving is handled.</span>
          </li>
        </ol>
        <p className="tg-fine">
          Order by {orderBy}. Holiday dates are limited and every order is confirmed by Chef before it is final.
          Changes and add-ons are agreed with Chef when your order is confirmed.
        </p>
      </section>

      <section className="tg-final">
        <h2 className="tg-h2">Let Chef handle Thanksgiving.</h2>
        <p className="tg-lede">Order by {orderBy}.</p>
        <div className="tg-ctas tg-ctas-center">
          <a className="tg-btn tg-btn-gold" href={order("family")}>Start My Order</a>
          <a className="tg-btn tg-btn-ghost" href={tel(CATERING_PHONE)}>Call {CATERING_PHONE_DISPLAY}</a>
        </div>
      </section>

      <footer className="tg-footer">
        <Link href="/">The Chef Catering</Link>
        <span>© <CurrentYear /> The Chef Catering · All Rights Reserved</span>
      </footer>

      <div className="tg-sticky" aria-hidden="false">
        <a className="tg-btn tg-btn-gold" href={order("family")}>Order Your Feast</a>
        <a className="tg-btn tg-btn-ghost" href={tel(CATERING_PHONE)} aria-label={`Call ${CATERING_PHONE_DISPLAY}`}>
          Call
        </a>
      </div>
    </main>
  );
}
