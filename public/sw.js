// Service worker: makes the board installable and lets it open without a connection.
//
// - Pages and /api/calendar: network first, so screens always show live data when they can.
//   Offline, they get the last copy instead; the calendar copy carries an `X-Board-Offline`
//   header so the board can say it's showing old data.
// - Next's build files (/_next/static, hashed and immutable) and icons: cache first.
// - Everything else, including ticking tasks off (PATCH), goes straight to the network.

const VERSION = "v1";
const PAGES = `bnb-pages-${VERSION}`;
const ASSETS = `bnb-assets-${VERSION}`;
const DATA = `bnb-data-${VERSION}`;
// Old builds' files pile up in ASSETS; keep it to roughly one build's worth
const MAX_ASSETS = 120;

const OFFLINE_HEADER = "X-Board-Offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Cache the board and the build files it loads, so it opens offline even if this
      // first visit loaded them before the worker was running
      const pages = await caches.open(PAGES);
      const response = await fetch("/", { cache: "no-store" });
      if (!response.ok) return;
      await pages.put("/", response.clone());
      const html = await response.text();
      const files = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g));
      const assets = await caches.open(ASSETS);
      // One missing file shouldn't stop the worker installing; it's fetched again when used.
      // The board's own first fetch also ran before the worker, so keep a copy of its data too.
      const data = await caches.open(DATA);
      await Promise.allSettled([
        ...[...files, "/manifest.webmanifest", "/icons/icon-192.png"].map((f) => assets.add(f)),
        data.add("/api/calendar"),
      ]);
    })()
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const current = [PAGES, ASSETS, DATA];
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("bnb-") && !current.includes(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES, { fallback: "/" }));
  } else if (url.pathname === "/api/calendar") {
    event.respondWith(networkFirst(request, DATA, { markOffline: true }));
  } else if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request, cacheName, { fallback, markOffline = false }) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    // Only keep good answers: a failed sync shouldn't replace the last good board
    if (response.ok) await cache.put(fallback ?? request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(fallback ?? request, { ignoreSearch: true });
    if (!cached) throw error;
    if (!markOffline) return cached;
    const headers = new Headers(cached.headers);
    headers.set(OFFLINE_HEADER, "1");
    return new Response(cached.body, { status: cached.status, headers });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trim(cache);
  }
  return response;
}

async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((k) => cache.delete(k)),
  );
}
