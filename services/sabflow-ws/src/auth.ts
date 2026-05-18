/**
 * JWT verification for the SabFlow WebSocket gateway upgrade handshake.
 *
 * ## Pattern source
 * Mirrors the SabNode JWT pattern documented in `src/lib/jwt-for-rust.ts`
 * and verified against `src/lib/auth.ts` (HS256, `JWT_SECRET`, `jti`-indexed
 * revocation in the `revoked_tokens` Mongo collection). The token transport
 * decision (subprotocol header, 2-minute TTL ceiling) is fixed by the ADR at
 * `docs/adr/sabflow-auth.md` — see "Decision — Option B" and the claim layout.
 *
 * ## Wire contract
 * The browser opens the socket with:
 *
 *     new WebSocket(url, ['sabflow-jwt.<token>'])
 *
 * which surfaces server-side as `Sec-WebSocket-Protocol: sabflow-jwt.<token>`.
 * `extractTokenFromUpgrade(req)` parses this header (it may contain multiple
 * comma-separated values, e.g. `sabflow.v1, sabflow-jwt.<token>`) and returns
 * the raw token or `null` if no `sabflow-jwt.` entry is present.
 *
 * ## Verification flow
 *   1. Decode signature with HS256 against `JWT_SECRET`.
 *   2. Reject anything with `exp - iat > 120s` (TTL hard cap, regardless of
 *      what the mint endpoint actually issued).
 *   3. Forward-declare-via-dynamic-import a revocation hook from
 *      `src/lib/auth.ts` (`isJtiRevoked` if exported). If the symbol is not
 *      present, gracefully no-op — this file is owned by the WS service and
 *      must not hard-couple to a function that has not yet been exported
 *      from the SabNode side.
 *
 * ## Companions (do not touch from this file)
 *   - `connection.ts`        — owns the WS upgrade handler; calls
 *                              `extractTokenFromUpgrade` + `verifyWsToken`.
 *   - `seats.ts`             — reads `claims.ws` to scope seat budgets.
 *   - `audit.ts`             — reads `claims.sub` / `claims.jti` for trails.
 *   - `package.json`         — owned by sibling sub-task #1; that sibling
 *                              MUST add `jsonwebtoken` as a runtime dep
 *                              (see summary at the bottom of the PR body).
 */

import type { IncomingMessage } from 'node:http';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Verified WS auth claims. Shape is consumed by sibling modules
 * (`connection.ts`, `seats.ts`, `audit.ts`) — DO NOT rename fields without
 * coordinating with those owners.
 *
 * Field mapping vs. the mint endpoint claim layout in `docs/adr/sabflow-auth.md`:
 *   - `sub`   → `userId`         (JWT `sub`)
 *   - `ws`    → `workspaceId`    (JWT `tid` in the ADR; renamed to `ws` for
 *                                  the WS gateway because `tid` is also used
 *                                  for the Rust BFF and we want the two to be
 *                                  visually distinguishable in logs).
 *   - `roles` → workspace roles  (`['viewer'|'editor'|'admin'|'owner']`)
 *   - `jti`, `exp`, `iat`        → standard JWT claims (seconds since epoch).
 */
export interface WsAuthClaims {
    sub: string;
    ws: string;
    roles: string[];
    jti: string;
    exp: number;
    iat: number;
}

/** Stable error-code vocabulary for upgrade rejection. */
export type WsAuthErrorCode =
    | 'ERR_NO_TOKEN'
    | 'ERR_BAD_TOKEN'
    | 'ERR_EXPIRED'
    | 'ERR_REVOKED'
    | 'ERR_TTL_TOO_LONG';

export type WsAuthFailure = { ok: false; reason: WsAuthErrorCode };
export type WsAuthSuccess = WsAuthClaims & { ok: true };
export type WsAuthResult = WsAuthSuccess | WsAuthFailure;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hard ceiling on accepted token lifetime, in seconds. */
const MAX_TTL_SECONDS = 120;

/** Subprotocol prefix (per the sabflow-auth ADR). */
const SUBPROTOCOL_PREFIX = 'sabflow-jwt.';

/** HS256, mirroring `src/lib/jwt-for-rust.ts:32` and `src/lib/auth.ts:167`. */
const ALGORITHM: jwt.Algorithm = 'HS256';

// ---------------------------------------------------------------------------
// Secret loader
// ---------------------------------------------------------------------------

let cachedSecret: string | null = null;

function getJwtSecret(): string {
    if (cachedSecret) return cachedSecret;
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error(
            'JWT_SECRET is not defined. The SabFlow WS gateway cannot verify upgrade tokens without it.',
        );
    }
    cachedSecret = secret;
    return cachedSecret;
}

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

/**
 * Pulls the SabFlow JWT out of the WebSocket upgrade request.
 *
 * Accepts both comma-separated lists in a single header and the Node.js
 * `string[]` shape (some proxies split repeated header values into an array).
 * Trims whitespace and matches the leading `sabflow-jwt.` prefix
 * case-sensitively (subprotocol tokens are RFC-6455 case-sensitive).
 *
 * Returns `null` if no `sabflow-jwt.` entry is present OR if the entry has
 * an empty token after the prefix.
 */
export function extractTokenFromUpgrade(req: IncomingMessage): string | null {
    const raw = req.headers['sec-websocket-protocol'];
    if (!raw) return null;

    // Normalize to a single comma-joined string then split — handles both
    // `string` and `string[]` shapes that Node's parser may emit.
    const joined = Array.isArray(raw) ? raw.join(',') : raw;
    const parts = joined.split(',').map((s) => s.trim()).filter(Boolean);

    for (const part of parts) {
        if (part.startsWith(SUBPROTOCOL_PREFIX)) {
            const token = part.slice(SUBPROTOCOL_PREFIX.length);
            return token.length > 0 ? token : null;
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Revocation hook (forward-declared via dynamic import)
// ---------------------------------------------------------------------------

type RevocationHook = (jti: string) => Promise<boolean>;

let revocationHook: RevocationHook | null | undefined;

/**
 * Lazily resolves `isJtiRevoked` from `src/lib/auth.ts` if it has been
 * exported there. If the symbol is absent (current state at time of writing),
 * we cache `null` and never look again — the upgrade fast-paths past
 * revocation checks. When the SabNode side exports `isJtiRevoked`, restart
 * the WS service and revocation becomes active without any code change here.
 *
 * The dynamic import path resolves relative to this file:
 *   services/sabflow-ws/src/auth.ts  →  ../../../src/lib/auth
 * This is acceptable because the WS service is co-located in the same repo
 * (per the gateway ADR). A separate build that vendors only this file would
 * need to stub the import.
 */
async function getRevocationHook(): Promise<RevocationHook | null> {
    if (revocationHook !== undefined) return revocationHook;
    try {
        // Path is intentionally written as a string concatenation so that
        // bundlers don't statically resolve it during the WS service build;
        // the lookup is intentionally best-effort at runtime.
        const modPath = '../../../src/lib/auth';
        const mod: Record<string, unknown> = await import(modPath);
        const candidate = mod.isJtiRevoked;
        if (typeof candidate === 'function') {
            revocationHook = candidate as RevocationHook;
        } else {
            revocationHook = null;
        }
    } catch {
        // No SabNode source available at runtime, or the file fails to load
        // for any other reason — fail-open on revocation, exactly as
        // `src/lib/auth.ts:67` already does on transient DB errors.
        revocationHook = null;
    }
    return revocationHook;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

function fail(reason: WsAuthErrorCode): WsAuthFailure {
    return { ok: false, reason };
}

function isClaimsShape(payload: unknown): payload is WsAuthClaims {
    if (!payload || typeof payload !== 'object') return false;
    const p = payload as Record<string, unknown>;
    return (
        typeof p.sub === 'string' &&
        typeof p.ws === 'string' &&
        Array.isArray(p.roles) &&
        p.roles.every((r) => typeof r === 'string') &&
        typeof p.jti === 'string' &&
        typeof p.exp === 'number' &&
        typeof p.iat === 'number'
    );
}

/**
 * Verifies an HS256 SabFlow WS JWT.
 *
 * Order of checks (any failure short-circuits):
 *   1. Signature + standard claims (`jwt.verify` with `algorithms: ['HS256']`).
 *      `jsonwebtoken` rejects expired tokens here and we map that to
 *      `ERR_EXPIRED`; any other verify error maps to `ERR_BAD_TOKEN`.
 *   2. Claims shape — required string/number/array fields all present.
 *   3. TTL ceiling — `exp - iat <= MAX_TTL_SECONDS`. A token minted with a
 *      longer lifetime is refused even if otherwise valid (defence in depth
 *      against a mis-configured mint endpoint).
 *   4. Revocation — via the optional `isJtiRevoked` forward-declared hook.
 *      Returns `ERR_REVOKED` if the hook reports the jti is revoked.
 *
 * Success returns the raw claims (no `ok: true` flag needed by callers —
 * the function returns `WsAuthClaims | WsAuthFailure`, narrowed via the
 * presence of `ok: false`).
 */
export async function verifyWsToken(
    token: string,
): Promise<WsAuthClaims | WsAuthFailure> {
    if (!token || typeof token !== 'string') {
        return fail('ERR_NO_TOKEN');
    }

    let decoded: unknown;
    try {
        decoded = jwt.verify(token, getJwtSecret(), {
            algorithms: [ALGORITHM],
        });
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            return fail('ERR_EXPIRED');
        }
        // JsonWebTokenError, NotBeforeError, malformed input, wrong alg, etc.
        return fail('ERR_BAD_TOKEN');
    }

    if (!isClaimsShape(decoded)) {
        return fail('ERR_BAD_TOKEN');
    }

    // TTL hard cap. Both `iat` and `exp` are required by `isClaimsShape` so
    // this comparison is well-defined.
    if (decoded.exp - decoded.iat > MAX_TTL_SECONDS) {
        return fail('ERR_TTL_TOO_LONG');
    }

    // Revocation (best-effort — see `getRevocationHook` comment).
    const hook = await getRevocationHook();
    if (hook) {
        try {
            if (await hook(decoded.jti)) {
                return fail('ERR_REVOKED');
            }
        } catch {
            // Hook threw — fail-open on the revocation check, matching the
            // fail-open posture in `src/lib/auth.ts:67`.
        }
    }

    return decoded;
}
