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

import { AsyncLocalStorage } from 'node:async_hooks';
import { cookies } from 'next/headers';

import { issueRustJwt } from '@/lib/jwt-for-rust';
import { getDecodedSession } from '@/lib/auth';
import type { RustErrorEnvelope } from './types';

const DEFAULT_BASE_URL = 'http://localhost:8080';

function getBaseUrl(): string {
    return process.env.RUST_API_URL || DEFAULT_BASE_URL;
}

/**
 * Per-call tenant override.
 *
 * `rustFetch` normally scopes the Rust JWT's `tid` claim to the acting
 * user's id (single-tenant-per-user, the historical default). Project-based
 * modules — SabChat, etc. — need to scope `tid` to the selected *project*
 * instead, so the Rust crates (which filter every collection by
 * `tenantId == ObjectId(auth.tenant_id)`) isolate data per workspace.
 *
 * Rather than thread a fetcher argument through the ~25 hand-written
 * `rustClient.sabchat.*` wrappers, we stash the override in an
 * `AsyncLocalStorage` and have {@link buildAuthHeader} read it. Any Rust call
 * issued inside {@link runWithRustTenant}'s callback inherits the tenant.
 *
 * The acting user (`sub`) is always the real session user — only the tenant
 * scope changes — so audit actors stay correct.
 */
const rustTenantStore = new AsyncLocalStorage<{ tenantId: string }>();

/**
 * Run `fn` with every nested {@link rustFetch} call scoped to `tenantId`
 * (becomes the JWT `tid` claim). Used by project-based modules to bind Rust
 * calls to the active project's workspace id. Returns whatever `fn` returns.
 *
 * @example
 *   const inboxes = await runWithRustTenant(workspaceId, () =>
 *     rustClient.sabchat.inboxes.list());
 */
export function runWithRustTenant<T>(
    tenantId: string,
    fn: () => Promise<T>,
): Promise<T> {
    return rustTenantStore.run({ tenantId: String(tenantId) }, fn);
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
 * Resolve the JWT identity to send to Rust from the Next.js session
 * cookie. We deliberately do NOT call `getSession()` here — that would
 * recurse, since `getSession()` itself is now backed by `rustFetch`.
 *
 * The decoded JWT carries everything we need (`userId`, optionally
 * `email`/`name`); we never have to hit Mongo just to forward identity.
 */
async function buildAuthHeader(): Promise<string> {
    const cookieStore = await cookies();
    const cookie = cookieStore.get('session')?.value;
    const decoded = cookie ? await getDecodedSession(cookie) : null;
    const userId = decoded
        ? ((decoded as any).userId || (decoded as any).sub || (decoded as any)._id)
        : null;

    if (!userId) {
        throw new RustApiError(
            401,
            { ok: false, error: { code: 'UNAUTHORIZED', message: 'No active session' } },
            'No active session for Rust call',
        );
    }

    // Tenant scope: default to the user's own id (single-tenant-per-user),
    // unless a project-based caller has bound an explicit tenant via
    // `runWithRustTenant` (e.g. SabChat scopes `tid` to the active project so
    // the sabchat-* crates isolate data per workspace). The acting user
    // (`sub`) is always the real session user regardless.
    const tenantOverride = rustTenantStore.getStore()?.tenantId;
    const token = await issueRustJwt({
        userId: String(userId),
        tenantId: tenantOverride || String(userId),
        roles: [],
    });

    return `Bearer ${token}`;
}

/**
 * Issue a public JSON request to the Rust BFF — no Authorization header.
 * Use ONLY for routes the Rust side has explicitly mounted as public
 * (today: the SabFiles share endpoints `/v1/sabfiles/share/*`).
 *
 * Throws {@link RustApiError} on non-2xx so callers can branch on `status`.
 */
export async function rustPublicFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${getBaseUrl()}${path}`;
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/json');
    if (!headers.has('Content-Type') && init?.body && !(init.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(url, { ...init, headers, cache: 'no-store' });
    if (!res.ok) {
        let envelope: RustErrorEnvelope | null = null;
        try {
            envelope = (await res.json()) as RustErrorEnvelope;
        } catch {
            // ignore
        }
        throw new RustApiError(res.status, envelope, `Rust API ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
}

/**
 * Issue a JSON request to the Rust BFF as an authenticated **admin**.
 *
 * Use ONLY for routes the Rust side has explicitly gated on the
 * `"admin"` role claim — currently the cross-collection count
 * endpoints used by `getAdminDashboardStats`. Verifies the
 * `admin_session` cookie before minting; throws {@link RustApiError}
 * with a 403 if the caller isn't an admin.
 */
export async function rustAdminFetch<T>(path: string, init?: RequestInit): Promise<T> {
    // Late import to avoid a Server-Component bundling cycle: this file is
    // imported transitively from layouts that don't have admin auth in scope.
    const { getAdminSession } = await import('@/lib/admin-session');
    const admin = await getAdminSession();
    if (!admin?.isAdmin) {
        throw new RustApiError(
            403,
            { ok: false, error: { code: 'FORBIDDEN', message: 'Admin role required.' } },
            'Admin role required for Rust admin call',
        );
    }
    const adminId =
        (admin as any).adminId ||
        (admin as any).admin?._id ||
        (admin as any).admin?.id ||
        'admin';
    const token = await issueRustJwt({
        userId: String(adminId),
        tenantId: String(adminId),
        roles: ['admin'],
    });
    const url = `${getBaseUrl()}${path}`;
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type') && init?.body && !(init.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');
    const res = await fetch(url, { ...init, headers, cache: 'no-store' });
    if (!res.ok) {
        let envelope: RustErrorEnvelope | null = null;
        try {
            envelope = (await res.json()) as RustErrorEnvelope;
        } catch {
            // ignore non-JSON bodies
        }
        throw new RustApiError(res.status, envelope, `Rust API ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
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
    // Default to JSON when the caller hasn't been explicit. Skip when
    // the body is `FormData` so the runtime can set the
    // `multipart/form-data; boundary=...` header itself — overriding it
    // breaks Meta's multipart parsing on the server side.
    const isFormData =
        typeof FormData !== 'undefined' && init?.body instanceof FormData;
    if (!headers.has('Content-Type') && init?.body && !isFormData) {
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

/**
 * Variant of {@link rustFetch} for endpoints that return a non-JSON body
 * (e.g. SabPay's CSV exports, `text/csv`). Authenticates with the session
 * cookie like {@link rustFetch}, but returns the raw response text.
 *
 * @throws {RustApiError} on non-2xx responses.
 */
export async function rustFetchText(path: string, init?: RequestInit): Promise<string> {
    const url = `${getBaseUrl()}${path}`;
    const auth = await buildAuthHeader();

    const headers = new Headers(init?.headers);
    headers.set('Authorization', auth);
    if (!headers.has('Accept')) {
        headers.set('Accept', 'text/csv, text/plain, */*');
    }

    const res = await fetch(url, { ...init, headers, cache: 'no-store' });
    if (!res.ok) {
        let envelope: RustErrorEnvelope | null = null;
        try {
            envelope = (await res.json()) as RustErrorEnvelope;
        } catch {
            // non-JSON error body
        }
        throw new RustApiError(res.status, envelope, `Rust API ${res.status} ${res.statusText}`);
    }
    return res.text();
}

/**
 * Variant of {@link rustFetch} that authenticates as an **explicit user**
 * rather than the session cookie. Used by surfaces that resolve their own
 * principal before calling Rust — e.g. the SabPay public API, which
 * authenticates a merchant via a secret `sk_…` key and then needs to act as
 * that merchant's user id (there is no session cookie on those requests).
 *
 * Mints a short-lived HS256 JWT with `sub = userId` and forwards it as
 * `Authorization: Bearer …`. Throws {@link RustApiError} on non-2xx.
 */
export async function rustFetchAs<T>(
    userId: string,
    path: string,
    init?: RequestInit,
): Promise<T> {
    const token = await issueRustJwt({
        userId: String(userId),
        tenantId: String(userId),
        roles: [],
    });
    const url = `${getBaseUrl()}${path}`;
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const isFormData =
        typeof FormData !== 'undefined' && init?.body instanceof FormData;
    if (!headers.has('Content-Type') && init?.body && !isFormData) {
        headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    const res = await fetch(url, { ...init, headers, cache: 'no-store' });
    if (!res.ok) {
        let envelope: RustErrorEnvelope | null = null;
        try {
            envelope = (await res.json()) as RustErrorEnvelope;
        } catch {
            // non-JSON body
        }
        throw new RustApiError(res.status, envelope, `Rust API ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
}

/**
 * Variant of {@link rustFetch} for endpoints intentionally exposed without
 * tenant authentication — e.g. SabAssist's `/v1/sabassist/public/redeem`,
 * which is hit directly from a customer browser via a share link.
 *
 * Skips the JWT mint so the request goes through unauthenticated. JSON
 * defaulting and error parsing are otherwise identical.
 */
export async function rustFetchPublic<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${getBaseUrl()}${path}`;
    const headers = new Headers(init?.headers);
    const isFormData =
        typeof FormData !== 'undefined' && init?.body instanceof FormData;
    if (!headers.has('Content-Type') && init?.body && !isFormData) {
        headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    const res = await fetch(url, { ...init, headers, cache: 'no-store' });

    if (!res.ok) {
        let envelope: RustErrorEnvelope | null = null;
        try {
            envelope = (await res.json()) as RustErrorEnvelope;
        } catch {
            // see rustFetch
        }
        throw new RustApiError(res.status, envelope, `Rust API ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as T;
}
