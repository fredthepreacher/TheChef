/**
 * Single source of truth for all contact info.
 *
 * - Catering email + phone are the real, verified values (they also appear on
 *   Chef Frankie's printed menus).
 * - Entertainer booking: the old value "cheftherapperr@email.com" was a
 *   placeholder (@email.com is not a real mailbox) and has been removed.
 *   Set ENTERTAINER_BOOKING to the owner-approved route to show the
 *   "Booking & Features" section. Until then it stays hidden — never invent one.
 */

export const CATERING_EMAIL = "Thechefcs@gmail.com";
export const CATERING_PHONE = "3145003601";
export const CATERING_PHONE_DISPLAY = "314.500.3601";
export const CHEF_NAME = "Chef Frankie";

export type BookingRoute = { email?: string; phone?: string; phoneDisplay?: string };

/** Owner-approved Entertainer booking contact. `null` = not supplied yet. */
export const ENTERTAINER_BOOKING: BookingRoute | null = null;

export const BRAND = {
  catering: "The Chef Catering",
  cateringFull: "The Chef Catering Services",
  music: "The Chef Music",
  entertainer: "The Chef — Entertainer",
  tagline: "Five Star Meals · Served With Love",
  taglineAlt: "Five Star Meals on Wheels",
};

export const mailto = (email: string, subject?: string) =>
  subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;

export const tel = (phone: string) => `tel:${phone}`;
