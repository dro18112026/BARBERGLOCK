"use client";

import { useState } from "react";
import { maps, siteConfig } from "@/config/site";

/**
 * Google Maps loads only after a tap: until then no request (or cookie) goes to
 * Google, which keeps the privacy page true for everyone who doesn't open it.
 */
export function MapEmbed() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-48 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-smoke/50 bg-bone text-ink hover:border-ink"
      >
        <span className="text-3xl" aria-hidden="true">🗺️</span>
        <span className="font-bold">Ver mapa</span>
        <span className="text-sm text-smoke">Se carga desde Google Maps</span>
      </button>
    );
  }

  return (
    <iframe
      title={`Mapa: ${siteConfig.address.street}, ${siteConfig.address.city}`}
      src={maps.embed}
      className="h-64 w-full rounded-lg border-0"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}
