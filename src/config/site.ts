/**
 * Per-barbershop settings. To replicate the app for another shop, change this
 * file (and the env vars / logo) — nothing else in the code should mention
 * BARBERGLOCK or Chile Chico directly.
 *
 * Booking rules here are the defaults used by the UI; the database functions
 * (Phase 2) enforce the same rules server-side.
 */
export const siteConfig = {
  name: "BARBERGLOCK",
  shortName: "Barberglock",
  tagline: "Barbería tradicional en Chile Chico",
  location: "Chile Chico, Región de Aysén",
  locale: "es-CL",
  currency: "CLP",
  /** IANA zone. Aysén uses its own zone (UTC-3 all year) since 2025. */
  timeZone: "America/Coyhaique",
  logo: {
    /** Generated from logo.jpg by `npm run icons` (cleaned background). */
    src: "/brand/logo-web.png",
    width: 640,
    height: 640,
    alt: "Logo de BARBERGLOCK: barbero con barba entre dos postes de barbería",
  },
  /** Phone in international format without "+", e.g. 56912345678. */
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? "",
  booking: {
    /**
     * Start times are offered on this grid. 30 min fits 60-min services and the
     * 30-min lunch break without leaving unusable gaps.
     */
    slotStepMin: 30,
    /** Earliest bookable time, relative to now. */
    minLeadTimeMin: 60,
    /** How far ahead customers can book. */
    maxDaysAhead: 14,
    /** Max future appointments per phone number (anti-abuse). */
    maxActivePerPhone: 2,
  },
} as const;

export type SiteConfig = typeof siteConfig;
