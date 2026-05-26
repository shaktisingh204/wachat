/*!
 * PageSense client snippet (SabNode CRO module).
 *
 * Drop-in usage on a customer site:
 *
 *   <script async
 *     src="https://app.sabnode.example/pagesense-snippet.js"
 *     data-snippet-key="<the site's snippetKey>"
 *     data-endpoint="https://app.sabnode.example/api/pagesense/ingest"
 *   ></script>
 *
 * Protocol (POST to `data-endpoint`, JSON body):
 *   {
 *     snippetKey: string,
 *     events: [
 *       { url, eventType: 'click'|'move'|'scroll',
 *         x, y, viewportW, viewportH, sessionId, variant?, ts }
 *     ]
 *   }
 *
 * Session recording: this snippet is a STUB. Real rrweb integration is
 * a TODO — once rrweb is included, push its event stream into the same
 * batch buffer with `eventType: 'rrweb'` and the server will land it
 * in SabFiles via the recordings finalizer worker.
 */
(function () {
    'use strict';

    var script = document.currentScript;
    if (!script) return;

    var snippetKey = script.getAttribute('data-snippet-key');
    var endpoint = script.getAttribute('data-endpoint') || '/api/pagesense/ingest';
    var variant = script.getAttribute('data-variant') || undefined;
    if (!snippetKey) {
        // No key, nothing to do.
        return;
    }

    // Throttled mouse-move sampling (1 sample / 250ms) keeps payload sane.
    var MOVE_INTERVAL_MS = 250;
    // Flush every N events OR every M ms — whichever comes first.
    var FLUSH_EVERY = 25;
    var FLUSH_INTERVAL_MS = 5000;

    // Per-tab session id; survives in-page navigation, lost on tab close.
    var sessionKey = '_pagesense_sid';
    var sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
        sessionId =
            'ps_' +
            Date.now().toString(36) +
            '_' +
            Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem(sessionKey, sessionId);
    }

    var buffer = [];
    var lastMoveAt = 0;

    function viewport() {
        return {
            w: Math.max(0, window.innerWidth || 0),
            h: Math.max(0, window.innerHeight || 0),
        };
    }

    function pushEvent(eventType, x, y) {
        var vp = viewport();
        buffer.push({
            url: location.pathname + location.search,
            eventType: eventType,
            x: x,
            y: y,
            viewportW: vp.w,
            viewportH: vp.h,
            sessionId: sessionId,
            variant: variant,
            ts: Date.now(),
        });
        if (buffer.length >= FLUSH_EVERY) flush();
    }

    function flush() {
        if (buffer.length === 0) return;
        var payload = { snippetKey: snippetKey, events: buffer.slice() };
        buffer.length = 0;
        var body = JSON.stringify(payload);
        try {
            if (navigator.sendBeacon) {
                var blob = new Blob([body], { type: 'application/json' });
                navigator.sendBeacon(endpoint, blob);
                return;
            }
        } catch (_) {
            /* fall through to fetch */
        }
        fetch(endpoint, {
            method: 'POST',
            body: body,
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
        }).catch(function () {
            /* swallow — analytics must never break the page */
        });
    }

    document.addEventListener(
        'click',
        function (ev) {
            pushEvent('click', ev.pageX, ev.pageY);
        },
        true,
    );

    document.addEventListener(
        'mousemove',
        function (ev) {
            var now = Date.now();
            if (now - lastMoveAt < MOVE_INTERVAL_MS) return;
            lastMoveAt = now;
            pushEvent('move', ev.pageX, ev.pageY);
        },
        true,
    );

    window.addEventListener(
        'scroll',
        function () {
            var y = window.pageYOffset || document.documentElement.scrollTop || 0;
            pushEvent('scroll', 0, y);
        },
        { passive: true, capture: true },
    );

    setInterval(flush, FLUSH_INTERVAL_MS);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
})();
