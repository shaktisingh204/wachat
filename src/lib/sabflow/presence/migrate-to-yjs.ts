/**
 * SabFlow presence — legacy → Yjs awareness migration shim.
 *
 * Track A · Phase 7 · sub-task #1 of 10.
 *
 * What this owns
 * --------------
 * A *call-site-compatible* facade over the existing in-memory presence
 * store at `src/lib/sabflow/presence/store.ts`. The legacy module exports
 * three plain functions — `heartbeat`, `leave`, `listPresence` — that
 * dashboard callers use synchronously today. This file lets those callers
 * keep their exact call shapes while the writes/reads actually land on a
 * Yjs `Awareness` instance (the same one bound by `usePresence` /
 * `<SabFlowProvider>`).
 *
 * What this does NOT do
 * ---------------------
 *   - Delete or rewrite the legacy store. Phase 9 tears it down once every
 *     caller has flipped to `legacyPresenceShim`. Until then both paths
 *     coexist.
 *   - Manage the awareness lifecycle. The caller passes in an
 *     `AwarenessLike` (typically the one held by `<SabFlowProvider>`); we
 *     read/write under a single state-key, never `.destroy()`.
 *   - Cross-tab / cross-process fanout. Yjs awareness handles peers; the
 *     legacy store's TTL-GC has no counterpart here because awareness
 *     already drops disconnected clients via the protocol diff.
 *
 * Legacy API (from `./store.ts`)
 * ------------------------------
 *   export function heartbeat(flowId: string, entry: PresenceEntry): void
 *   export function leave(flowId: string, userId: string): void
 *   export function listPresence(
 *     flowId: string, excludeUserId?: string,
 *   ): PresenceEntry[]
 *
 *   export type PresenceEntry = {
 *     userId: string;
 *     name?: string;
 *     avatarUrl?: string;
 *     cursor?: { x: number; y: number };
 *     lastSeen: number;
 *   };
 *
 * Each shim method returns the *same* shape (sync `void` / `PresenceEntry[]`)
 * — no Promise-ification — so callers compile unchanged.
 *
 * Scope / file ownership
 * ----------------------
 * This file ONLY. `store.ts` stays as-is for Phase 9. The Yjs awareness
 * surface is consumed via the shared `AwarenessLike` interface re-exported
 * from `../client/usePresence` so we don't pull `y-protocols` into the
 * static type graph.
 */

import type { AwarenessLike, PresenceState } from '../client/usePresence';
import type { PresenceEntry } from './store';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LegacyPresenceShimOptions {
	/**
	 * Discriminator that scopes shim writes inside the single awareness
	 * instance. Legacy callers pass a `flowId`; we forward it verbatim. When
	 * one awareness instance is shared across multiple flows (rare — usually
	 * one awareness per `<SabFlowProvider>` per flow) we use this to filter
	 * `listPresence` results.
	 *
	 * Required: the legacy API was always flow-scoped, so leaving it implicit
	 * would silently let one room's writes leak into another's reads.
	 */
	readonly flowId: string;
	/**
	 * Override the once-per-stack `console.warn` channel — handy in tests
	 * (assert on calls) and in Storybook (suppress noise). Default is the
	 * real `console.warn`.
	 */
	readonly warn?: (message: string) => void;
}

// ---------------------------------------------------------------------------
// Shim shape — matches the legacy module's three exports 1:1
// ---------------------------------------------------------------------------

export interface LegacyPresenceShim {
	/** @deprecated Use `usePresence().setLocal({...})`. */
	heartbeat(flowId: string, entry: PresenceEntry): void;
	/** @deprecated Awareness drops disconnected peers automatically — call `awareness.destroy()` on unmount. */
	leave(flowId: string, userId: string): void;
	/** @deprecated Read `usePresence().peers` (a `Map<number, PresenceState>`). */
	listPresence(flowId: string, excludeUserId?: string): PresenceEntry[];
}

// ---------------------------------------------------------------------------
// Once-per-caller-stack deprecation warning
// ---------------------------------------------------------------------------

const warnedStacks = new Set<string>();

/**
 * Pull a stable-ish caller fingerprint out of `new Error().stack`. We slice
 * off the top frames (this function + the shim wrapper) so the first
 * remaining frame is the caller — same shape across V8 + JSC engines.
 *
 * Falls back to the legacy method name if stack is unavailable (some
 * sandboxes / production minification strip it). That degrades gracefully:
 * one warning per method instead of one warning per call-site, but never
 * spam.
 */
function callerFingerprint(method: string): string {
	const raw = new Error().stack;
	if (!raw) return `nostack:${method}`;
	const lines = raw.split('\n');
	// Frame 0 is "Error", frame 1 is `callerFingerprint`, frame 2 is `warnOnce`,
	// frame 3 is the shim method. The *caller* is frame 4 — that's the
	// fingerprint we key warnings on so each unique call-site warns once.
	const callerLine = lines[4] ?? lines[lines.length - 1] ?? method;
	return callerLine.trim();
}

function warnOnce(
	method: string,
	replacement: string,
	emit: (message: string) => void,
): void {
	const fp = callerFingerprint(method);
	if (warnedStacks.has(fp)) return;
	warnedStacks.add(fp);
	emit(
		`[sabflow/presence] \`${method}\` is deprecated — Phase 9 removes the ` +
			`in-memory store. Migrate to ${replacement}. Caller: ${fp}`,
	);
}

// ---------------------------------------------------------------------------
// Awareness <-> legacy `PresenceEntry` adapters
// ---------------------------------------------------------------------------

const STATE_KEY = 'sabflow';
const SHIM_FLOW_KEY = 'sabflow_shim_flow';

/**
 * Project a Yjs `PresenceState` into the legacy `PresenceEntry` wire shape.
 * Cursor is forwarded only when present (legacy field is optional); the
 * legacy store has no `selection`/`color`/`idleSince` fields, so those are
 * dropped on the way out. That's a *lossy* projection by design — legacy
 * consumers never saw those fields, so surfacing them would surprise.
 */
function presenceStateToLegacyEntry(state: PresenceState): PresenceEntry {
	const entry: PresenceEntry = {
		userId: state.userId,
		name: state.name,
		lastSeen: state.lastSeen,
	};
	if (state.cursor && typeof state.cursor === 'object') {
		entry.cursor = { x: state.cursor.x, y: state.cursor.y };
	}
	return entry;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build a drop-in replacement for the three legacy `./store.ts` exports
 * that writes/reads through a Yjs `AwarenessLike` instance.
 *
 * Usage (e.g. inside a dashboard hook that hasn't migrated yet):
 *
 *     const shim = legacyPresenceShim(awareness, { flowId });
 *     shim.heartbeat(flowId, { userId, name, cursor, lastSeen: Date.now() });
 *     const others = shim.listPresence(flowId, userId);
 *
 * Each method emits a `console.warn` once per unique caller stack so the
 * dashboard team sees migration nags exactly where they're called — but
 * not in a tight render loop.
 */
export function legacyPresenceShim(
	awareness: AwarenessLike,
	options: LegacyPresenceShimOptions,
): LegacyPresenceShim {
	const { flowId: ownerFlowId, warn = (msg) => console.warn(msg) } = options;

	return {
		heartbeat(flowId, entry) {
			warnOnce('heartbeat', '`usePresence().setLocal({ cursor })`', warn);
			// Awareness is local-client-scoped: `setLocalStateField` mutates THIS
			// client's slot only, so calling it for a different userId would lie
			// about identity. We honor the legacy signature but write under the
			// awareness clientID — the `userId` round-trips through the state
			// payload itself, matching how `usePresence` already does it.
			const prevRaw = (awareness.getLocalState() ?? {}) as Record<
				string,
				unknown
			>;
			const prev =
				(prevRaw[STATE_KEY] as PresenceState | undefined) ?? null;
			const next: PresenceState = {
				userId: entry.userId,
				name: entry.name ?? prev?.name ?? entry.userId,
				color: prev?.color ?? '#888888',
				cursor: entry.cursor ?? prev?.cursor ?? null,
				selection: prev?.selection ?? null,
				idleSince: null,
				lastSeen: Date.now(),
			};
			awareness.setLocalStateField(STATE_KEY, next);
			// Stamp the flow id under a sibling key so `listPresence` can filter
			// remote peers by room when one awareness happens to span flows.
			awareness.setLocalStateField(SHIM_FLOW_KEY, flowId);
		},

		leave(flowId, userId) {
			warnOnce(
				'leave',
				'awareness lifecycle (`awareness.destroy()` on unmount)',
				warn,
			);
			// Only meaningful for the local client — awareness can't evict a
			// remote peer. If the caller is asking us to leave on behalf of a
			// different userId, that's a no-op (the legacy store would silently
			// no-op too when the entry was missing).
			const prevRaw = (awareness.getLocalState() ?? {}) as Record<
				string,
				unknown
			>;
			const prev =
				(prevRaw[STATE_KEY] as PresenceState | undefined) ?? null;
			const flowMatches = prevRaw[SHIM_FLOW_KEY] === flowId;
			if (!prev || prev.userId !== userId || !flowMatches) return;
			// Clear our SabFlow slot but keep the awareness instance alive —
			// `<SabFlowProvider>` owns the destroy.
			awareness.setLocalStateField(STATE_KEY, null);
			awareness.setLocalStateField(SHIM_FLOW_KEY, null);
		},

		listPresence(flowId, excludeUserId) {
			warnOnce('listPresence', '`usePresence().peers`', warn);
			const out: PresenceEntry[] = [];
			// Defensive: legacy callers may invoke the shim with a flowId that
			// doesn't match `options.flowId`. We trust the *call argument* (it's
			// what the legacy API contract promises) but cross-check against
			// `ownerFlowId` for the warning channel — mismatches are a smell.
			if (flowId !== ownerFlowId) {
				warnOnce(
					'listPresence:flow-mismatch',
					`shim bound to flow=${ownerFlowId}, asked for ${flowId}`,
					warn,
				);
			}
			for (const state of awareness.getStates().values()) {
				const entry = (state as Record<string, unknown>)[STATE_KEY] as
					| PresenceState
					| undefined;
				const peerFlow = (state as Record<string, unknown>)[SHIM_FLOW_KEY];
				if (!entry || typeof entry !== 'object') continue;
				if (peerFlow !== undefined && peerFlow !== flowId) continue;
				if (excludeUserId && entry.userId === excludeUserId) continue;
				out.push(presenceStateToLegacyEntry(entry));
			}
			return out;
		},
	};
}

// ---------------------------------------------------------------------------
// Test-only reset hook
// ---------------------------------------------------------------------------

/**
 * Clear the once-per-caller-stack warning memo. Tests that exercise the
 * deprecation channel call this in `beforeEach` so each case starts from a
 * clean slate. NOT exported via the package barrel — import the path
 * directly.
 */
export function __resetDeprecationWarningsForTest(): void {
	warnedStacks.clear();
}

// ---------------------------------------------------------------------------
// Migration cheat sheet
// ---------------------------------------------------------------------------
/*
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LEGACY → Yjs AWARENESS MIGRATION CHEAT SHEET                             │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │                                                                          │
 * │  Legacy (`src/lib/sabflow/presence/store.ts`)                            │
 * │  ────────────────────────────────────────────                            │
 * │  heartbeat(flowId, entry: PresenceEntry): void                           │
 * │    └─► Yjs:  const { setLocal } = usePresence(doc, { localUser });       │
 * │               setLocal({ cursor: entry.cursor ?? null });                │
 * │       Notes: identity (name/userId/color) comes from `localUser` props,  │
 * │              not from each call. `lastSeen` is stamped by the hook on    │
 * │              every `setLocal`. Idle reset is automatic.                  │
 * │                                                                          │
 * │  leave(flowId, userId): void                                             │
 * │    └─► Yjs:  awareness.destroy()  (handled by `usePresence` unmount)     │
 * │       Notes: there is no manual "leave for someone else" — awareness     │
 * │              evicts peers via the protocol diff when their socket drops. │
 * │                                                                          │
 * │  listPresence(flowId, excludeUserId?): PresenceEntry[]                   │
 * │    └─► Yjs:  const { peers } = usePresence(doc, { localUser });          │
 * │               // peers: Map<number /*clientID*\/, PresenceState>         │
 * │               // already excludes self; iterate `peers.values()`.        │
 * │       Notes: PresenceState carries richer fields (color, selection,      │
 * │              idleSince). Drop them if your UI only needs the legacy      │
 * │              shape — `presenceStateToLegacyEntry` in this file is the    │
 * │              reference projection.                                       │
 * │                                                                          │
 * │  PresenceEntry  (legacy shape)                                           │
 * │    └─► Yjs:  PresenceState   (from `../client/usePresence`)              │
 * │       Field map:                                                         │
 * │         userId    → userId          (identical)                          │
 * │         name      → name            (required in Yjs, optional legacy)   │
 * │         avatarUrl → (none)          (not in Yjs payload yet — add        │
 * │                                      to PresenceState if you need it)    │
 * │         cursor    → cursor          ({x,y} | null in Yjs)                │
 * │         lastSeen  → lastSeen        (identical semantics)                │
 * │                                                                          │
 * │  TTL-GC (15 s)                                                           │
 * │    └─► Yjs:  awareness protocol drops peers on disconnect — no TTL knob. │
 * │              Idle detection (30 s) is a *separate* `idleSince` field;    │
 * │              the legacy store conflated "stale heartbeat" with "left",   │
 * │              awareness splits them.                                      │
 * │                                                                          │
 * │  Phase 9 removal                                                         │
 * │  ───────────────                                                         │
 * │  Once every caller imports from `usePresence` directly (no more          │
 * │  `legacyPresenceShim(...)` instances), delete:                           │
 * │    - `src/lib/sabflow/presence/store.ts`                                 │
 * │    - this file                                                           │
 * │    - the legacy `PresenceEntry` re-exports                               │
 * │                                                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
