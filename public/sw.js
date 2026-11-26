/*
 * BARBERGLOCK service worker — small and conservative on purpose.
 *
 * - Static assets (JS/CSS/fonts/icons): cache-first (their URLs are versioned).
 * - Public pages "/" and "/reservar": network-first, last copy kept for offline.
 * - Everything else (admin, appointment links, server actions, RSC requests):
 *   network only. Customer data is never stored in the cache.
 * - Offline navigation with nothing cached → /offline (shows the phone number).
 * - Push notifications for the panel (bottom of the file).
 *
 * Bump VERSION to drop old caches after changing this file.
 */
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/brand/logo-web.png", "/icons/icon-192.png"];
const CACHEABLE_PAGES = ["/", "/reservar"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  url.pathname.startsWith("/brand/") ||
  /\.(?:woff2?|png|jpg|svg|ico)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // React Server Component payloads (client-side navigations): always live.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    const cacheable = CACHEABLE_PAGES.includes(url.pathname) && !url.search;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (cacheable && response.ok) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = cacheable ? await caches.match(request) : undefined;
          return cached || (await caches.match(OFFLINE_URL)) || Response.error();
        }),
    );
  }
});

// --- Push notifications (panel) ------------------------------------------------
// Payload from src/lib/push.ts: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "BARBERGLOCK";
  event.waitUntil(
    Promise.all([
      // An open panel reloads its data (e.g. the agenda shows the cancellation).
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) => clients.forEach((c) => c.postMessage({ type: "refresh" }))),
      self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag,
        renotify: Boolean(data.tag),
        icon: "/icons/icon-192.png",
        data: { url: data.url || "/admin" },
      }),
    ]),
  );
});

// Tap → open (or focus) the panel on the right day.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/admin", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const panel = clients.find((c) => new URL(c.url).pathname.startsWith("/admin"));
      if (panel) {
        return panel.focus().then((c) => (c || panel).navigate(target.href));
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
