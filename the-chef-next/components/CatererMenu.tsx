"use client";

import { useEffect, useRef, useState } from "react";
import { menuCategories, customMenuTags, menuDocs, packages } from "@/data/menu";
import { CATERING_EMAIL, CATERING_PHONE, CATERING_PHONE_DISPLAY, CHEF_NAME, mailto, tel } from "@/data/contact";
import MenuModal from "./MenuModal";

/** Inline icons for each menu category — ported from the original SVGs. */
const icons: Record<string, React.ReactNode> = {
  appetizers: (
    <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.2" /><path d="M12 24c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><circle cx="20" cy="14" r="2" fill="currentColor" /></svg>
  ),
  mains: (
    <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.2" /><path d="M12 28h16M14 28V20a6 6 0 0 1 12 0v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  ),
  seafood: (
    <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.2" /><path d="M10 20c3-6 17-6 20 0-3 6-17 6-20 0Z" stroke="currentColor" strokeWidth="1.2" /><circle cx="14" cy="20" r="1.5" fill="currentColor" /></svg>
  ),
  sides: (
    <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.2" /><path d="M13 26h14M13 20h14M13 14h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  ),
  desserts: (
    <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.2" /><path d="M14 26c0-3.3 2.7-6 6-6s6 2.7 6 6M20 20v-6M16 14c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  ),
  custom: (
    <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.2" /><path d="M20 12v16M12 20h16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  ),
};

/** The full luxury catering menu section: accordion cards, menu documents, packages, CTA. */
export default function CatererMenu() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [modalDoc, setModalDoc] = useState<string | null>(null);
  const drawerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* Animate drawer max-height like the original accordion. */
  useEffect(() => {
    for (const cat of menuCategories) {
      const el = drawerRefs.current[cat.id];
      if (!el) continue;
      if (cat.id === openId) {
        el.style.maxHeight = el.scrollHeight + 80 + "px";
        const t = setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
        return () => clearTimeout(t);
      }
      el.style.maxHeight = "0";
    }
  }, [openId]);

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <section className="section lux-menu-section" id="caterer-menu">
      {/* SECTION HERO */}
      <div className="lux-menu-hero">
        <p className="section-tag">Curated Culinary Experiences</p>
        <h2 className="lux-menu-heading">The Signature Menu</h2>
        <div className="lux-menu-rule"><span></span><span className="lux-menu-rule-icon">✦</span><span></span></div>
        <p className="lux-menu-subhead">
          Designed for intimate gatherings, corporate events, weddings, and unforgettable celebrations.<br />
          Every dish prepared fresh — customized to your occasion.
        </p>
      </div>

      {/* CATEGORY CARDS */}
      <div className="lux-cat-grid">
        {menuCategories.map((cat) => {
          const isOpen = openId === cat.id;
          return (
            <div className={`lux-cat-card${isOpen ? " expanded" : ""}`} data-menu={cat.id} key={cat.id}>
              <div className="lux-cat-inner">
                <div className="lux-cat-icon">{icons[cat.id]}</div>
                <h3 className="lux-cat-title">{cat.title}</h3>
                <p className="lux-cat-desc">{cat.description}</p>
                <button
                  className={`lux-cat-btn${isOpen ? " active" : ""}`}
                  onClick={() => toggle(cat.id)}
                  aria-expanded={isOpen}
                  aria-controls={`drawer-${cat.id}`}
                >
                  <span>{isOpen ? "Close Menu" : "View Menu"}</span>
                  <svg className="lux-btn-arrow" viewBox="0 0 16 16"><path d="M8 2v12M2 8l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>
              </div>

              {/* Expandable drawer */}
              <div
                className={`lux-menu-drawer${isOpen ? " open" : ""}`}
                id={`drawer-${cat.id}`}
                ref={(el) => { drawerRefs.current[cat.id] = el; }}
              >
                {cat.columns ? (
                  <div className="lux-drawer-inner">
                    {cat.columns.map((col, ci) => (
                      <div className="lux-item-col" key={ci}>
                        {col.map((item) => (
                          <div className="lux-item" key={item.name}>
                            <span className="lux-item-name">{item.name}</span>
                            <span className="lux-item-note">{item.note}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="lux-drawer-inner" style={{ justifyContent: "center" }}>
                    <div className="lux-custom-content">
                      <p className="lux-custom-text">
                        If you want something not listed on the menu, please discuss special requests with Chef. This
                        goes for all menu selections.
                      </p>
                      <div className="lux-custom-tags">
                        {customMenuTags.map((t) => <span key={t}>{t}</span>)}
                      </div>
                      <a className="lux-custom-cta" href="#caterer-book">Request a Custom Menu →</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MENU DOCUMENTS */}
      <div className="lux-menu-docs">
        <div className="lux-docs-header">
          <p className="section-tag">Download &amp; View</p>
          <h3 className="lux-docs-title">Our Catering Menus</h3>
          <p className="lux-docs-sub">Tap any menu to view full size. Printable PDFs available upon request.</p>
        </div>
        <div className="lux-docs-grid">
          {menuDocs.map((doc) => (
            <div className="lux-doc-card" key={doc.id} onClick={() => setModalDoc(doc.src)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setModalDoc(doc.src); }}>
              <div className="lux-doc-preview">
                <img src={doc.src} alt={doc.alt} />
                <div className="lux-doc-overlay">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 3h6v6M10 14L21 3M21 16v5H3V3h5" /></svg>
                  <span>View Full Menu</span>
                </div>
              </div>
              <div className="lux-doc-info">
                <h4>{doc.title}</h4>
                <p>{doc.subtitle}</p>
              </div>
            </div>
          ))}
          {/* Future menu slot */}
          <div className="lux-doc-card lux-doc-future">
            <div className="lux-doc-preview lux-doc-empty">
              <svg viewBox="0 0 40 40" fill="none"><path d="M20 12v16M12 20h16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
              <span>Coming Soon</span>
            </div>
            <div className="lux-doc-info">
              <h4>Seasonal Menu</h4>
              <p>Holiday · Wedding · Corporate specials added here</p>
            </div>
          </div>
        </div>
      </div>

      {/* PACKAGES */}
      <div className="lux-packages">
        <div className="lux-packages-header">
          <p className="section-tag">Choose Your Experience</p>
          <h3 className="lux-pkg-title">Catering Packages</h3>
          <p className="lux-pkg-sub">
            All packages include setup, service, and breakdown. Custom quotes available for larger events.
          </p>
        </div>
        <div className="lux-pkg-grid">
          {packages.map((pkg) => (
            <div
              key={pkg.badge}
              className={`lux-pkg-card lux-pkg-${pkg.tone}${pkg.featured ? " lux-pkg-featured" : ""}`}
            >
              {pkg.featured && <div className="lux-pkg-popular">Most Popular</div>}
              <div className="lux-pkg-badge">{pkg.badge}</div>
              <div className="lux-pkg-guests">{pkg.guests}</div>
              <div className="lux-pkg-price">{pkg.price.prefix}<strong>{pkg.price.strong}</strong></div>
              <ul className="lux-pkg-list">
                {pkg.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <a className={`lux-pkg-btn${pkg.featured ? " lux-pkg-btn-gold" : ""}`} href="#caterer-book">
                {pkg.cta}
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* MENU CTA */}
      <div className="lux-menu-cta">
        <div className="lux-menu-cta-inner">
          <p className="lux-cta-tag">✦ &nbsp; Let&apos;s Create Your Perfect Menu &nbsp; ✦</p>
          <h3 className="lux-cta-heading">Every Event Deserves<br />a Five-Star Experience</h3>
          <p className="lux-cta-sub">
            Tell us about your event and we&apos;ll craft a custom menu that fits your vision, guest count, and budget.
          </p>
          <div className="lux-cta-btns">
            <a
              className="btn-primary"
              href={mailto(CATERING_EMAIL, "Catering Quote Request")}
              style={{ background: "var(--gold)", color: "#0a0800", boxShadow: "0 8px 30px rgba(201,168,76,.30)" }}
            >
              Request a Quote
            </a>
            <a className="btn-ghost" href={tel(CATERING_PHONE)}>Schedule Consultation</a>
          </div>
          <p className="lux-cta-contact">
            {CHEF_NAME} &nbsp;·&nbsp; {CATERING_PHONE_DISPLAY} &nbsp;·&nbsp; {CATERING_EMAIL}
          </p>
        </div>
      </div>

      {/* MENU IMAGE MODAL */}
      <MenuModal src={modalDoc} onClose={() => setModalDoc(null)} />
    </section>
  );
}
