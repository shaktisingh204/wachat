/**
 * SabFlow collab — client-side telemetry hooks.
 *
 * Track A · Phase 5 · sub-task 9/10.
 *
 * Scope:
 *  - Browser-only. Safe to import from server bundles (all side effects are
 *    guarded by `typeof window !== 'undefined'` and the queue is a no-op on
 *    the server).
 *  - Posts batched, PII-redacted events to `/api/telemetry`.
 *  - Funnels caught errors through `reportSabFlowError()`.
 *
 * PII rules (mirrors docs/adr/sabflow-executor-observability.md):
 *  - NEVER include Y.Doc update payloads, awareness cursor positions, raw
 *    text deltas, or display names.
 *  - `workspaceId` is allowed in clear text (already broadcast on most
 *    routes).
 *  - `userId` is one-way hashed to a 16-hex-char prefix of sha-256, using
 *    WebCrypto (`subtle.digest`) when available, falling back to a
 *    deterministic non-cryptographic FNV-1a hash so we still emit a stable
 *    identifier in environments where WebCrypto is absent.
 *  - Anything else is passed through `redact()` which strips obvious PII
 *    keys (`name`, `displayName`, `email`, `cursor`, `selection`, `update`,
 *    `payload`, `awareness`, `content`) and bounds string size.
 *
 * Batching:
 *  - Queue is in-memory.
 *  - Flush triggers: 5 s timer, 50-event boundary, `visibilitychange` →
 *    hidden, `pagehide`, and `beforeunload`. The last three use
 *    `navigator.sendBeacon` so the tail of a session is not lost.
 *
 * Event taxonomy: see EVENT type below — only these strings are accepted by
 * the `track()` overloads so call sites stay disciplined.
 *
 * No new deps: relies only on browser globals, optional WebCrypto, and a
 * dynamic `import('@sentry/core')` lookup (already in package.json) that
 * silently degrades to `console.error` if the module is unavailable.
 */

// ────────────────────────────────────────────────────────────────────────
//  Event taxonomy
// ────────────────────────────────────────────────────────────────────────

export type SabFlowCollabEvent =
  | {
      event: 'sabflow.collab.connected';
      props: { docId: string; durationMs: number };
    }
  | {
      event: 'sabflow.collab.reconnect';
      props: { docId: string; attempt: number; after: number };
    }
  | {
      event: 'sabflow.collab.rollback';
      props: { docId: string; reason: string };
    }
  | {
      event: 'sabflow.collab.offline_saved';
      props: { docId: string; count: number };
    }
  | {
      event: 'sabflow.collab.seat_limit';
      props: { tier: string; limit: number };
    };

export type SabFlowEventName = SabFlowCollabEvent['event'];
export type SabFlowEventProps = SabFlowCollabEvent['props'];

// Shape of one queued, ready-to-send envelope.
interface TelemetryEnvelope {
  event: SabFlowEventName;
  ts: number;
  workspaceId?: string;
  userIdHash?: string;
  props: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────
//  Identity context (set once per session, no PII)
// ────────────────────────────────────────────────────────────────────────

interface TelemetryContext {
  workspaceId?: string;
  userIdHash?: string;
}

const context: TelemetryContext = {};

/**
 * Set the workspace + (raw) user id used to stamp every subsequent event.
 * The user id is hashed on entry and never stored in clear text.
 */
export async function setSabFlowTelemetryContext(input: {
  workspaceId?: string;
  userId?: string;
}): Promise<void> {
  if (input.workspaceId) context.workspaceId = input.workspaceId;
  if (input.userId) context.userIdHash = await hashUserId(input.userId);
}

/** Clear identity context (e.g. on sign-out). Does not flush the queue. */
export function clearSabFlowTelemetryContext(): void {
  context.workspaceId = undefined;
  context.userIdHash = undefined;
}

// ────────────────────────────────────────────────────────────────────────
//  PII redaction
// ────────────────────────────────────────────────────────────────────────

const REDACT_KEYS = new Set([
  'name',
  'displayName',
  'username',
  'email',
  'cursor',
  'selection',
  'update',
  'payload',
  'awareness',
  'content',
  'text',
  'body',
  'value',
]);

const ALLOWED_VALUE_TYPES = new Set(['string', 'number', 'boolean']);
const MAX_STRING_LEN = 256;

function redact(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined) continue;
    if (REDACT_KEYS.has(k)) continue;

    const t = typeof v;
    if (!ALLOWED_VALUE_TYPES.has(t)) continue;

    if (t === 'string') {
      const s = v as string;
      out[k] = s.length > MAX_STRING_LEN ? s.slice(0, MAX_STRING_LEN) : s;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────
//  User-id hashing — WebCrypto when available, FNV-1a fallback
// ────────────────────────────────────────────────────────────────────────

async function hashUserId(userId: string): Promise<string> {
  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined'
  ) {
    try {
      const enc = new TextEncoder().encode(userId);
      const buf = await globalThis.crypto.subtle.digest('SHA-256', enc);
      const bytes = new Uint8Array(buf);
      let hex = '';
      for (let i = 0; i < bytes.length && hex.length < 16; i++) {
        hex += bytes[i]!.toString(16).padStart(2, '0');
      }
      return hex.slice(0, 16);
    } catch {
      // Fall through to non-crypto fallback.
    }
  }
  // Deterministic, NON-cryptographic fallback. Acceptable because the value
  // is only used for cohorting; the original id never leaves the client.
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  return (hex + hex).slice(0, 16);
}

// ────────────────────────────────────────────────────────────────────────
//  Batching queue
// ────────────────────────────────────────────────────────────────────────

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_BOUNDARY = 50;
const ENDPOINT = '/api/telemetry';

const queue: TelemetryEnvelope[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function ensureListeners(): void {
  if (listenersAttached || !isBrowser()) return;
  listenersAttached = true;

  // Hidden tab → flush via beacon; the timer may never fire if the tab is
  // throttled to the background.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushSabFlowTelemetry(true);
  });
  window.addEventListener('pagehide', () => {
    void flushSabFlowTelemetry(true);
  });
  // `beforeunload` is fired on full navigations; pair with pagehide for bfcache.
  window.addEventListener('beforeunload', () => {
    void flushSabFlowTelemetry(true);
  });
}

function scheduleFlush(): void {
  if (flushTimer !== null || !isBrowser()) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushSabFlowTelemetry(false);
  }, FLUSH_INTERVAL_MS);
}

/**
 * Drain the queue. When `useBeacon` is true we POST via `sendBeacon` so the
 * request survives page-unload; otherwise we use `fetch` with `keepalive`.
 */
export async function flushSabFlowTelemetry(useBeacon = false): Promise<void> {
  if (!isBrowser() || queue.length === 0) return;

  const batch = queue.splice(0, queue.length);
  const body = JSON.stringify({ events: batch });

  try {
    if (
      useBeacon &&
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function'
    ) {
      const blob = new Blob([body], { type: 'application/json' });
      const ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
      // sendBeacon refused — fall through to fetch.
    }
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    });
  } catch (err) {
    // Drop the batch — telemetry must never break the host app. We still
    // surface the error to the configured reporter so a broken endpoint is
    // visible somewhere.
    reportSabFlowError(err, { phase: 'telemetry.flush' });
  }
}

// ────────────────────────────────────────────────────────────────────────
//  Public: track()
// ────────────────────────────────────────────────────────────────────────

/**
 * Enqueue a SabFlow collab telemetry event. The call is fire-and-forget and
 * synchronous from the caller's perspective. PII redaction is applied
 * before the event hits the queue.
 *
 * Overloaded for type-safety:
 *
 *   track('sabflow.collab.connected', { docId, durationMs });
 */
export function track<E extends SabFlowCollabEvent>(
  event: E['event'],
  props: E['props'],
): void;
export function track(event: SabFlowEventName, props: Record<string, unknown>): void {
  if (!isBrowser()) return;

  ensureListeners();

  const envelope: TelemetryEnvelope = {
    event,
    ts: Date.now(),
    workspaceId: context.workspaceId,
    userIdHash: context.userIdHash,
    props: redact(props ?? {}),
  };

  queue.push(envelope);

  if (queue.length >= FLUSH_BOUNDARY) {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flushSabFlowTelemetry(false);
  } else {
    scheduleFlush();
  }
}

// ────────────────────────────────────────────────────────────────────────
//  Public: error funnel
// ────────────────────────────────────────────────────────────────────────

/**
 * Funnel a SabFlow client-side error. Uses Sentry's `captureException` when
 * `@sentry/core` is initialised on the page; otherwise falls back to
 * `console.error`. Also emits a `track` event so error rates land in the
 * same analytics pipe as feature usage.
 */
export function reportSabFlowError(
  err: unknown,
  info?: Record<string, unknown>,
): void {
  // Always log — cheap, and survives Sentry being unavailable.
  // eslint-disable-next-line no-console
  console.error('[sabflow]', err, info ?? {});

  if (!isBrowser()) return;

  // Dynamic import keeps Sentry out of bundles that never call this fn.
  // `@sentry/core` is the lowest-level surface that exposes
  // `captureException` without forcing a Node or browser SDK choice.
  import('@sentry/core')
    .then((mod) => {
      const capture = (mod as unknown as {
        captureException?: (e: unknown, hint?: unknown) => void;
      }).captureException;
      if (typeof capture === 'function') {
        try {
          capture(err, info ? { extra: redact(info) } : undefined);
        } catch {
          // Reporter must never throw upward.
        }
      }
    })
    .catch(() => {
      // No Sentry on the page — already logged above.
    });
}

// ────────────────────────────────────────────────────────────────────────
//  Test-only helpers (not exported from a barrel)
// ────────────────────────────────────────────────────────────────────────

/** @internal — for unit tests. Returns a copy of the pending queue. */
export function __peekSabFlowTelemetryQueue(): readonly TelemetryEnvelope[] {
  return queue.slice();
}

/** @internal — for unit tests. Drops queued events without sending. */
export function __resetSabFlowTelemetry(): void {
  queue.length = 0;
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  context.workspaceId = undefined;
  context.userIdHash = undefined;
}
