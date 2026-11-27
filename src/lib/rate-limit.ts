import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Client IP as seen by the host. For pages and Server Actions, src/proxy.ts
 * passes it in x-bg-client-ip (the handler behind the proxy can see an
 * internal address instead). API routes skip the proxy and read the host's
 * headers directly: Netlify sets x-nf-client-connection-ip; other hosts
 * usually x-real-ip or the first x-forwarded-for entry.
 */
async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-bg-client-ip") ??
    h.get("x-nf-client-connection-ip") ??
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Opaque per-IP key: an HMAC, so raw IPs are never stored. */
async function ipKey(scope: string): Promise<string> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const digest = createHmac("sha256", secret).update(await clientIp()).digest("base64url");
  return `${scope}:${digest}`;
}

/**
 * Opaque id of the customer's connection for the per-connection booking
 * limits stored with each appointment. Null when the IP is unknown, so a
 * missing header never puts every customer under the same limit.
 */
export async function clientKey(): Promise<string | null> {
  if ((await clientIp()) === "unknown") return null;
  return ipKey("client");
}

/**
 * TEMPORARY diagnostic (remove once the per-connection limit is confirmed in
 * production): which IP headers this request has, as short hashes, so logs can
 * show whether different customers get different values without storing IPs.
 */
export async function ipHeaderDiagnostics(): Promise<Record<string, string>> {
  const h = await headers();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const out: Record<string, string> = {};
  for (const name of ["x-bg-client-ip", "x-nf-client-connection-ip", "cf-connecting-ip", "x-real-ip", "x-forwarded-for"]) {
    const v = h.get(name);
    out[name] = v ? createHmac("sha256", secret).update(v).digest("hex").slice(0, 6) : "-";
  }
  return out;
}

type Limit = { limit: number; windowSeconds: number };

/**
 * Counts one hit against every window; returns false if any is exceeded.
 * Fails open if the limiter itself errors, so a DB hiccup never blocks
 * legitimate customers (the phone limit and honeypot still apply).
 */
export async function allowRequest(scope: string, limits: Limit[]): Promise<boolean> {
  const supabase = createAdminClient();
  const key = await ipKey(scope);
  for (const { limit, windowSeconds } of limits) {
    const { data, error } = await supabase.rpc("hit_rate_limit", {
      p_key: `${key}:${windowSeconds}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("rate limit check failed:", error);
      return true;
    }
    if (data === false) return false;
  }
  return true;
}
