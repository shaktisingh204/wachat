/**
 * Low-level HTTP plumbing for calls into the Rust BFF.
 *
 * Responsibilities:
 *  1. Resolve the target base URL from `RUST_API_URL` (default
 *     `http://localhost:8080` for local dev).
 *  2. Mint a short-lived HS256 JWT via {@link issueRustJwt} and attach it as
 *     `Authorization: Bearer …`.
 *  3. Parse the JSON response, throwing a typed {@link RustApiError} when the
 *     status is non-2xx so callers can `try { ... } catch (e) { ... }` rather
 *     than juggling status codes.
 *
 * This module is `server-only` because `issueRustJwt` reads `RUST_JWT_SECRET`
 * from `process.env` and importing it into a Client Component would leak it
 * to the browser bundle.
 */
import 'server-only';

import { issueRustJwt } from '@/lib/jwt-for-rust';
import { getSession } from '@/app/actions/user.actions';
import type { RustErrorEnvelope } from './types';

const DEFAULT_BASE_URL = 'http://localhost:8080';

function getBaseUrl(): string {
    return process.env.RUST_API_URL || DEFAULT_BASE_URL;
}

/**
 * Thrown by {@link rustFetch} when the Rust backend returns a non-2xx status.
 * Carries the parsed error envelope so callers can branch on `code`.
 */
export class RustApiError extends Error {
    public readonly status: number;
    public readonly code: string;
    public readonly envelope: RustErrorEnvelope | null;

    constructor(status: number, envelope: RustErrorEnvelope | null, fallbackMessage: string) {
        const message = envelope?.error?.message || fallbackMessage;
        super(message);
        this.name = 'RustApiError';
        this.status = status;
        this.code = envelope?.error?.code || 'UNKNOWN';
        this.envelope = envelope;
    }
}

/**
 * Resolve the JWT identity to send to Rust from the current Next.js session.
 *
 * We re-use {@link getSession} from `user.actions.ts` so the cookie-based
 * session is the single source of truth. The session must already be valid;
 * unauthenticated callers get an early throw rather than a confusing 401 from
 * the Rust side.
 */
async function buildAuthHeader(): Promise<string> {
    const session = await getSession();
    if (!session?.user?._id) {
        throw new RustApiError(
            401,
            { ok: false, error: { code: 'UNAUTHORIZED', message: 'No active session' } },
            'No active session for Rust call',
        );
    }

    // Tenant/role plumbing is per-feature. Until the orchestrator wires real
    // tenant + role propagation through, we send the user's own id as the
    // tenant scope and an empty role list. The Rust side currently only reads
    // `sub`, so this is safe — but tighten this BEFORE shipping any handler
    // that gates on `tid` / `roles`.
    const token = await issueRustJwt({
        userId: String(session.user._id),
        tenantId: String(session.user._id),
        roles: [],
    });

    return `Bearer ${token}`;
}

/**
 * Issue a JSON request to the Rust BFF.
 *
 * @typeParam T - Expected success response shape.
 * @param path - Path beginning with `/` (e.g. `/v1/me`). Joined to the base
 *               URL without normalization, so callers must not pass a full
 *               URL by mistake.
 * @param init - Optional `fetch` overrides. `headers`, `Authorization`, and
 *               `Content-Type` from this object are merged on top of the
 *               defaults — useful for sending alternative content types.
 * @throws {RustApiError} on non-2xx responses.
 */
export async function rustFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${getBaseUrl()}${path}`;
    const auth = await buildAuthHeader();

    const headers = new Headers(init?.headers);
    headers.set('Authorization', auth);
    if (!headers.has('Content-Type') && init?.body) {
        headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    const res = await fetch(url, {
        ...init,
        headers,
        // Rust BFF responses are inherently per-request — never cache by
        // accident in a Server Component render.
        cache: 'no-store',
    });

    if (!res.ok) {
        let envelope: RustErrorEnvelope | null = null;
        try {
            envelope = (await res.json()) as RustErrorEnvelope;
        } catch {
            // Non-JSON error body (e.g. 502 from a load balancer). Fall back
            // to the status text so the thrown error still has SOMETHING
            // useful for the developer.
        }
        throw new RustApiError(res.status, envelope, `Rust API ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as T;
}
