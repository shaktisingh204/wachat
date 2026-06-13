/* eslint-disable */
/**
 * SabCRM service worker (hand-rolled — no Workbox / Serwist).
 *
 * Strategy:
 *   - PRECACHE a minimal app shell (the offline fallback page + SabCRM start
 *     URL) on install.
 *   - NAVIGATIONS (HTML page loads) under /sabcrm → network-first: try the
 *     network, fall back to the cached page, then to the offline shell. This
 *     keeps the app fresh online and usable offline.
 *   - STATIC ASSETS (Next.js build output under /_next/static, plus same-origin
 *     images/fonts/css/js) → cache-first (immutable, content-hashed by Next),
 *     refreshed in the background.
 *   - Everything else (APIs, server actions, other modules) → passthrough to
 *     the network; we never cache POSTs or non-/sabcrm routes.
 *
 * Cache name is VERSIONED — bump `VERSION` to invalidate after a deploy. Old
 * caches are deleted on activate. skipWaiting + clients.claim so a new worker
 * takes over immediately.
 *
 * This worker is scoped to the whole origin (served from /sabcrm-sw.js) but
 * deliberately only *handles* /sabcrm navigations + static assets, so it can
 * never break other SabNode modules.
 */

const VERSION = 'v1';
const SHELL_CACHE = `sabcrm-shell-${VERSION}`;
const STATIC_CACHE = `sabcrm-static-${VERSION}`;
const OFFLINE_URL = '/sabcrm/offline';
const START_URL = '/sabcrm';

// The minimal set precached up-front. The offline fallback is the key one; the
// start URL is best-effort (it may require auth and 30x — tolerated).
const PRECACHE_URLS = [START_URL, OFFLINE_URL];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Best-effort: don't fail the whole install if one URL 30x/401s.
      await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, STATIC_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('sabcrm-') && !keep.has(n))
          .map((n) => caches.delete(n)),
      );
      // Enable navigation preload where supported (faster network-first).
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (_) {
          /* not fatal */
        }
      }
      await self.clients.claim();
    })(),
  );
});

// Allow the page to trigger an immediate update.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isStaticAsset(url) {
  if (url.pathname.startsWith('/_next/static/')) return true;
  return /\.(?:css|js|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|ico|json)$/i.test(
    url.pathname,
  );
}

/** Network-first for SabCRM page navigations, with an offline fallback. */
async function handleNavigation(event) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    // Prefer a navigation-preload response if available.
    const preload = await event.preloadResponse;
    const network = preload || (await fetch(event.request));
    // Cache successful HTML responses so a revisit works offline.
    if (network && network.ok && network.type !== 'opaqueredirect') {
      cache.put(event.request, network.clone()).catch(() => undefined);
    }
    return network;
  } catch (_) {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
        '<body style="font-family:system-ui;padding:2rem">You are offline. ' +
        'Reconnect to load SabCRM.</body>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

/** Cache-first for content-hashed static assets, refreshed in the background. */
async function handleStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Stale-while-revalidate: refresh in the background for non-hashed assets.
    fetch(request)
      .then((resp) => {
        if (resp && resp.ok) cache.put(request, resp.clone()).catch(() => undefined);
      })
      .catch(() => undefined);
    return cached;
  }
  try {
    const network = await fetch(request);
    if (network && network.ok) cache.put(request, network.clone()).catch(() => undefined);
    return network;
  } catch (_) {
    return cached || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET is cacheable; let everything else hit the network untouched.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (_) {
    return;
  }

  // Never touch cross-origin requests.
  if (url.origin !== self.location.origin) return;

  // HTML navigations: only handle the SabCRM scope; leave other modules alone.
  if (request.mode === 'navigate') {
    if (url.pathname === START_URL || url.pathname.startsWith('/sabcrm')) {
      event.respondWith(handleNavigation(event));
    }
    return;
  }

  // Static assets anywhere on the origin (shared Next build output).
  if (isStaticAsset(url)) {
    event.respondWith(handleStatic(request));
  }
});
