/**
 * System service-token path for **server → Rust engine** calls that have no
 * user session — e.g. a Vercel cron firing scheduled SabCRM workflows.
 *
 * {@link rustFetch} (see `./fetcher.ts`) resolves identity from the `session`
 * cookie via `next/headers`. That works for request-scoped Server Actions /
 * Route Handlers reacting to a logged-in user, but a cron invocation has no
 * cookie to read — `cookies()` would yield nothing and the call would 401.
 *
 * `rustServiceFetch` instead mints a **system** JWT directly from the supplied
 * `projectId` (the tenant scope) and an optional `userId` (defaulting to the
 * literal `"system"`), with a `["system"]` role claim. No cookie is read, so
 * this is safe to call from any non-request context. Error handling mirrors
 * `rustFetch`: a typed {@link RustApiError} on every non-2xx response, JSON
 * defaulting, and `cache: 'no-store'`.
 *
 * This file is `server-only` for the same reason as `fetcher.ts` —
 * `issueRustJwt` reads `RUST_JWT_SECRET` from `process.env`.
 */
import 'server-only';

import { issueRustJwt } from '@/lib/jwt-for-rust';
import { RustApiError } from './fetcher';
import type { RustErrorEnvelope } from './types';

const DEFAULT_BASE_URL = 'http://localhost:8080';

function getBaseUrl(): string {
    return process.env.RUST_API_URL || DEFAULT_BASE_URL;
}

/** Options for {@link rustServiceFetch} — a `RequestInit` plus the tenant scope. */
export interface RustServiceFetchInit extends RequestInit {
    /** Tenant / project the request is scoped to — becomes the JWT `tid`. Required. */
    projectId: string;
    /**
     * Acting user id for the JWT `sub`. Defaults to the literal `"system"` when
     * omitted — this is a server-initiated call with no real user behind it.
     */
    userId?: string;
}

/**
 * Issue a JSON request to the Rust BFF using a **system service token** — no
 * cookie, no user session. Mints a short-lived HS256 JWT scoped to `projectId`
 * with `roles: ["system"]`, attaches it as `Authorization: Bearer …`, and
 * otherwise behaves exactly like {@link rustFetch} (JSON defaulting, `Accept:
 * application/json`, `no-store`, typed {@link RustApiError} on non-2xx).
 *
 * @typeParam T - Expected success response shape.
 * @param path - Path beginning with `/` (e.g. `/v1/sabcrm/activities`). Joined
 *               to the base URL without normalization.
 * @param init - `RequestInit` overrides plus the required `projectId` (and
 *               optional `userId`) used to mint the token.
 * @throws {RustApiError} on non-2xx responses. Note that a missing
 *         `RUST_JWT_SECRET` makes `issueRustJwt` throw a plain `Error`, and a
 *         missing / unreachable `RUST_API_URL` surfaces as a `fetch` rejection
 *         — callers in the scheduler wrap every call in try/catch so these
 *         degrade gracefully into the run report.
 */
export async function rustServiceFetch<T>(
    path: string,
    init: RustServiceFetchInit,
): Promise<T> {
    const { projectId, userId, ...rest } = init;

    const token = await issueRustJwt({
        userId: userId || 'system',
        tenantId: projectId,
        roles: ['system'],
    });

    const url = `${getBaseUrl()}${path}`;
    const headers = new Headers(rest.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const isFormData =
        typeof FormData !== 'undefined' && rest.body instanceof FormData;
    if (!headers.has('Content-Type') && rest.body && !isFormData) {
        headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    const res = await fetch(url, { ...rest, headers, cache: 'no-store' });

    if (!res.ok) {
        let envelope: RustErrorEnvelope | null = null;
        try {
            envelope = (await res.json()) as RustErrorEnvelope;
        } catch {
            // Non-JSON error body (e.g. a 502 from a proxy). Fall back to the
            // status text via RustApiError's fallback message.
        }
        throw new RustApiError(
            res.status,
            envelope,
            `Rust API ${res.status} ${res.statusText}`,
        );
    }

    return (await res.json()) as T;
}
