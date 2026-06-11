/**
 * Inbound realtime sync — the incoming half of collaboration (other clients' edits → this client).
 *
 * It complements `OfflineOutbox` (outgoing). The engine produces deterministic, replayable diffs and
 * the server assigns every op a total-order `seq`, so multiplayer needs no CRDT merge: each client
 * just replays the op log past the seq it has already applied. `RealtimeSync` polls `opsSince`
 * (today; an SSE/WebSocket push can replace the poller transparently — same fetch), applies remote
 * diffs in order, and advances the shared seq.
 *
 * Coordination with the outbox: while this client has un-synced local edits, inbound apply is
 * deferred (its own edits sync first; if the server has diverged, the outbox's conflict path
 * re-bootstraps). This keeps a single, consistent seq line per client.
 *
 * The logic is dependency-injected so it is unit-testable without a network or a real engine.
 */

export interface RemoteOp {
  seq: number;
  diffs: Uint8Array;
}

export interface RealtimeSyncOptions {
  /** Fetch op-log entries with `seq > sinceSeq`, in ascending seq order. */
  fetchSince: (sinceSeq: number) => Promise<RemoteOp[]>;
  /** Apply one remote diff blob to the local engine. */
  applyRemote: (diffs: Uint8Array) => Promise<void>;
  /** The seq this client has applied up to (shared with the outbox). */
  getSeq: () => Promise<number>;
  setSeq: (seq: number) => Promise<void>;
  /** True when local edits are still queued — defer inbound apply until they've synced. */
  hasPending: () => Promise<boolean>;
  /** Called after at least one remote op is applied (e.g. to repaint the grid). */
  onApplied?: (count: number, seq: number) => void;
  /** True when the network is believed reachable. */
  isOnline: () => boolean;
}

export class RealtimeSync {
  private opts: RealtimeSyncOptions;
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  constructor(opts: RealtimeSyncOptions) {
    this.opts = opts;
  }

  /** Begin polling every `intervalMs` (default 3s). Safe to call once. */
  start(intervalMs = 3000): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.poll(), intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Fetch and apply any new remote ops. Returns the number applied. Reentrancy-guarded, skips when
   * offline or when local edits are still pending.
   */
  async poll(): Promise<number> {
    if (this.polling) return 0;
    if (!this.opts.isOnline()) return 0;
    if (await this.opts.hasPending()) return 0;
    this.polling = true;
    try {
      const since = await this.opts.getSeq();
      const ops = await this.opts.fetchSince(since);
      let applied = 0;
      let lastSeq = since;
      for (const op of ops) {
        if (op.seq <= lastSeq) continue; // ignore anything we've already applied
        await this.opts.applyRemote(op.diffs);
        lastSeq = op.seq;
        applied++;
      }
      if (applied > 0) {
        await this.opts.setSeq(lastSeq);
        this.opts.onApplied?.(applied, lastSeq);
      }
      return applied;
    } catch {
      return 0; // transient failure — try again next tick
    } finally {
      this.polling = false;
    }
  }
}
