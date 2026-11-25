import "server-only";
import { headers } from "next/headers";

/**
 * Absolute URL for links that leave the site (WhatsApp messages, emails).
 * Uses NEXT_PUBLIC_SITE_URL when set, otherwise the request's host.
 */
export async function absoluteUrl(path: string): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(path, configured).toString();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}
