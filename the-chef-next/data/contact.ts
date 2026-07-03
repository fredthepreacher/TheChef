/**
 * Single source of truth for all contact info.
 *
 * NOTE (flagged during conversion):
 * - Catering email + phone are the real, verified values used across the old site.
 * - The old gallery.html CTA used "thechefcateringservices@email.com" (placeholder) —
 *   it now points to the real catering email below.
 * - The music email "cheftherapperr@email.com" looks like a placeholder
 *   (@email.com is not a real provider). Update MUSIC_EMAIL when the
 *   real address is available — it is only referenced here.
 */

export const CATERING_EMAIL = "Thechefcs@gmail.com";
export const CATERING_PHONE = "3145003601";
export const CATERING_PHONE_DISPLAY = "314.500.3601";
export const CHEF_NAME = "Chef Frankie";

// TODO: replace with the real music/booking email when available.
export const MUSIC_EMAIL = "cheftherapperr@email.com";

export const BRAND = {
  catering: "The Chef Catering",
  cateringFull: "The Chef Catering Services",
  music: "The Chef Music",
  tagline: "Five Star Meals · Served With Love",
  taglineAlt: "Five Star Meals on Wheels",
};

export const mailto = (email: string, subject?: string) =>
  subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;

export const tel = (phone: string) => `tel:${phone}`;
