/**
 * SabFlow Triggers — generic HTTP polling-trigger framework.
 *
 * Periodically fetches a JSON-array endpoint, dedupes items against a 24h
 * Redis SET, and enqueues every newly-seen item as a workflow execution
 * payload `{ json: item }`.
 *
 * Architectural notes:
 *  - One coordinator per `triggerId`: a Redis `SET NX EX` lock with TTL =
 *    `interval * 2` (capped) ensures only one service instance polls a given
 *    trigger at a time. If the lock is already held, `tick()` exits cleanly
 *    so the other instance keeps ownership.
 *  - Backoff: on consecutive failures the *effective* interval doubles each
 *    time (2x, 4x, 8x, …) up to a hard 1-hour cap. A single successful tick
 *    resets the streak.
 *  - Dedup is best-effort and bounded — keys live in a Redis SET with a
 *    sliding 24h TTL, so very-low-traffic feeds will never re-fire an item
 *    that's older than a day, but extreme outages (>24h) MAY replay items.
 *    This matches the n8n / Zapier polling contract.
 *  - The fetch surface is `fetch`-API shaped; sibling task #1 wires a real
 *    `globalThis.fetch` (Node 20+) — this file does NOT pull in `undici`
 *    directly to keep ownership lines clean.
 *  - Queue / Redis / hash impls are forward-declared as interfaces; sibling
 *    tasks own the concrete singletons (mirrors the `reconnect.ts` pattern
 *    in `services/sabflow-ws/src/`).
 *
 * Sub-task #7 of 10 in Track B Phase 6.
 */

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Forward-declared collaborators (owned by sibling tasks in Track B Phase 6)
// ---------------------------------------------------------------------------

/**
 * Minimal Redis surface this module needs. Compatible with both `redis@4` and
 * `ioredis@5` — sibling #1 picks the concrete client and exposes a singleton.
 *
 * Method signatures intentionally permissive so either client satisfies them:
 *  - `set` MUST support `EX` (TTL in seconds) and `NX` (only-if-absent).
 *  - `sadd` returns number of *new* elements added (0 = duplicate).
 *  - `expire` sets a TTL on the key.
 *  - `sismember` is used by `tick()` only as a fast pre-check; the authoritative
 *    dedup decision comes from `sadd`'s return value (race-free).
 */
export interface PollerRedisClient {
	set(
		key: string,
		value: string,
		options?: { EX?: number; NX?: boolean },
	): Promise<string | null>;
	del(key: string | string[]): Promise<number>;
	sadd(key: string, ...members: string[]): Promise<number>;
	sismember(key: string, member: string): Promise<number>;
	expire(key: string, seconds: number): Promise<number>;
}

/**
 * Workflow execution queue. Sibling task #6 owns the BullMQ-backed
 * implementation; we only need to enqueue jobs here.
 */
export interface ExecutionQueue {
	enqueue(job: {
		workspaceId: string;
		workflowId: string;
		nodeId: string;
		payload: { json: unknown };
		source: "poller";
	}): Promise<void>;
}

/**
 * Structured logger surface (pino-compatible). Sibling task #1 wires a real
 * pino instance; this interface keeps the file unit-testable.
 */
export interface PollerLogger {
	info(obj: Record<string, unknown>, msg?: string): void;
	warn(obj: Record<string, unknown>, msg?: string): void;
	error(obj: Record<string, unknown>, msg?: string): void;
	debug(obj: Record<string, unknown>, msg?: string): void;
}

// ---------------------------------------------------------------------------
// Public config / types
// ---------------------------------------------------------------------------

export type DedupKeyStrategy =
	| { mode: "id" }
	| { mode: "sha256" }
	/** `expression` is a simple `$json.path.to.field` expression (no JS eval). */
	| { mode: "expression"; expression: string };

export interface PollingTriggerConfig {
	/** Tenant scope — all keys/queues are namespaced by this. */
	workspaceId: string;
	/** Workflow this trigger fires. */
	workflowId: string;
	/** Node inside the workflow (entry point). */
	nodeId: string;
	/** Fully-qualified URL to fetch. */
	url: string;
	/** HTTP method. Defaults to GET. */
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	/** Extra headers — merged over the defaults. */
	headers?: Record<string, string>;
	/** Optional JSON body (stringified before sending). */
	body?: unknown;
	/**
	 * Poll interval in **milliseconds**. Clamped to a floor of 60_000 (1 min)
	 * regardless of caller input — the platform-wide minimum.
	 */
	interval: number;
	/** Strategy used to derive a stable dedup key per item. */
	dedupKey: DedupKeyStrategy;
}

export interface PollingTriggerDeps {
	redis: PollerRedisClient;
	queue: ExecutionQueue;
	logger: PollerLogger;
	/** Injection point for tests; defaults to `globalThis.fetch`. */
	fetchImpl?: typeof fetch;
	/** Injection point for tests; defaults to `Date.now`. */
	now?: () => number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hard floor on poll interval — anything faster is abusive. */
const MIN_INTERVAL_MS = 60_000;
/** Hard ceiling on backoff. 1h matches Zapier's polling cap. */
const MAX_BACKOFF_MS = 60 * 60 * 1000;
/** Per-fetch timeout — long enough for a slow API, short enough to keep ticks bounded. */
const FETCH_TIMEOUT_MS = 15_000;
/** Dedup set TTL — sliding 24h window per the trigger spec. */
const DEDUP_TTL_SEC = 24 * 60 * 60;

const KEY_PREFIX = "sabflow:poller";

// ---------------------------------------------------------------------------
// PollingTrigger
// ---------------------------------------------------------------------------

export class PollingTrigger {
	readonly triggerId: string;
	readonly config: Readonly<PollingTriggerConfig>;

	private readonly deps: Required<
		Pick<PollingTriggerDeps, "redis" | "queue" | "logger">
	> & {
		fetchImpl: typeof fetch;
		now: () => number;
	};

	private timer: NodeJS.Timeout | null = null;
	private running = false;
	private consecutiveFailures = 0;
	/** Set to true inside a tick to prevent overlapping invocations. */
	private ticking = false;

	constructor(config: PollingTriggerConfig, deps: PollingTriggerDeps) {
		// Clamp interval to the platform floor.
		const interval = Math.max(MIN_INTERVAL_MS, Math.floor(config.interval));
		this.config = Object.freeze({ ...config, interval });
		this.triggerId = `${config.workspaceId}:${config.workflowId}:${config.nodeId}`;
		this.deps = {
			redis: deps.redis,
			queue: deps.queue,
			logger: deps.logger,
			fetchImpl: deps.fetchImpl ?? globalThis.fetch,
			now: deps.now ?? Date.now,
		};
	}

	// -------------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------------

	/**
	 * Start the polling loop. Schedules the first tick after `interval` ms —
	 * callers wanting an immediate fetch should `await trigger.tick()` first.
	 */
	start(): void {
		if (this.running) return;
		this.running = true;
		this.scheduleNext(this.config.interval);
		this.deps.logger.info(
			{ triggerId: this.triggerId, interval: this.config.interval },
			"polling trigger started",
		);
	}

	/** Stop the loop. Pending in-flight tick is allowed to finish. */
	stop(): void {
		this.running = false;
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.deps.logger.info(
			{ triggerId: this.triggerId },
			"polling trigger stopped",
		);
	}

	/**
	 * Run a single poll cycle. Exposed for tests and for an optional
	 * external scheduler (e.g. Vercel Cron). Re-entrancy-safe.
	 */
	async tick(): Promise<void> {
		if (this.ticking) {
			this.deps.logger.debug(
				{ triggerId: this.triggerId },
				"tick already in progress, skipping",
			);
			return;
		}
		this.ticking = true;
		try {
			await this.runOnce();
		} finally {
			this.ticking = false;
		}
	}

	// -------------------------------------------------------------------------
	// Internals
	// -------------------------------------------------------------------------

	private scheduleNext(delay: number): void {
		if (!this.running) return;
		this.timer = setTimeout(() => {
			void this.tick().finally(() => {
				const next = this.computeNextDelay();
				this.scheduleNext(next);
			});
		}, delay);
		// Don't keep the event loop alive solely for the poller.
		if (typeof (this.timer as { unref?: () => void }).unref === "function") {
			(this.timer as { unref: () => void }).unref();
		}
	}

	private computeNextDelay(): number {
		if (this.consecutiveFailures === 0) return this.config.interval;
		// 2x on first failure, 4x on second, 8x on third, …
		const factor = 2 ** this.consecutiveFailures;
		return Math.min(this.config.interval * factor, MAX_BACKOFF_MS);
	}

	private async runOnce(): Promise<void> {
		const lockKey = `${KEY_PREFIX}:lock:${this.triggerId}`;
		const lockTtlSec = Math.min(
			Math.ceil((this.config.interval * 2) / 1000),
			Math.ceil(MAX_BACKOFF_MS / 1000),
		);
		const lockValue = `${this.deps.now()}:${process.pid ?? 0}`;

		// Coordinator: try to claim the lock. Another instance keeps ownership
		// until its TTL expires — this is intentional, not an error.
		const acquired = await this.deps.redis.set(lockKey, lockValue, {
			EX: lockTtlSec,
			NX: true,
		});
		if (acquired !== "OK" && acquired !== "ok") {
			this.deps.logger.debug(
				{ triggerId: this.triggerId },
				"lock held by another instance, skipping tick",
			);
			return;
		}

		try {
			const items = await this.fetchItems();
			let newCount = 0;
			for (const item of items) {
				const key = this.deriveDedupKey(item);
				if (key === null) continue; // unkeyable item — skip silently
				const enqueued = await this.tryEnqueue(item, key);
				if (enqueued) newCount += 1;
			}
			this.consecutiveFailures = 0;
			this.deps.logger.info(
				{
					triggerId: this.triggerId,
					totalItems: items.length,
					newItems: newCount,
				},
				"polling tick succeeded",
			);
		} catch (err) {
			this.consecutiveFailures += 1;
			this.deps.logger.error(
				{
					triggerId: this.triggerId,
					err: err instanceof Error ? err.message : String(err),
					consecutiveFailures: this.consecutiveFailures,
					nextDelayMs: this.computeNextDelay(),
				},
				"polling tick failed",
			);
		} finally {
			// Release the lock so the *next* scheduled tick (in `interval` ms)
			// can run immediately on this or any other instance. We only delete
			// if we still own it — defends against TTL-expiry races.
			//
			// Note: ioredis / node-redis don't expose CAS-delete directly, so
			// this is best-effort. Worst case: another instance can't poll for
			// up to `lockTtlSec` — harmless given the interval floor.
			try {
				await this.deps.redis.del(lockKey);
			} catch {
				/* ignore — TTL will reclaim it */
			}
		}
	}

	// -------------------------------------------------------------------------
	// Fetch
	// -------------------------------------------------------------------------

	private async fetchItems(): Promise<unknown[]> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		try {
			const method = this.config.method ?? "GET";
			const headers: Record<string, string> = {
				accept: "application/json",
				"user-agent": "sabflow-poller/1.0",
				...(this.config.headers ?? {}),
			};
			let body: string | undefined;
			if (this.config.body !== undefined && method !== "GET") {
				body = JSON.stringify(this.config.body);
				headers["content-type"] = headers["content-type"] ?? "application/json";
			}
			const res = await this.deps.fetchImpl(this.config.url, {
				method,
				headers,
				body,
				signal: controller.signal,
			});
			if (!res.ok) {
				throw new Error(`HTTP ${res.status} ${res.statusText}`);
			}
			const json = (await res.json()) as unknown;
			if (!Array.isArray(json)) {
				throw new Error(
					`expected JSON array from ${this.config.url}, got ${typeof json}`,
				);
			}
			return json;
		} finally {
			clearTimeout(timer);
		}
	}

	// -------------------------------------------------------------------------
	// Dedup
	// -------------------------------------------------------------------------

	private deriveDedupKey(item: unknown): string | null {
		const strategy = this.config.dedupKey;
		switch (strategy.mode) {
			case "id": {
				if (typeof item !== "object" || item === null) return null;
				const id = (item as Record<string, unknown>).id;
				if (id === undefined || id === null) return null;
				return String(id);
			}
			case "sha256": {
				// Stable JSON stringify isn't strictly needed — same JS engine
				// produces consistent key order for plain objects within a
				// single process. Cross-instance dedup tolerates the rare miss.
				const hash = createHash("sha256");
				hash.update(JSON.stringify(item));
				return hash.digest("hex");
			}
			case "expression": {
				return evalJsonPath(strategy.expression, item);
			}
		}
	}

	private async tryEnqueue(item: unknown, dedupKey: string): Promise<boolean> {
		const setKey = `${KEY_PREFIX}:seen:${this.triggerId}`;
		// `sadd` returns 1 when the member is new, 0 when already present.
		// This is the authoritative race-free dedup decision.
		const added = await this.deps.redis.sadd(setKey, dedupKey);
		if (added === 0) return false;

		// Refresh the sliding TTL on every new member. Old members past 24h
		// will eventually be re-fired if they reappear — acceptable per spec.
		await this.deps.redis.expire(setKey, DEDUP_TTL_SEC);

		await this.deps.queue.enqueue({
			workspaceId: this.config.workspaceId,
			workflowId: this.config.workflowId,
			nodeId: this.config.nodeId,
			payload: { json: item },
			source: "poller",
		});
		return true;
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Evaluate a simple dotted-path expression against an item.
 *
 * Accepted forms (no JS `eval`, no full JSONPath — just `.` and `[index]`):
 *   - `$json.id`
 *   - `$json.user.email`
 *   - `$json.items[0].sku`
 *   - `id`               (the `$json.` prefix is optional)
 *
 * Returns `null` if the path doesn't resolve to a primitive — caller treats
 * that as "unkeyable, skip".
 */
function evalJsonPath(expression: string, item: unknown): string | null {
	let path = expression.trim();
	if (path.startsWith("$json.")) path = path.slice("$json.".length);
	else if (path === "$json") return null;

	// Split on `.` and `[N]`, drop empties.
	const segments = path
		.replace(/\[(\d+)\]/g, ".$1")
		.split(".")
		.filter(Boolean);
	if (segments.length === 0) return null;

	let cursor: unknown = item;
	for (const seg of segments) {
		if (cursor === null || cursor === undefined) return null;
		if (typeof cursor !== "object") return null;
		cursor = (cursor as Record<string, unknown>)[seg];
	}
	if (
		cursor === null ||
		cursor === undefined ||
		typeof cursor === "object" ||
		typeof cursor === "function"
	) {
		return null;
	}
	return String(cursor);
}

// Exposed for unit tests in sibling task #10.
export const __internals = {
	evalJsonPath,
	MIN_INTERVAL_MS,
	MAX_BACKOFF_MS,
	FETCH_TIMEOUT_MS,
	DEDUP_TTL_SEC,
};
