import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Runs before every page request:
 *
 * 1. Content Security Policy with a fresh nonce per request. Next.js reads the
 *    nonce from the request's CSP header and adds it to its own scripts, so only
 *    scripts we serve can run (protects against injected scripts / XSS).
 * 2. /admin only: refreshes the Supabase session cookie and does an optimistic
 *    redirect to the login page. Real authorization happens in requireAdmin()
 *    (layout + every Server Action) and in Postgres RLS.
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, request.nextUrl.protocol === "https:");

  // The customer's IP as the proxy sees it, for the per-connection booking
  // limits. Set here (overwriting anything the client sent) because the page
  // handler behind the proxy may not see the original headers.
  const clientIp = firstIp(
    request.headers.get("x-nf-client-connection-ip") ??
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for"),
  );

  // Forward the nonce to rendering via request headers (rebuilt after cookie refreshes).
  const next = () => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete("x-bg-client-ip");
    if (clientIp) requestHeaders.set("x-bg-client-ip", clientIp);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers: requestHeaders } });
  };

  let response = next();

  if (request.nextUrl.pathname.startsWith("/admin")) {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = next();
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
            Object.entries(headers ?? {}).forEach(([key, value]) =>
              response.headers.set(key, value),
            );
          },
        },
      },
    );

    // Validates the JWT and refreshes it if needed (writes cookies via setAll).
    const { data } = await supabase.auth.getClaims();
    const signedIn = Boolean(data?.claims?.sub);

    const path = request.nextUrl.pathname;
    // Pages that must work without a session: login and password recovery.
    const isPublic = path === "/admin/login" || path.startsWith("/admin/recuperar");

    if (!signedIn && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function firstIp(value: string | null): string | null {
  const ip = value?.split(",")[0]?.trim();
  return ip || null;
}

function contentSecurityPolicy(nonce: string, https: boolean): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // React needs eval only in development (debugging stacks).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style *attributes* (e.g. next/image) can't carry a nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "manifest-src 'self'",
    // Only the click-to-load Google Maps embed on the home page.
    "frame-src https://www.google.com https://maps.google.com",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export const config = {
  matcher: [
    {
      // Pages only: skip API routes, Next assets, the service worker, manifests
      // and static files (they don't run scripts and don't need a nonce).
      source:
        "/((?!api|_next/static|_next/image|sw\\.js|.*\\.webmanifest|icon\\.png|apple-icon\\.png|icons/|brand/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
