/**
 * Per-barbershop settings. To replicate the app for another shop, change this
 * file (and the env vars / logo) — nothing else in the code should mention
 * BARBERGLOCK or Chile Chico directly.
 *
 * Booking rules (lead time, window, limits) live in the database table
 * booking_settings and are edited in Panel → Sistema → Reglas.
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
  address: {
    street: "Manuel Rodríguez 253",
    city: "Chile Chico",
    region: "Aysén",
    /** What Google Maps searches for (links and the embedded map). */
    mapsQuery: "Manuel Rodríguez 253, Chile Chico, Aysén, Chile",
  },
  /**
   * Optional photo of the shop front (your own photo, not a Street View
   * capture — Google's images can't be reused). Put the file in public/ and
   * set the path, or leave null to hide it.
   */
  storefrontPhoto: null as { src: string; width: number; height: number } | null,
  social: {
    instagram: "https://www.instagram.com/barberglo0ck",
    instagramHandle: "@barberglo0ck",
  },
} as const;

/** Google Maps links built from the address (no API key needed). */
export const maps = {
  directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(siteConfig.address.mapsQuery)}`,
  embed: `https://www.google.com/maps?q=${encodeURIComponent(siteConfig.address.mapsQuery)}&z=16&output=embed`,
};

export type SiteConfig = typeof siteConfig;
