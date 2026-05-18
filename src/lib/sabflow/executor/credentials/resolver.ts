/**
 * SabFlow Executor — Runtime credential resolver
 * ----------------------------------------------
 *
 * **Track B · Phase 5 · sub-task #4** — Runtime credential injection.
 *
 * Called by {@link NodeExecutionContext.getCredentials} inside a node to
 * fetch decrypted credential material just-in-time. Lives next to its
 * siblings inside `executor/credentials/`:
 *
 * ```
 *   #1  store.ts        ← Mongo-backed lookup  (forward-declared port)
 *   #2  crypto.ts       ← decryptCredential    (direct import)
 *   #5  oauth-refresh.ts ← OAuth2 refresh      (forward-declared port)
 *   #7  audit.ts        ← cred.read audit      (direct import)
 *   #4  resolver.ts     ← THIS FILE
 * ```
 *
 * Sub-tasks #1 and #5 are not yet on disk — they're forward-declared via
 * the {@link CredentialStorePort} / {@link OAuthRefreshPort} interfaces and
 * an injection seam ({@link __setCredentialResolverPorts}). When the real
 * siblings land they wire themselves in at module-init time; nothing here
 * needs to change.
 *
 * Responsibilities:
 *   1. Look up the credential record (by id, or the workspace default).
 *   2. Enforce workspace ownership (cross-workspace ⇒ `WORKSPACE_MISMATCH`).
 *   3. Lazy-refresh OAuth2 tokens when expired.
 *   4. Decrypt the stored envelope via sibling #2.
 *   5. Audit the runtime read via sibling #7 (best-effort, never throws).
 *   6. Cache decrypted material in-process for ≤5min per execution, keyed
 *      by `(executionId, credentialId)`. Cleared on `clearExecutionCache`.
 *
 * Security invariants:
 *   - Decrypted bytes never leave this process — no logging, no audit-meta.
 *   - Cache is per-process, per-execution; never persisted, never shared
 *     across executions (a poisoned cache must not survive a workflow run).
 *   - Cache entries auto-expire at the lesser of `CACHE_TTL_MS` and the
 *     OAuth2 token's `expiresAt`, whichever is sooner.
 */

import 'server-only';

import {
	CredentialsError,
	type CredentialsErrorOptions,
} from '../errors';
import {
	decryptCredential,
	type CredentialEnvelope,
} from './crypto';
import { recordCredentialAudit } from './audit';

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

/**
 * Decrypted credential payload returned to a node.
 *
 * The shape is the JSON object that was originally encrypted — e.g. for an
 * OpenAI credential `{ apiKey: '...' }`. Nodes typecast at the call site.
 *
 * Mirrors n8n's `ICredentialDataDecryptedObject`.
 */
export type DecryptedCredentialData = Record<string, unknown>;

/** Arguments to {@link resolveCredentials}. */
export interface ResolveCredentialsInput {
	/** The workspace performing the read. Enforced against the cred's owner. */
	workspaceId: string;
	/** The execution this read is happening inside. Used as the cache scope. */
	executionId: string;
	/**
	 * Explicit credential id from the node config. When omitted, the
	 * workspace's "default" credential of `credentialType` is used.
	 */
	credentialId?: string;
	/** Provider type (e.g. `'openai'`, `'google_sheets'`). */
	credentialType: string;
	/** Node id surfacing this read — used purely for audit / error context. */
	nodeId?: string;
	/** Node type performing the read — purely descriptive, audit-only. */
	nodeType?: string;
}

/* ------------------------------------------------------------------ */
/* Forward-declared sibling ports                                      */
/* ------------------------------------------------------------------ */

/**
 * Raw credential record as seen from the runtime resolver.
 *
 * This is the projection of sibling #1's Mongo document that the resolver
 * needs — kept narrow on purpose so #1 can evolve its on-disk schema
 * without touching this file.
 */
export interface CredentialRecord {
	id: string;
	workspaceId: string;
	type: string;
	/** Encrypted envelope, as produced by sibling #2's `encryptCredential`. */
	envelope: CredentialEnvelope;
	/**
	 * Whether this credential is the workspace default for its `type`. The
	 * store may surface only one default per (workspaceId, type) pair.
	 */
	isDefault?: boolean;
	/** Optional OAuth2 metadata — present only for OAuth2-flavoured creds. */
	oauth2?: {
		/** Epoch-ms when the current `access_token` expires. */
		expiresAt?: number;
		/** Refresh token, encrypted alongside the access token. */
		hasRefreshToken?: boolean;
	};
}

/**
 * Forward-declared store port — implemented by sibling #1 (`store.ts`).
 *
 * Until #1 lands, calls fail loudly via the default stub. Tests and the
 * real sibling wire in via {@link __setCredentialResolverPorts}.
 */
export interface CredentialStorePort {
	/** Fetch a credential by id (no workspace scoping — resolver enforces). */
	getById(credentialId: string): Promise<CredentialRecord | null>;
	/** Fetch the workspace's default credential for `type`, if any. */
	getDefault(workspaceId: string, type: string): Promise<CredentialRecord | null>;
}

/**
 * Forward-declared OAuth2-refresh port — implemented by sibling #5.
 *
 * Called only when the resolver sees an OAuth2 cred with `expiresAt` in
 * the past (or within a small skew window). The sibling re-encrypts the
 * refreshed envelope and persists it; the resolver receives the new
 * `CredentialRecord` back.
 */
export interface OAuthRefreshPort {
	/**
	 * Refresh `record` if it is OAuth2 and its access token has expired.
	 * Returns the same record untouched when refresh is not applicable;
	 * returns a fresh record with the rotated envelope when it is.
	 */
	maybeRefresh(record: CredentialRecord): Promise<CredentialRecord>;
}

/* ------------------------------------------------------------------ */
/* Default (stub) ports — replaced by siblings at module-init time    */
/* ------------------------------------------------------------------ */

const stubStore: CredentialStorePort = {
	async getById() {
		throw new CredentialsError(
			'Credential store port not wired — sibling #1 (store.ts) has not registered.',
			{ reason: 'missing', details: { code: 'STORE_UNAVAILABLE' } },
		);
	},
	async getDefault() {
		throw new CredentialsError(
			'Credential store port not wired — sibling #1 (store.ts) has not registered.',
			{ reason: 'missing', details: { code: 'STORE_UNAVAILABLE' } },
		);
	},
};

/** No-op refresh port. Real sibling #5 replaces this when it lands. */
const passthroughRefresh: OAuthRefreshPort = {
	async maybeRefresh(record) {
		return record;
	},
};

let storePort: CredentialStorePort = stubStore;
let refreshPort: OAuthRefreshPort = passthroughRefresh;

/**
 * Wire in real implementations of the forward-declared sibling ports.
 *
 * Siblings call this at module-init time:
 *
 * ```ts
 * // in sibling #1 (store.ts):
 * import { __setCredentialResolverPorts } from './resolver';
 * __setCredentialResolverPorts({ store: realStore });
 * ```
 *
 * Tests also use this to inject in-memory fakes.
 */
export function __setCredentialResolverPorts(ports: {
	store?: CredentialStorePort;
	refresh?: OAuthRefreshPort;
}): void {
	if (ports.store) storePort = ports.store;
	if (ports.refresh) refreshPort = ports.refresh;
}

/** Test-only: restore the stub ports. */
export function __resetCredentialResolverPortsForTests(): void {
	storePort = stubStore;
	refreshPort = passthroughRefresh;
	cache.clear();
}

/* ------------------------------------------------------------------ */
/* In-process per-execution LRU cache                                  */
/* ------------------------------------------------------------------ */

/** 5 minutes — matches the upper bound stated by the task. */
const CACHE_TTL_MS = 5 * 60 * 1000;
/** 256 entries — bounded so a runaway workflow can't OOM the worker. */
const CACHE_MAX_ENTRIES = 256;
/** Clock skew tolerance when checking OAuth2 `expiresAt`. */
const OAUTH_REFRESH_SKEW_MS = 30 * 1000;

interface CacheEntry {
	/** Decrypted credential bytes — never logged, never audited. */
	data: DecryptedCredentialData;
	/** Epoch-ms after which this entry must not be served. */
	expiresAt: number;
}

/**
 * Composite cache key — `executionId` first so {@link clearExecutionCache}
 * can prefix-scan cheaply, and so the same credential read in two parallel
 * executions doesn't collide.
 */
function cacheKey(executionId: string, credentialId: string): string {
	return `${executionId}::${credentialId}`;
}

/**
 * Tiny LRU on top of a `Map` — `Map` preserves insertion order, so a
 * `delete` + `set` is enough to mark an entry "most-recently-used".
 *
 * Kept inline (rather than pulling in `lru-cache`) because the surface
 * area we need is trivial and the dep would have to ship to the executor
 * worker. ~30 LOC is cheaper than a transitive dep.
 */
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): DecryptedCredentialData | undefined {
	const entry = cache.get(key);
	if (!entry) return undefined;
	if (entry.expiresAt <= Date.now()) {
		cache.delete(key);
		return undefined;
	}
	// LRU bump.
	cache.delete(key);
	cache.set(key, entry);
	return entry.data;
}

function cacheSet(key: string, data: DecryptedCredentialData, ttlMs: number): void {
	if (cache.has(key)) cache.delete(key);
	cache.set(key, { data, expiresAt: Date.now() + Math.max(0, ttlMs) });
	while (cache.size > CACHE_MAX_ENTRIES) {
		// Evict the oldest insertion — i.e. the first key in iteration order.
		const oldest = cache.keys().next().value;
		if (oldest === undefined) break;
		cache.delete(oldest);
	}
}

/**
 * Drop every cached entry for `executionId`. Called by the executor on
 * execution completion (success, failure, or cancellation) so decrypted
 * bytes don't outlive the run.
 */
export function clearExecutionCache(executionId: string): void {
	if (!executionId) return;
	const prefix = `${executionId}::`;
	for (const key of cache.keys()) {
		if (key.startsWith(prefix)) cache.delete(key);
	}
}

/** Test-only: nuke everything. */
export function __clearCredentialCacheForTests(): void {
	cache.clear();
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

function throwCredsError(
	message: string,
	opts: CredentialsErrorOptions & { detailsCode?: string },
): never {
	const { detailsCode, details, ...rest } = opts;
	throw new CredentialsError(message, {
		...rest,
		details: { ...(details ?? {}), ...(detailsCode ? { code: detailsCode } : {}) },
	});
}

/** Fire-and-forget audit; swallow all errors — auditing must never break a run. */
function safeAudit(
	input: Parameters<typeof recordCredentialAudit>[0],
): void {
	// `recordCredentialAudit` is async but we deliberately don't await — the
	// resolver is on the hot path of every node execution.
	void recordCredentialAudit(input).catch(() => {
		// audit failures are non-fatal; the audit module logs internally.
	});
}

/**
 * Compute the effective TTL for a cache entry. Clamped to {@link CACHE_TTL_MS}
 * and, for OAuth2 creds, also clamped to expire before the access token does.
 */
function computeTtl(record: CredentialRecord): number {
	const base = CACHE_TTL_MS;
	const expiresAt = record.oauth2?.expiresAt;
	if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
		const remaining = expiresAt - Date.now() - OAUTH_REFRESH_SKEW_MS;
		if (remaining < base) return Math.max(0, remaining);
	}
	return base;
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Resolve a decrypted credential for a node at runtime.
 *
 * Lookup order:
 *   1. Cache hit on `(executionId, credentialId)` ⇒ return immediately.
 *   2. Mongo via sibling #1 — by id when given, else workspace default
 *      for `credentialType`.
 *   3. Workspace-ownership check ⇒ throw `WORKSPACE_MISMATCH`.
 *   4. Type check ⇒ throw `TYPE_MISMATCH`.
 *   5. OAuth2 refresh via sibling #5 (no-op for non-OAuth2 creds).
 *   6. Decrypt via sibling #2.
 *   7. Audit `cred.read` via sibling #7 (best-effort).
 *   8. Cache + return.
 *
 * Errors are always {@link CredentialsError}; nodes should let them bubble
 * so the dispatcher can route them to the error port.
 */
export async function resolveCredentials(
	input: ResolveCredentialsInput,
): Promise<DecryptedCredentialData> {
	const { workspaceId, executionId, credentialId, credentialType, nodeId, nodeType } = input;

	if (!workspaceId) {
		throwCredsError('resolveCredentials: workspaceId is required', {
			reason: 'invalid',
			detailsCode: 'WORKSPACE_REQUIRED',
			nodeId,
		});
	}
	if (!credentialType) {
		throwCredsError('resolveCredentials: credentialType is required', {
			reason: 'invalid',
			detailsCode: 'TYPE_REQUIRED',
			nodeId,
		});
	}

	// 1. Cache hit (only meaningful when we have a stable credentialId).
	if (credentialId && executionId) {
		const hit = cacheGet(cacheKey(executionId, credentialId));
		if (hit) return hit;
	}

	// 2. Store lookup — explicit id, else workspace default.
	const record: CredentialRecord | null = credentialId
		? await storePort.getById(credentialId)
		: await storePort.getDefault(workspaceId, credentialType);

	if (!record) {
		throwCredsError(
			credentialId
				? `Credential "${credentialId}" not found`
				: `No default credential of type "${credentialType}" for workspace`,
			{
				reason: 'missing',
				credentialId,
				credentialType,
				detailsCode: credentialId ? 'NOT_FOUND' : 'NO_DEFAULT',
				nodeId,
			},
		);
	}

	// 3. Workspace-ownership check — must reject before any decrypt.
	if (record.workspaceId !== workspaceId) {
		throwCredsError(
			`Credential "${record.id}" does not belong to workspace "${workspaceId}"`,
			{
				reason: 'invalid',
				credentialId: record.id,
				credentialType: record.type,
				detailsCode: 'WORKSPACE_MISMATCH',
				nodeId,
			},
		);
	}

	// 4. Type check.
	if (record.type !== credentialType) {
		throwCredsError(
			`Credential "${record.id}" is of type "${record.type}" but node requested "${credentialType}"`,
			{
				reason: 'invalid',
				credentialId: record.id,
				credentialType,
				detailsCode: 'TYPE_MISMATCH',
				nodeId,
			},
		);
	}

	// 5. Lazy OAuth2 refresh (no-op for non-OAuth2 creds).
	let effective = record;
	const expiresAt = record.oauth2?.expiresAt;
	if (
		typeof expiresAt === 'number' &&
		Number.isFinite(expiresAt) &&
		expiresAt - OAUTH_REFRESH_SKEW_MS <= Date.now()
	) {
		try {
			effective = await refreshPort.maybeRefresh(record);
		} catch (cause) {
			throwCredsError(`OAuth2 refresh failed for credential "${record.id}"`, {
				reason: 'expired',
				credentialId: record.id,
				credentialType,
				detailsCode: 'OAUTH_REFRESH_FAILED',
				nodeId,
				cause,
			});
		}
	}

	// 6. Decrypt via sibling #2.
	let plaintext: DecryptedCredentialData;
	try {
		plaintext = decryptCredential(effective.envelope) as DecryptedCredentialData;
	} catch (cause) {
		throwCredsError(`Failed to decrypt credential "${effective.id}"`, {
			reason: 'invalid',
			credentialId: effective.id,
			credentialType,
			detailsCode: 'DECRYPT_FAILED',
			nodeId,
			cause,
		});
	}

	// 7. Audit (best-effort, fire-and-forget — never blocks the hot path).
	safeAudit({
		workspaceId,
		credentialId: effective.id,
		executionId,
		action: 'cred.read',
		meta: {
			credentialType,
			source: 'runtime',
			nodeType,
		},
	});

	// 8. Cache (only when keyed by a stable id and inside an execution).
	if (executionId) {
		cacheSet(cacheKey(executionId, effective.id), plaintext, computeTtl(effective));
	}

	return plaintext;
}
