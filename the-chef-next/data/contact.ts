/**
 * Single source of truth for all contact info.
 *
 * - Catering email + phone are the real, verified values (they also appear on
 *   Chef Frankie's printed menus).
 * - Entertainer booking: "cheftherapperr@email.com" is carried over from the
 *   previous site (the agency HTML drafts v9–v26). It is UNVERIFIED — nobody
 *   has confirmed Chef controls this mailbox. (@email.com is a real free-mail
 *   domain run by mail.com, so the address can exist; an earlier note here
 *   wrongly called it a placeholder.) The handle still says "rapper" while the
 *   public brand is now "Entertainer". Replace it only with an address Chef
 *   supplies — never invent one. Set to `null` to hide the booking section.
 */

export const CATERING_EMAIL = "Thechefcs@gmail.com";
export const CATERING_PHONE = "3145003601";
export const CATERING_PHONE_DISPLAY = "314.500.3601";
export const CHEF_NAME = "Chef Frankie";

export type BookingRoute = { email?: string; phone?: string; phoneDisplay?: string };

/** Entertainer booking contact (see the note above — pending Chef's confirmation). */
export const ENTERTAINER_BOOKING: BookingRoute | null = { email: "cheftherapperr@email.com" };

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
