'use client';

/**
 * SabCRM PWA service-worker registrar.
 *
 * Mounted once inside the SabCRM layout. On mount (client only, production-ish)
 * it registers `/sabcrm-sw.js` (see `public/sabcrm-sw.js`) so the app shell is
 * cached for offline read. Renders nothing.
 *
 * Guards:
 *   - no-ops unless `'serviceWorker' in navigator` (SSR-safe — the effect only
 *     runs in the browser),
 *   - swallows registration errors (a failed SW must never break the app),
 *   - listens for an updated worker and tells it to `SKIP_WAITING` so a new
 *     deploy's worker activates without forcing a hard reload.
 *
 * It registers at the root scope (`/`) but the worker itself only *handles*
 * `/sabcrm` navigations + shared static assets, so other modules are untouched.
 */

import * as React from 'react';

export function PwaRegister(): null {
  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    // The worker is harmless in dev (it only caches GETs), so we register
    // unconditionally rather than gating on NODE_ENV.
    let cancelled = false;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sabcrm-sw.js', {
          scope: '/sabcrm',
          updateViaCache: 'none',
        });
        if (cancelled) return;

        // When a new worker is found + installed (and one already controls the
        // page), ask it to skip waiting so the latest shell takes over.
        const promoteWaiting = (worker: ServiceWorker | null) => {
          if (worker && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        };
        promoteWaiting(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') promoteWaiting(installing);
          });
        });
      } catch {
        // Registration failure is non-fatal; the app works without the SW.
      }
    };

    // Defer until the page is idle/loaded so SW install never competes with
    // first paint.
    if (document.readyState === 'complete') {
      void register();
    } else {
      window.addEventListener('load', () => void register(), { once: true });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

export default PwaRegister;
