import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

const BONE = "#F4F0E6";
const INK = "#141414";

const icons: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

/** Customer app: opens on the booking home page. */
export function customerManifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${siteConfig.name} · Reserva tu hora`,
    short_name: siteConfig.shortName,
    description: `${siteConfig.tagline}. Reserva tu hora en línea.`,
    lang: siteConfig.locale,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BONE,
    theme_color: INK,
    icons,
    shortcuts: [{ name: "Reservar hora", url: "/reservar" }],
  };
}

/**
 * Barber's app: a separate installable app (different id) that opens straight
 * on the agenda. Linked only from the admin pages.
 */
export function adminManifest(): MetadataRoute.Manifest {
  return {
    ...customerManifest(),
    id: "/admin",
    name: `${siteConfig.name} · Panel`,
    short_name: "Panel",
    description: "Agenda y administración de la barbería.",
    start_url: "/admin",
    shortcuts: [
      { name: "Agenda de hoy", url: "/admin" },
      { name: "Nueva cita", url: "/admin/citas/nueva" },
    ],
  };
}
