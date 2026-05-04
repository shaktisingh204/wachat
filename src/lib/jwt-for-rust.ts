/**
 * Mints short-lived (15 min) HS256 JWTs that the Next.js BFF sends to the Rust
 * backend.
 *
 * ## Why a separate token?
 * The user-facing session (see `src/lib/jwt.ts`) is a 7-day cookie-bound JWT
 * meant for the browser ↔ Next.js boundary. It has different claims, a
 * different secret, and a different lifetime. Sharing it with Rust would leak
 * a long-lived credential into a service that doesn't need one.
 *
 * Instead, a Server Action / Route Handler that has *already* validated the
 * user's session calls {@link issueRustJwt} and forwards the resulting token
 * to Rust as `Authorization: Bearer <token>`.
 *
 * ## Rust counterpart
 * - Crate: `rust/crates/auth/` (`sabnode-auth`).
 * - Verifier: {@link file://./../../rust/crates/auth/src/jwt.rs}.
 * - Extractor: `AuthUser` in `rust/crates/auth/src/extractor.rs`.
 *
 * The claim shape and `iss` value MUST stay in sync with
 * `rust/crates/auth/src/claims.rs`. If you change anything here, change it
 * there too.
 *
 * ## Environment
 * - `RUST_JWT_SECRET` — shared HS256 secret. MUST be set on both the Next.js
 *   and Rust deployments. Generate with `openssl rand -hex 64`.
 */

import { SignJWT } from 'jose';

const ISSUER = 'sabnode-bff';
const ALGORITHM = 'HS256';
const TTL_SECONDS = 15 * 60; // 15 minutes

let cachedSecret: Uint8Array | null = null;

function getRustJwtSecret(): Uint8Array {
    if (cachedSecret) return cachedSecret;
    const secret = process.env.RUST_JWT_SECRET;
    if (!secret) {
        throw new Error(
            'RUST_JWT_SECRET is not defined. The Next.js BFF cannot mint tokens for the Rust backend without it.',
        );
    }
    cachedSecret = new TextEncoder().encode(secret);
    return cachedSecret;
}

export interface IssueRustJwtOptions {
    /** Authenticated user ID (Mongo ObjectId hex). Becomes JWT `sub`. */
    userId: string;
    /** Tenant / project the request is scoped to. Becomes JWT `tid`. */
    tenantId: string;
    /**
     * Permission roles for the user within `tenantId` (e.g. `["owner"]`,
     * `["admin"]`, `["agent"]`). Becomes JWT `roles`.
     */
    roles: string[];
}

/**
 * Mint a short-lived (15 min) HS256 JWT for a Rust BFF call.
 *
 * The caller is responsible for having already authenticated the user via
 * the normal NextAuth/session flow. This function does NOT perform any
 * authentication of its own — it only encodes the supplied identity.
 *
 * @throws if `RUST_JWT_SECRET` is unset.
 */
export async function issueRustJwt(opts: IssueRustJwtOptions): Promise<string> {
    if (!opts.userId) throw new Error('issueRustJwt: userId is required');
    if (!opts.tenantId) throw new Error('issueRustJwt: tenantId is required');
    if (!Array.isArray(opts.roles)) {
        throw new Error('issueRustJwt: roles must be an array');
    }

    const now = Math.floor(Date.now() / 1000);

    return new SignJWT({
        tid: opts.tenantId,
        roles: opts.roles,
    })
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(opts.userId)
        .setIssuer(ISSUER)
        .setIssuedAt(now)
        .setExpirationTime(now + TTL_SECONDS)
        .sign(getRustJwtSecret());
}
