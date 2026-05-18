/**
 * SabFlow WS Gateway — server-side reconnect support.
 *
 * Mints short-lived resume tokens on disconnect, redeems them on reconnect,
 * and replays missed oplog entries (seq > lastSeq) so the client can skip the
 * expensive full state-vector handshake.
 *
 * Wire-protocol contract (see docs/adr/sabflow-ws-gateway-node.md, Track A
 * Phase 3): resume frames are emitted as tag-0x00 sync frames — identical on
 * the wire to a full-sync update, so the existing client decoder needs no
 * branch.
 *
 * This module is the ONLY owner of resume-token state. Other modules import
 * the helpers below; they do not touch Redis keys under `sabflow:resume:*`
 * directly.
 *
 * Sibling task #1 of 10 in this slice owns adding the `redis` dependency and
 * wiring the shared client; this file forward-declares both the Redis client
 * and the oplog repo to keep ownership lines clean.
 */

import { nanoid } from "nanoid";

// ---------------------------------------------------------------------------
// Forward-declared collaborators (owned by sibling tasks in Track A Phase 3)
// ---------------------------------------------------------------------------

/**
 * Minimal Redis surface this module needs. Compatible with both `redis@4` and
 * `ioredis@5` — sibling #1 picks the concrete client and exposes a singleton.
 *
 * `set` MUST support `EX` (TTL in seconds) and `NX` semantics via options.
 */
export interface ResumeRedisClient {
	set(
		key: string,
		value: string,
		options?: { EX?: number; NX?: boolean },
	): Promise<string | null>;
	get(key: string): Promise<string | null>;
	del(key: string | string[]): Promise<number>;
}

/**
 * Oplog repository — sibling task owns the Mongo-backed implementation. The
 * async-iterable contract lets us stream replay frames without buffering the
 * whole tail in memory, important for docs with thousands of pending edits.
 *
 * Each yielded `Buffer` is a Yjs update payload (already encoded), ready to
 * be wrapped in a tag-0x00 sync frame by the caller.
 */
export interface OplogRepo {
	replayOplog(
		workspaceId: string,
		docId: string,
		fromSeq: number,
	): AsyncIterable<Buffer>;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ResumeTokenClaims {
	connectionId: string;
	userId: string;
	workspaceId: string;
	docId: string;
	/** Last oplog sequence number the client acknowledged before the drop. */
	lastSeq: number;
}

export interface ResumeToken extends ResumeTokenClaims {
	/** Unix-ms epoch at which the token stops being valid. */
	expiresAt: number;
}

/** Result of `redeemResumeToken`. Always check `ok` before reading `token`. */
export type RedeemResult =
	| { ok: true; token: ResumeToken }
	| {
			ok: false;
			reason:
				| "missing"
				| "expired"
				| "malformed"
				| "claims_mismatch";
	  };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Five minutes — long enough for a flaky tunnel, short enough to bound state. */
export const RESUME_TTL_SECONDS = 5 * 60;

/** Token length in characters. nanoid alphabet → ~190 bits of entropy at 32. */
export const RESUME_TOKEN_LENGTH = 32;

/** Redis key prefix. Keep flat — no per-tenant prefixing needed at this scale. */
const RESUME_KEY_PREFIX = "sabflow:resume:";

/**
 * Frame tag for sync (Yjs update) payloads on the wire. Matches the client
 * decoder; documented in the ADR.
 */
export const SYNC_FRAME_TAG = 0x00 as const;

// ---------------------------------------------------------------------------
// Close-code partition (ADR §"Reconnect policy")
// ---------------------------------------------------------------------------

/**
 * Codes the client SHOULD treat as transient and retry with exponential
 * backoff (1→30s, jitter, 12-attempt cap).
 *
 * - 1001 going-away (server restart / page hide)
 * - 1006 abnormal closure (no close frame — network drop)
 * - 1011 server internal error (likely transient)
 * - 4500 our custom "shedding load" code, retry with backoff
 */
const RETRYABLE_CLOSE_CODES: ReadonlySet<number> = new Set([
	1001, 1006, 1011, 4500,
]);

/**
 * Codes that mean the client MUST tear down state and re-authenticate. Resume
 * tokens minted before such a close are intentionally NOT honored, even if
 * still in Redis — see `redeemResumeToken`.
 *
 * - 4001 missing/invalid token
 * - 4002 expired token
 * - 4003 token revoked
 * - 4004 workspace access denied
 * - 4403 seat limit exceeded (plan downgrade mid-session)
 */
const FATAL_CLOSE_CODES: ReadonlySet<number> = new Set([
	4001, 4002, 4003, 4004, 4403,
]);

/**
 * True if the given WebSocket close code should trigger a resume attempt.
 * False for auth/seat failures (4001-4004, 4403) and any unrecognized code
 * (fail closed — better a full reconnect than a stale resume).
 */
export function isRetryableCloseCode(code: number): boolean {
	if (FATAL_CLOSE_CODES.has(code)) return false;
	return RETRYABLE_CLOSE_CODES.has(code);
}

/** Symmetric helper for clarity at call sites that gate auth tear-down. */
export function isFatalCloseCode(code: number): boolean {
	return FATAL_CLOSE_CODES.has(code);
}

// ---------------------------------------------------------------------------
// Token lifecycle
// ---------------------------------------------------------------------------

function resumeKey(token: string): string {
	return `${RESUME_KEY_PREFIX}${token}`;
}

/**
 * Mint a resume token, persist its claims in Redis with a 5-minute TTL, and
 * return both the opaque token (to send to the client) and the full record
 * (for the gateway's own audit log).
 *
 * Idempotent on token value (nanoid collisions ≪ 2^-90), so we use `set`
 * without NX — the cost of a collision overwriting an unrelated record is
 * effectively zero.
 */
export async function mintResumeToken(
	redis: ResumeRedisClient,
	claims: ResumeTokenClaims,
	now: number = Date.now(),
): Promise<{ token: string; record: ResumeToken }> {
	const token = nanoid(RESUME_TOKEN_LENGTH);
	const expiresAt = now + RESUME_TTL_SECONDS * 1000;
	const record: ResumeToken = { ...claims, expiresAt };

	await redis.set(resumeKey(token), JSON.stringify(record), {
		EX: RESUME_TTL_SECONDS,
	});

	return { token, record };
}

/**
 * Validate a token presented on `?resume=<token>` reconnect, enforce that the
 * presented identity matches the original claims, and burn the token (single
 * use) on success.
 *
 * Returns a discriminated union — callers branch on `ok`. On `ok: false` the
 * caller should fall back to a full sync (initial state-vector handshake).
 *
 * IMPORTANT: the token is deleted BEFORE the caller starts replay so a
 * crash mid-replay doesn't leave a re-usable token; the client will simply
 * fall back to full sync if it has to reconnect again.
 */
export async function redeemResumeToken(
	redis: ResumeRedisClient,
	token: string,
	presented: { userId: string; workspaceId: string },
	now: number = Date.now(),
): Promise<RedeemResult> {
	if (!token || typeof token !== "string") {
		return { ok: false, reason: "missing" };
	}

	const raw = await redis.get(resumeKey(token));
	if (raw == null) return { ok: false, reason: "missing" };

	let parsed: ResumeToken;
	try {
		parsed = JSON.parse(raw) as ResumeToken;
	} catch {
		// Garbage payload — treat as missing, drop the key so it can't haunt us.
		await redis.del(resumeKey(token));
		return { ok: false, reason: "malformed" };
	}

	if (
		typeof parsed.expiresAt !== "number" ||
		typeof parsed.lastSeq !== "number" ||
		typeof parsed.userId !== "string" ||
		typeof parsed.workspaceId !== "string" ||
		typeof parsed.docId !== "string" ||
		typeof parsed.connectionId !== "string"
	) {
		await redis.del(resumeKey(token));
		return { ok: false, reason: "malformed" };
	}

	if (parsed.expiresAt <= now) {
		await redis.del(resumeKey(token));
		return { ok: false, reason: "expired" };
	}

	if (
		parsed.userId !== presented.userId ||
		parsed.workspaceId !== presented.workspaceId
	) {
		// Do NOT delete — could be a hijack attempt against a legit user's
		// token. Let it expire naturally so the rightful owner can still use it.
		return { ok: false, reason: "claims_mismatch" };
	}

	// Single-use: burn it now, before we hand control back to replay.
	await redis.del(resumeKey(token));
	return { ok: true, token: parsed };
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

/**
 * Wrap a raw Yjs update payload in a tag-0x00 sync frame. Single-byte tag
 * prefix — matches the client decoder spec'd in the ADR.
 *
 * Exported for unit tests; the live path uses `replayMissedUpdates` below.
 */
export function encodeSyncFrame(update: Buffer): Buffer {
	const frame = Buffer.allocUnsafe(update.length + 1);
	frame[0] = SYNC_FRAME_TAG;
	update.copy(frame, 1);
	return frame;
}

/**
 * Stream oplog entries with `seq > fromSeq` for `(workspaceId, docId)` and
 * call `send` with each as a tag-0x00 sync frame.
 *
 * Caller is responsible for: deciding to call this (i.e. a successful
 * `redeemResumeToken`), backpressure (await each `send`), and emitting a
 * trailing "you're caught up" signal if the protocol uses one.
 *
 * Throws on repo errors — the caller should catch and fall back to full sync
 * so a transient Mongo blip doesn't permanently brick the connection.
 */
export async function replayMissedUpdates(
	repo: OplogRepo,
	workspaceId: string,
	docId: string,
	fromSeq: number,
	send: (frame: Buffer) => Promise<void> | void,
): Promise<number> {
	let count = 0;
	for await (const update of repo.replayOplog(workspaceId, docId, fromSeq)) {
		await send(encodeSyncFrame(update));
		count += 1;
	}
	return count;
}

// ---------------------------------------------------------------------------
// Convenience: full resume flow
// ---------------------------------------------------------------------------

/**
 * High-level entry point used by the WS upgrade handler:
 *
 *   const outcome = await tryResume(redis, repo, token, { userId, workspaceId }, send);
 *   if (outcome.kind === "resumed") { /* skip full sync *\/ }
 *   else { /* run full state-vector handshake *\/ }
 *
 * Keeps the upgrade handler thin and lets all the policy live here.
 */
export async function tryResume(
	redis: ResumeRedisClient,
	repo: OplogRepo,
	token: string | undefined | null,
	presented: { userId: string; workspaceId: string },
	send: (frame: Buffer) => Promise<void> | void,
	now: number = Date.now(),
): Promise<
	| { kind: "resumed"; replayed: number; from: ResumeToken }
	| { kind: "fallback"; reason: RedeemResult extends { ok: false; reason: infer R } ? R : never }
> {
	if (!token) return { kind: "fallback", reason: "missing" as never };

	const redeemed = await redeemResumeToken(redis, token, presented, now);
	if (!redeemed.ok) {
		return { kind: "fallback", reason: redeemed.reason as never };
	}

	const replayed = await replayMissedUpdates(
		repo,
		redeemed.token.workspaceId,
		redeemed.token.docId,
		redeemed.token.lastSeq,
		send,
	);

	return { kind: "resumed", replayed, from: redeemed.token };
}
