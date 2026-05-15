/**
 * In-process pool of live Baileys sessions.
 *
 * Exposes the same surface area as the Rust engine's
 * `services/sabwa-engine/src/wa/pool.rs` minus the trait gymnastics:
 *
 *   - `getOrCreate(id, opts?)` — fetch an existing session or build + start
 *     a new one. Returns the live `BaileysSession`.
 *   - `remove(id)`             — drop a session from the pool (does NOT log
 *     out; callers wanting a hard logout should call `session.logout()`
 *     first).
 *   - `list()`                 — snapshot of every session currently held.
 *
 * Construction is intentionally lazy — the pool just stores `BaileysSession`
 * instances. The constructor takes no arguments so it can be wired into
 * `AppState` before any session is requested; the per-session config
 * (db / redis / log / authStateKey) is passed in via `getOrCreate`.
 *
 * Pool is `Map`-backed and not safe for use across worker threads — sabwa-node
 * runs as a single process per linked-account fleet (PM2 fork mode), so a
 * shared in-memory pool is the right granularity.
 */

import {
  BaileysSession,
  type BaileysSessionOptions,
  type PairMethod,
} from './session.js';

/** Options needed to spin up a brand-new session via `getOrCreate`. */
export interface CreateSessionOptions
  extends Omit<BaileysSessionOptions, 'sessionId'> {
  // `sessionId` is the map key — passed as the first positional arg.
}

export class SessionPool {
  private readonly sessions = new Map<string, BaileysSession>();

  /** Live count of sessions currently held by the pool. */
  size(): number {
    return this.sessions.size;
  }

  /** Insert a pre-built `BaileysSession`. Used by tests and legacy callers. */
  set(session: BaileysSession): void {
    this.sessions.set(session.sessionId, session);
  }

  /** Return the session for `sessionId` or `undefined` if missing. */
  get(sessionId: string): BaileysSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Fetch the session for `sessionId`. If absent and `opts` is provided,
   * build a brand-new session (and `start()` it) before returning. If
   * absent and no `opts` is provided, returns `undefined`.
   */
  async getOrCreate(
    sessionId: string,
    opts?: CreateSessionOptions,
  ): Promise<BaileysSession | undefined> {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    if (!opts) return undefined;

    const session = new BaileysSession({ sessionId, ...opts });
    // Insert *before* awaiting `start()` so a concurrent `getOrCreate`
    // for the same id doesn't double-create. `start()` is idempotent on
    // the same instance.
    this.sessions.set(sessionId, session);
    try {
      await session.start();
    } catch (err) {
      // If start() blows up immediately, evict so the next attempt gets
      // a clean slate.
      this.sessions.delete(sessionId);
      throw err;
    }
    return session;
  }

  /**
   * Drop a session from the pool. Returns the evicted session (if any)
   * so callers can run cleanup (logout / stop / etc.) outside the pool.
   */
  remove(sessionId: string): BaileysSession | undefined {
    const existing = this.sessions.get(sessionId);
    this.sessions.delete(sessionId);
    return existing;
  }

  /** Alias kept for compatibility with the bootstrap's earlier `delete()` shape. */
  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /** Snapshot of every live session — caller owns the array. */
  list(): BaileysSession[] {
    return Array.from(this.sessions.values());
  }

  /** Iterate over `[sessionId, session]` pairs. */
  entries(): Array<[string, BaileysSession]> {
    return Array.from(this.sessions.entries());
  }
}
