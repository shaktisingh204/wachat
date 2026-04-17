/**
 * Client-side (browser) JavaScript sandbox for SabFlow.
 *
 * ── Security boundary ─────────────────────────────────────────────────────
 *
 * Isolation is provided by a hidden `<iframe sandbox="allow-scripts">` loaded
 * from a data: URL. `allow-scripts` WITHOUT `allow-same-origin` means:
 *
 *   • The iframe has a unique, opaque origin. It cannot read `document.cookie`,
 *     `localStorage`, IndexedDB, or anything else belonging to the parent.
 *   • Cross-document access (`iframe.contentWindow.foo = bar`) is blocked by
 *     the browser's same-origin policy.
 *   • The ONLY channel between host and guest is `postMessage`. We verify
 *     the message `source` against our iframe's contentWindow before trusting
 *     anything from `window.message` events.
 *
 * We additionally:
 *
 *   • Wrap user code in `Function("variables", "setVariable", "console", …, code)`
 *     inside the iframe. That still allows escape via `(globalThis)`, but the
 *     opaque origin means such escape hatches buy nothing useful.
 *   • Enforce a wall-clock timeout on the host side; if the iframe does not
 *     respond in time, we tear it down (and any in-flight work is GC'd).
 *   • Validate whitelisted fetch domains in the iframe code too.
 *
 * ── What this sandbox does NOT protect against ───────────────────────────
 *
 *   • A malicious script inside the iframe CAN still issue fetch() calls to
 *     CORS-permitting hosts. The `allowedDomains` check is best-effort.
 *   • Running in a browser tab that ignores the `sandbox` attribute (very
 *     old browsers). We target evergreen browsers only.
 */

import type {
  SandboxContext,
  SandboxLogEntry,
  SandboxMessage,
  SandboxOptions,
  SandboxResult,
} from './types';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * The runtime script that runs *inside* the sandboxed iframe.
 *
 * It is embedded as a string here (rather than fetched from a URL) so it
 * ships with the iframe's initial HTML and starts running immediately.
 * This string is trusted code AUTHORED BY US — it is not affected by user
 * input. The user's script is passed in via postMessage.
 */
const IFRAME_RUNTIME = String.raw`
  (function () {
    'use strict';
    // Nuke a few host-provided capabilities to make accidental leaks harder.
    // (The opaque origin already prevents cross-origin reads, but we still
    // close the most obvious fingerprints.)
    try { delete window.parent; } catch (e) { /* readonly */ }

    var hostWindow = window.parent; // opaque-origin parent handle
    if (!hostWindow) hostWindow = window.top;

    function safeStringify(value) {
      try {
        if (typeof value === 'string') return value;
        if (value === undefined) return 'undefined';
        if (value === null) return 'null';
        if (typeof value === 'bigint') return String(value) + 'n';
        return JSON.stringify(value);
      } catch (e) { return '[Unserializable]'; }
    }

    function safeClone(value) {
      if (value === undefined || value === null) return value;
      try { return JSON.parse(JSON.stringify(value)); }
      catch (e) { return String(value); }
    }

    function hostnameOf(input) {
      try { return new URL(String(input)).hostname; }
      catch (e) { return null; }
    }

    function makeGuardedFetch(allowed) {
      var list = (allowed || []).map(function (d) { return String(d).toLowerCase().trim(); })
                                 .filter(Boolean);
      return function (input, init) {
        var url = typeof input === 'string' ? input
                : (input && input.url) ? input.url
                : String(input);
        var host = hostnameOf(url);
        var ok = host && list.some(function (dom) {
          return host === dom || host.endsWith('.' + dom);
        });
        if (!ok) {
          return Promise.reject(new Error(
            '[sandbox] fetch blocked: ' + (host || 'invalid url') +
            ' is not in the allowed domain list'
          ));
        }
        return fetch(input, init);
      };
    }

    window.addEventListener('message', async function (ev) {
      var data = ev.data;
      if (!data || data.type !== 'sabflow-sandbox-init') return;

      var id = data.id;
      var code = String(data.code || '');
      var variables = data.variables || {};
      var allowFetch = data.allowFetch === true;
      var allowed = data.allowedDomains || [];

      var logs = [];
      var mutated = {};

      var guestConsole = {
        log: function () {
          var parts = [];
          for (var i = 0; i < arguments.length; i++) parts.push(safeStringify(arguments[i]));
          logs.push({ level: 'log', message: parts.join(' ') });
        },
        error: function () {
          var parts = [];
          for (var i = 0; i < arguments.length; i++) parts.push(safeStringify(arguments[i]));
          logs.push({ level: 'error', message: parts.join(' ') });
        }
      };

      function setVariable(name, value) {
        if (typeof name !== 'string' || !name) return;
        mutated[name] = value;
      }

      var startedAt = Date.now();
      var result;

      try {
        // Wrap user code in an async IIFE body so 'await' works and so a
        // top-level 'return' exits the IIFE (not the runtime).
        var factory = new Function(
          'variables', 'setVariable', 'console', 'fetch',
          '"use strict"; return (async function () {\n' + code + '\n})();'
        );
        var fetchImpl = allowFetch ? makeGuardedFetch(allowed) : undefined;
        var ret = await factory(variables, setVariable, guestConsole, fetchImpl);
        result = {
          success: true,
          returnValue: safeClone(ret),
          variables: mutated,
          logs: logs,
          executionTimeMs: Date.now() - startedAt
        };
      } catch (err) {
        result = {
          success: false,
          variables: mutated,
          logs: logs,
          error: (err && err.stack) ? err.stack
               : (err && err.message) ? err.message
               : String(err),
          executionTimeMs: Date.now() - startedAt
        };
      }

      hostWindow.postMessage({ type: 'sabflow-sandbox-result', id: id, result: result }, '*');
    });

    // Signal readiness so host can flush the init message.
    hostWindow.postMessage({ type: 'sabflow-sandbox-ready' }, '*');
  })();
`;

/** Build the iframe's srcdoc HTML. */
function buildIframeHtml(): string {
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8">',
    // CSP hardens the iframe even if our sandbox attribute is dropped.
    // - default-src 'none' denies all loads.
    // - script-src 'unsafe-inline' allows our embedded runtime; no URLs.
    // - connect-src * lets user fetches go out (domain whitelist is enforced in JS).
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; connect-src *;\">",
    '</head><body>',
    `<script>${IFRAME_RUNTIME}</script>`,
    '</body></html>',
  ].join('');
}

/** Return true when we're actually in a browser environment. */
function canUseBrowserSandbox(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function'
  );
}

/**
 * Execute user JavaScript inside a hidden sandboxed iframe.
 *
 * Resolves with a normalized `SandboxResult`. Never rejects — errors from
 * user code are reported via `result.error` instead.
 */
export async function runBrowserScript(
  code: string,
  context: SandboxContext,
  options: SandboxOptions = {},
): Promise<SandboxResult> {
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const startedAt = Date.now();

  if (!canUseBrowserSandbox()) {
    return {
      success: false,
      logs: [],
      error: '[sandbox] browser sandbox requires a DOM (window + document)',
      executionTimeMs: 0,
    };
  }

  // ── Create a hidden, sandboxed iframe ────────────────────────────────
  const iframe = document.createElement('iframe');
  // SECURITY: NO `allow-same-origin` — we want an opaque origin.
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'sabflow-sandbox');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  iframe.srcdoc = buildIframeHtml();

  const id = genId();

  // Promise that resolves with the sandbox result (or a synthetic timeout result).
  const resultPromise = new Promise<SandboxResult>((resolve) => {
    let settled = false;
    let readyFired = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const finish = (result: SandboxResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onMessage = (ev: MessageEvent) => {
      // Only accept messages originating from our own iframe's window.
      if (ev.source !== iframe.contentWindow) return;
      const data = ev.data as
        | SandboxMessage
        | { type: 'sabflow-sandbox-ready' }
        | undefined;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'sabflow-sandbox-ready') {
        if (readyFired) return;
        readyFired = true;
        const initMsg: SandboxMessage = {
          type: 'sabflow-sandbox-init',
          id,
          code,
          variables: cloneForPost(context.variables),
          allowFetch: options.allowFetch === true,
          allowedDomains: options.allowedDomains ?? [],
          timeoutMs,
        };
        iframe.contentWindow?.postMessage(initMsg, '*');
        return;
      }

      if (data.type === 'sabflow-sandbox-result' && data.id === id) {
        finish(data.result);
      }
    };

    window.addEventListener('message', onMessage);

    // Wall-clock timeout. Iframes can't be "killed" mid-execution but we
    // can stop listening and tear the DOM node down.
    const timer = window.setTimeout(() => {
      finish({
        success: false,
        logs: [],
        error: `[sandbox] execution exceeded ${timeoutMs}ms timeout`,
        executionTimeMs: Date.now() - startedAt,
      });
    }, timeoutMs + 250 /* grace for init handshake */);
  });

  // Insert the iframe only after listeners are in place.
  document.body.appendChild(iframe);

  const result = await resultPromise;

  // Apply log + variable mutations back to the caller's context.
  const logs: SandboxLogEntry[] = result.logs ?? [];
  for (const entry of logs) {
    if (entry.level === 'error') context.console.error(entry.message);
    else context.console.log(entry.message);
  }
  if (result.variables) {
    for (const [name, value] of Object.entries(result.variables)) {
      context.setVariable(name, value);
    }
  }

  return result;
}

/** Crypto-ish short id; does not need to be cryptographically strong. */
function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Strip non-postMessage-safe values (functions, DOM nodes, …) before sending. */
function cloneForPost(value: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}
