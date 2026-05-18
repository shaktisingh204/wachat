/**
 * SabFlow WebSocket gateway — backpressure & rate-limit layer.
 *
 * Source of truth: docs/adr/sabflow-ws-gateway-node.md §5
 *
 *   | Knob                            | Default                       |
 *   |---------------------------------|-------------------------------|
 *   | WS send queue depth (bytes)     | 1 MiB                         |
 *   | WS receive frame size (bytes)   | 256 KiB binary / 4 KiB JSON   |
 *   | Update messages / sec (inbound) | 60 (burst 120)                |
 *   | Awareness msgs / sec (inbound)  | 30 (burst 60)                 |
 *   | Outbound coalesce window        | 16 ms                         |
 *   | Outbound max batch size         | 64 sub-frames or 256 KiB      |
 *   | Concurrent sockets / user       | 6                             |
 *
 * Strategy is **shed, not buffer**: when caps are hit we close the socket
 * rather than grow memory. Yjs guarantees eventual consistency on reconnect.
 *
 * No runtime dependencies. The plan-tier multipliers are forward-declared
 * against `src/lib/plans.ts` so this file can be imported by `connection.ts`
 * without dragging the Next.js bundle into the standalone service.
 *
 * Sibling consumer: services/sabflow-ws/src/connection.ts (Track A Phase 3
 * sub-task #7, not in this file's ownership).
 */

/* ------------------------------------------------------------------ */
/* Constants — ADR §5 defaults                                         */
/* ------------------------------------------------------------------ */

/** 1 MiB hard cap on per-socket outbound queue (bytes). */
export const SEND_QUEUE_CAP_BYTES = 1024 * 1024;

/** 256 KiB max binary frame size (bytes). */
export const BINARY_FRAME_CAP_BYTES = 256 * 1024;

/** 4 KiB max JSON / text frame size (bytes). */
export const JSON_FRAME_CAP_BYTES = 4 * 1024;

/** Inbound Yjs update steady rate (msgs/sec). */
export const UPDATE_RATE_PER_SEC = 60;
/** Inbound Yjs update burst (token-bucket capacity = 2x steady). */
export const UPDATE_BURST = 120;

/** Inbound awareness steady rate (msgs/sec). */
export const AWARENESS_RATE_PER_SEC = 30;
/** Inbound awareness burst (token-bucket capacity = 2x steady). */
export const AWARENESS_BURST = 60;

/** Outbound coalesce window (ms). */
export const COALESCE_WINDOW_MS = 16;

/** Max sub-frames merged into a single server-batch frame. */
export const COALESCE_MAX_SUBFRAMES = 64;

/** Max byte size of a coalesced server-batch frame (before flush). */
export const COALESCE_MAX_BATCH_BYTES = 256 * 1024;

/** Max concurrent sockets per (userId). */
export const PER_USER_SOCKET_CAP = 6;

/** Server-batch frame tag (ADR §4.1, tag = 0x7F). */
export const BATCH_FRAME_TAG = 0x7f;

/* ------------------------------------------------------------------ */
/* Close codes (ADR §4.3)                                              */
/* ------------------------------------------------------------------ */

export const CLOSE_PAYLOAD_TOO_LARGE = 4413;
export const CLOSE_TOO_MANY_REQUESTS = 4429;
export const CLOSE_SERVER_ERROR = 4500;

/* ------------------------------------------------------------------ */
/* Plan multipliers — forward-declared against src/lib/plans.ts        */
/* ------------------------------------------------------------------ */

/** Plan tier ids exposed by SabNode (mirrors sabflow-seat-model ADR §2). */
export type PlanTier = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';

/** Per-tier scalar multiplier applied to the ADR §5 default limits. */
export type PlanMultiplierMap = Record<PlanTier, number>;

/**
 * Default multipliers used when `src/lib/plans.ts` does not export a
 * `sabflowWsLimitMultipliers` map. Free pays the base rate; paid tiers
 * scale linearly so a single Free socket can't drown a Pro room.
 *
 * Sourced from the task spec — kept in this file so the service can run
 * standalone without a static import into the Next.js codebase.
 */
export const DEFAULT_PLAN_MULTIPLIERS: PlanMultiplierMap = {
  free: 1,
  starter: 1.5,
  pro: 2,
  business: 4,
  enterprise: 8,
};

/**
 * Shape that `src/lib/plans.ts` is expected to optionally export.
 * Forward-declared here so this file has no static dependency on
 * `@/lib/plans`. The connection layer can pass a resolved map at
 * runtime via {@link applyPlanMultipliers}.
 */
export interface PlanMultiplierProvider {
  sabflowWsLimitMultipliers?: Partial<PlanMultiplierMap>;
}

/* ------------------------------------------------------------------ */
/* Limit shape & multiplier application                                */
/* ------------------------------------------------------------------ */

/** Knobs that {@link applyPlanMultipliers} scales per plan tier. */
export interface RateLimits {
  /** Inbound Yjs update steady rate (msgs/sec). */
  updateRatePerSec: number;
  /** Inbound Yjs update token-bucket burst capacity. */
  updateBurst: number;
  /** Inbound awareness steady rate (msgs/sec). */
  awarenessRatePerSec: number;
  /** Inbound awareness token-bucket burst capacity. */
  awarenessBurst: number;
  /** Per-socket outbound queue cap (bytes). */
  sendQueueCapBytes: number;
  /** Binary frame size cap (bytes). */
  binaryFrameCapBytes: number;
  /** JSON / text frame size cap (bytes). */
  jsonFrameCapBytes: number;
  /** Max concurrent sockets per user. */
  perUserSocketCap: number;
}

/** ADR §5 baseline (Free-tier multiplier = 1.0). */
export const DEFAULT_LIMITS: RateLimits = {
  updateRatePerSec: UPDATE_RATE_PER_SEC,
  updateBurst: UPDATE_BURST,
  awarenessRatePerSec: AWARENESS_RATE_PER_SEC,
  awarenessBurst: AWARENESS_BURST,
  sendQueueCapBytes: SEND_QUEUE_CAP_BYTES,
  binaryFrameCapBytes: BINARY_FRAME_CAP_BYTES,
  jsonFrameCapBytes: JSON_FRAME_CAP_BYTES,
  perUserSocketCap: PER_USER_SOCKET_CAP,
};

/**
 * Apply a plan-tier scalar multiplier to {@link RateLimits}.
 *
 * Multiplier sources, in order of precedence:
 *   1. `provider.sabflowWsLimitMultipliers[planTier]` (live from plans.ts)
 *   2. {@link DEFAULT_PLAN_MULTIPLIERS}[planTier]
 *   3. `1.0` (no scaling) for unknown tier ids.
 *
 * Frame-size caps and the per-user socket cap are protocol-level invariants
 * and are **never** scaled — only rate / queue caps are.
 *
 * Returns a fresh object; never mutates `base`.
 */
export function applyPlanMultipliers(
  base: RateLimits,
  planTier: PlanTier | string,
  provider?: PlanMultiplierProvider,
): RateLimits {
  const tier = planTier as PlanTier;
  const m =
    provider?.sabflowWsLimitMultipliers?.[tier] ??
    DEFAULT_PLAN_MULTIPLIERS[tier] ??
    1;

  // Ceil to keep integer rates; queue cap can stay float-rounded to int.
  return {
    updateRatePerSec: Math.max(1, Math.ceil(base.updateRatePerSec * m)),
    updateBurst: Math.max(1, Math.ceil(base.updateBurst * m)),
    awarenessRatePerSec: Math.max(1, Math.ceil(base.awarenessRatePerSec * m)),
    awarenessBurst: Math.max(1, Math.ceil(base.awarenessBurst * m)),
    sendQueueCapBytes: Math.max(
      base.sendQueueCapBytes,
      Math.floor(base.sendQueueCapBytes * m),
    ),
    // Protocol invariants — never scaled.
    binaryFrameCapBytes: base.binaryFrameCapBytes,
    jsonFrameCapBytes: base.jsonFrameCapBytes,
    perUserSocketCap: base.perUserSocketCap,
  };
}

/* ------------------------------------------------------------------ */
/* TokenBucket                                                         */
/* ------------------------------------------------------------------ */

export interface TokenBucketOptions {
  /** Maximum token balance (burst). */
  capacity: number;
  /** Steady-state refill rate (tokens / second). */
  refillPerSec: number;
  /** Injected clock (ms). Defaults to `Date.now`. Test seam. */
  now?: () => number;
}

/**
 * Lazy token bucket. State is `(tokens, lastRefillMs)` and refill is
 * computed on demand inside {@link tryConsume}, so the bucket never holds
 * a timer.
 */
export class TokenBucket {
  readonly capacity: number;
  readonly refillPerSec: number;
  private tokens: number;
  private lastRefillMs: number;
  private readonly now: () => number;

  constructor(opts: TokenBucketOptions) {
    if (!Number.isFinite(opts.capacity) || opts.capacity <= 0) {
      throw new RangeError('TokenBucket: capacity must be > 0');
    }
    if (!Number.isFinite(opts.refillPerSec) || opts.refillPerSec <= 0) {
      throw new RangeError('TokenBucket: refillPerSec must be > 0');
    }
    this.capacity = opts.capacity;
    this.refillPerSec = opts.refillPerSec;
    this.now = opts.now ?? Date.now;
    this.tokens = opts.capacity;
    this.lastRefillMs = this.now();
  }

  /** Remaining tokens at this instant (for tests / debug only). */
  peek(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Try to consume `n` tokens. Returns `true` if the bucket had enough
   * and the tokens were deducted; `false` otherwise. Non-blocking.
   */
  tryConsume(n: number = 1): boolean {
    if (!Number.isFinite(n) || n <= 0) return false;
    this.refill();
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }

  /** Restore to full capacity. */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefillMs = this.now();
  }

  private refill(): void {
    const now = this.now();
    const elapsedMs = now - this.lastRefillMs;
    if (elapsedMs <= 0) return;
    const refilled = (elapsedMs / 1000) * this.refillPerSec;
    if (refilled > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + refilled);
      this.lastRefillMs = now;
    }
  }
}

/* ------------------------------------------------------------------ */
/* PerConnectionLimiter                                                */
/* ------------------------------------------------------------------ */

/** Result of {@link PerConnectionLimiter.trackSend}. */
export interface SendQueueResult {
  /** True if the byte was admitted to the queue. */
  ok: boolean;
  /**
   * When `ok === false` the connection has hit the 1 MiB cap and must be
   * closed with this WS close code (4500 — see ADR §5 "shed not buffer").
   */
  closeCode?: number;
  /** Current bytes outstanding in the send queue. */
  bytesInQueue: number;
}

export interface PerConnectionLimiterOptions {
  limits?: RateLimits;
  now?: () => number;
}

/**
 * Per-socket state: two token buckets (Yjs update, awareness), the
 * outbound send-queue byte counter, and frame-size predicates.
 *
 * Owned 1:1 by a single WS connection. Not thread-safe — Node single-
 * threaded event loop is sufficient.
 */
export class PerConnectionLimiter {
  readonly limits: RateLimits;
  readonly update: TokenBucket;
  readonly awareness: TokenBucket;
  /** Bytes currently sitting in the outbound queue. */
  sendQueueBytes: number = 0;

  constructor(opts: PerConnectionLimiterOptions = {}) {
    this.limits = opts.limits ?? DEFAULT_LIMITS;
    this.update = new TokenBucket({
      capacity: this.limits.updateBurst,
      refillPerSec: this.limits.updateRatePerSec,
      now: opts.now,
    });
    this.awareness = new TokenBucket({
      capacity: this.limits.awarenessBurst,
      refillPerSec: this.limits.awarenessRatePerSec,
      now: opts.now,
    });
  }

  /**
   * Validate that an inbound WS frame is within the size cap for its kind.
   *
   * Returns `true` if the frame is acceptable, `false` if the caller should
   * close the socket with {@link CLOSE_PAYLOAD_TOO_LARGE}.
   *
   * Binary cap: 256 KiB. JSON cap: 4 KiB. (ADR §5.)
   */
  frameSize(buf: ArrayBufferView | ArrayBuffer | string, kind: 'binary' | 'text'): boolean {
    const size = byteLengthOf(buf);
    if (kind === 'binary') {
      return size <= this.limits.binaryFrameCapBytes;
    }
    return size <= this.limits.jsonFrameCapBytes;
  }

  /**
   * Record that `bytes` were queued for outbound delivery. Caller is
   * responsible for matching this with {@link releaseSend} when the WS
   * stack drains the frame.
   *
   * If the post-add total exceeds the 1 MiB cap, returns `ok:false` with
   * `closeCode = 4500` so the connection layer can shed the socket. The
   * byte count is **still incremented** so the caller sees a consistent
   * `bytesInQueue` value while it tears the socket down.
   */
  trackSend(bytes: number): SendQueueResult {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return { ok: false, closeCode: CLOSE_SERVER_ERROR, bytesInQueue: this.sendQueueBytes };
    }
    this.sendQueueBytes += bytes;
    if (this.sendQueueBytes > this.limits.sendQueueCapBytes) {
      return {
        ok: false,
        closeCode: CLOSE_SERVER_ERROR,
        bytesInQueue: this.sendQueueBytes,
      };
    }
    return { ok: true, bytesInQueue: this.sendQueueBytes };
  }

  /** Mark `bytes` as drained from the outbound queue. Clamps at 0. */
  releaseSend(bytes: number): void {
    if (!Number.isFinite(bytes) || bytes < 0) return;
    this.sendQueueBytes = Math.max(0, this.sendQueueBytes - bytes);
  }

  /** Try to debit one inbound Yjs update. */
  consumeUpdate(): boolean {
    return this.update.tryConsume(1);
  }

  /** Try to debit one inbound awareness frame. */
  consumeAwareness(): boolean {
    return this.awareness.tryConsume(1);
  }

  /** Forget all rate state (post-reconnect cleanup; tests). */
  reset(): void {
    this.update.reset();
    this.awareness.reset();
    this.sendQueueBytes = 0;
  }
}

/* ------------------------------------------------------------------ */
/* OutboundCoalescer                                                   */
/* ------------------------------------------------------------------ */

/**
 * One queued frame awaiting flush. Each entry is a single tagged
 * binary frame (`u8 tag || payload`, see ADR §4.1).
 */
export interface CoalescerFrame {
  /** ADR §4.1 tag (e.g. 0x00 sync, 0x01 awareness). Must not be 0x7F. */
  tag: number;
  /** Already-encoded Yjs / awareness payload (no tag prefix). */
  payload: Uint8Array;
}

export interface OutboundCoalescerOptions {
  windowMs?: number;
  maxSubframes?: number;
  maxBatchBytes?: number;
  /**
   * Called when the coalescer flushes. `frame` is the assembled wire frame
   * ready for `ws.send(frame, { binary: true })`. May be a batch frame
   * (tag 0x7F) or a passed-through single tagged frame.
   */
  onFlush: (frame: Uint8Array) => void;
  /** Test seam — replace `setTimeout`. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  /** Test seam — replace `clearTimeout`. */
  clearTimer?: (handle: unknown) => void;
}

/**
 * 16 ms outbound coalescer. Buffers tagged frames and flushes either:
 *   - when the timer fires (16 ms after the first buffered frame), or
 *   - when adding the next frame would exceed the sub-frame or byte cap,
 *     in which case the existing batch flushes synchronously *before*
 *     the new frame is added (so size invariants hold).
 *
 * Wire format for tag 0x7F (ADR §4.1):
 *
 *   ┌──────┬───────────────────────────────────────────────────────┐
 *   │ 0x7F │ N × ( u32-BE-length || u8-tag || payload )           │
 *   └──────┴───────────────────────────────────────────────────────┘
 *
 * The length covers `tag + payload` so the decoder can iterate without
 * a separate sub-frame-count header. If only one frame is buffered when
 * the timer fires, it is sent unwrapped (no batch envelope) to avoid
 * single-message overhead.
 */
export class OutboundCoalescer {
  readonly windowMs: number;
  readonly maxSubframes: number;
  readonly maxBatchBytes: number;
  private readonly onFlush: (frame: Uint8Array) => void;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  private queue: CoalescerFrame[] = [];
  private queuedBytes: number = 0;
  private timerHandle: unknown = null;
  private closed: boolean = false;

  constructor(opts: OutboundCoalescerOptions) {
    this.windowMs = opts.windowMs ?? COALESCE_WINDOW_MS;
    this.maxSubframes = opts.maxSubframes ?? COALESCE_MAX_SUBFRAMES;
    this.maxBatchBytes = opts.maxBatchBytes ?? COALESCE_MAX_BATCH_BYTES;
    this.onFlush = opts.onFlush;
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /**
   * Enqueue a tagged frame. May trigger a synchronous flush if the new
   * frame would push the batch past the sub-frame or byte caps.
   *
   * Throws if `frame.tag === 0x7F` (a batch can't nest a batch) or if
   * the coalescer has been closed.
   */
  enqueue(frame: CoalescerFrame): void {
    if (this.closed) {
      throw new Error('OutboundCoalescer: enqueue after close()');
    }
    if (frame.tag === BATCH_FRAME_TAG) {
      throw new Error('OutboundCoalescer: cannot enqueue a batch frame (0x7F)');
    }
    if ((frame.tag & 0xff) !== frame.tag) {
      throw new RangeError('OutboundCoalescer: tag must fit in u8');
    }

    // Per-subframe envelope inside batch: 4-byte length + 1-byte tag + payload.
    const entryBytes = 4 + 1 + frame.payload.byteLength;

    const wouldExceed =
      this.queue.length + 1 > this.maxSubframes ||
      this.queuedBytes + entryBytes > this.maxBatchBytes;

    if (wouldExceed && this.queue.length > 0) {
      // Flush what we have synchronously so the size invariants hold,
      // then start a fresh window with this new frame.
      this.flushNow();
    }

    this.queue.push(frame);
    this.queuedBytes += entryBytes;

    if (this.timerHandle == null && !this.closed) {
      this.timerHandle = this.setTimer(() => {
        this.timerHandle = null;
        this.flushNow();
      }, this.windowMs);
    }
  }

  /** Force-flush whatever is buffered. No-op if empty. */
  flushNow(): void {
    if (this.timerHandle != null) {
      this.clearTimer(this.timerHandle);
      this.timerHandle = null;
    }
    if (this.queue.length === 0) return;

    const frames = this.queue;
    this.queue = [];
    this.queuedBytes = 0;

    if (frames.length === 1) {
      // Single-frame fast path: emit as a plain tagged frame, no envelope.
      this.onFlush(encodeTaggedFrame(frames[0]));
      return;
    }

    this.onFlush(encodeBatchFrame(frames));
  }

  /** Stop accepting frames; flush any pending. Safe to call multiple times. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.flushNow();
  }

  /** Pending sub-frame count (test / debug). */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** Pending bytes in batch envelope form (test / debug). */
  get pendingBytes(): number {
    return this.queuedBytes;
  }
}

/* ------------------------------------------------------------------ */
/* PerUserSocketLimiter                                                */
/* ------------------------------------------------------------------ */

/** Result of {@link PerUserSocketLimiter.tryRegister}. */
export interface RegisterResult {
  /** True if the socket was admitted. */
  ok: boolean;
  /** When `ok === false`, the WS close code to send (4429). */
  closeCode?: number;
  /** Current open-socket count for the user. */
  current: number;
  /** Cap that was checked against. */
  cap: number;
}

/**
 * Counts concurrent open sockets per userId. The ADR §5 cap is 6;
 * exceeding it rejects the *new* socket with `4429 too-many-requests`
 * (the eviction-oldest variant from ADR §6 lives in the seat layer, not
 * here — this limiter is the cheap pre-seat guard).
 */
export class PerUserSocketLimiter {
  readonly cap: number;
  private readonly counts: Map<string, number> = new Map();

  constructor(cap: number = PER_USER_SOCKET_CAP) {
    if (!Number.isInteger(cap) || cap <= 0) {
      throw new RangeError('PerUserSocketLimiter: cap must be a positive integer');
    }
    this.cap = cap;
  }

  /**
   * Atomically reserve a slot for `userId`. Returns `ok:false` and a
   * `closeCode` of 4429 if the user is already at the cap.
   *
   * The reservation must be released exactly once via {@link release}.
   */
  tryRegister(userId: string): RegisterResult {
    const cur = this.counts.get(userId) ?? 0;
    if (cur >= this.cap) {
      return { ok: false, closeCode: CLOSE_TOO_MANY_REQUESTS, current: cur, cap: this.cap };
    }
    const next = cur + 1;
    this.counts.set(userId, next);
    return { ok: true, current: next, cap: this.cap };
  }

  /** Release a previously-registered slot. Clamps at 0; deletes empty keys. */
  release(userId: string): void {
    const cur = this.counts.get(userId);
    if (cur == null) return;
    if (cur <= 1) {
      this.counts.delete(userId);
      return;
    }
    this.counts.set(userId, cur - 1);
  }

  /** Current open-socket count for `userId` (0 if none). */
  count(userId: string): number {
    return this.counts.get(userId) ?? 0;
  }

  /** Number of distinct users with at least one open socket. */
  get userCount(): number {
    return this.counts.size;
  }

  /** Drop all state (test / shutdown). */
  clear(): void {
    this.counts.clear();
  }
}

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

function byteLengthOf(buf: ArrayBufferView | ArrayBuffer | string): number {
  if (typeof buf === 'string') {
    // Best-effort byte length for JSON frames. Node ships TextEncoder
    // globally; falling back to `Buffer.byteLength` keeps no-deps for
    // pure-JS test environments.
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(buf).byteLength;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const B: any = (globalThis as any).Buffer;
    if (B && typeof B.byteLength === 'function') {
      return B.byteLength(buf, 'utf8');
    }
    // Pessimistic upper bound: 4 bytes per code unit.
    return buf.length * 4;
  }
  if (buf instanceof ArrayBuffer) return buf.byteLength;
  return buf.byteLength;
}

/** Encode a single `(tag || payload)` frame for the wire. */
function encodeTaggedFrame(frame: CoalescerFrame): Uint8Array {
  const out = new Uint8Array(1 + frame.payload.byteLength);
  out[0] = frame.tag & 0xff;
  out.set(frame.payload, 1);
  return out;
}

/**
 * Encode a batch frame:
 *   0x7F || N × ( u32-BE length || u8 tag || payload )
 * where `length` covers `tag + payload`.
 */
function encodeBatchFrame(frames: CoalescerFrame[]): Uint8Array {
  let total = 1; // leading 0x7F
  for (const f of frames) {
    total += 4 + 1 + f.payload.byteLength;
  }
  const out = new Uint8Array(total);
  let off = 0;
  out[off++] = BATCH_FRAME_TAG;
  for (const f of frames) {
    const subLen = 1 + f.payload.byteLength;
    // u32 big-endian length.
    out[off++] = (subLen >>> 24) & 0xff;
    out[off++] = (subLen >>> 16) & 0xff;
    out[off++] = (subLen >>> 8) & 0xff;
    out[off++] = subLen & 0xff;
    out[off++] = f.tag & 0xff;
    out.set(f.payload, off);
    off += f.payload.byteLength;
  }
  return out;
}
