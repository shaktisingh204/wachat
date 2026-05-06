/**
 * Rust BFF client for API-key authenticated `/api/v1/*` routes.
 *
 * The default `rustFetch` in `src/lib/rust-client/fetcher.ts` mints its
 * Rust JWT from the inbound Next.js **session cookie** — that pattern is
 * fine for browser-driven Server Actions but breaks for the public
 * developer-platform routes under `/api/v1/*`, which authenticate with
 * a plaintext API key and have no session cookie.
 *
 * This helper mirrors `rustFetch` exactly (URL resolution, error
 * envelope handling, no-store cache, JSON content type) but mints the
 * JWT for an explicit `userId` resolved upstream by `verifyApiKey()`.
 *
 * Usage:
 *
 *   const ctx = await verifyApiKey(req);
 *   if (!ctx) return new Response('Unauthorized', { status: 401 });
 *   const out = await rustFetchAsUser<SendMessageResult>(
 *     ctx.tenantId,
 *     '/v1/wachat/messages/send',
 *     { method: 'POST', body: JSON.stringify(payload) },
 *   );
 *
 * Server-only — uses `RUST_JWT_SECRET` via `issueRustJwt`.
 */

import 'server-only';

import { issueRustJwt } from '@/lib/jwt-for-rust';
import { RustApiError } from '@/lib/rust-client';
import type { RustErrorEnvelope } from '@/lib/rust-client/types';

const DEFAULT_BASE_URL = 'http://localhost:8080';

function getBaseUrl(): string {
    return process.env.RUST_API_URL || DEFAULT_BASE_URL;
}

/**
 * Issue a JSON request to the Rust BFF on behalf of `userId`.
 *
 * Mints a short-lived HS256 JWT scoped to `userId` (used as both `sub`
 * and `tid` to match the cookie-driven `rustFetch` defaults) and
 * forwards the call exactly like `rustFetch`.
 *
 * @typeParam T - Expected success response shape.
 * @param userId - Hex Mongo ObjectId of the API-key owner.
 * @param path - Path beginning with `/` (e.g. `/v1/wachat/messages/send`).
 * @param init - Optional `fetch` overrides.
 * @throws {RustApiError} on non-2xx responses.
 */
export async function rustFetchAsUser<T>(
    userId: string,
    path: string,
    init?: RequestInit,
): Promise<T> {
    if (!userId) {
        throw new RustApiError(
            401,
            { ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing userId for Rust call' } },
            'Missing userId for Rust call',
        );
    }

    const token = await issueRustJwt({
        userId: String(userId),
        tenantId: String(userId),
        roles: [],
    });

    const url = `${getBaseUrl()}${path}`;
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type') && init?.body) {
        headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    const res = await fetch(url, {
        ...init,
        headers,
        cache: 'no-store',
    });

    if (!res.ok) {
        let envelope: RustErrorEnvelope | null = null;
        try {
            envelope = (await res.json()) as RustErrorEnvelope;
        } catch {
            // Non-JSON error body — fall through with a generic message.
        }
        throw new RustApiError(
            res.status,
            envelope,
            `Rust API ${res.status} ${res.statusText}`,
        );
    }

    return (await res.json()) as T;
}
