/**
 * CRM Public API — error response helper (Phase 7 foundation).
 *
 * All `/api/v1/crm/<entity>/...` handlers funnel errors through `apiError`
 * so SDKs see a stable shape:
 *
 *   { ok: false, error: { code, message } }
 *
 * The `code` is a stable taxonomy (snake_case, machine-parseable); the
 * `message` is human-readable and may include caller-specific context.
 *
 * This is intentionally simpler than `@/lib/api-platform/errors.ts` (which
 * speaks RFC 7807 problem-details for the legacy codegen surface). The
 * Phase 7 public REST API is a new surface and we want one consistent
 * shape per the spec.
 */

import 'server-only';

import { NextResponse } from 'next/server';

/** Stable error-code taxonomy exposed to API consumers. */
export type ApiErrorCode =
    | 'unauthorized'
    | 'forbidden'
    | 'invalid_token'
    | 'scope_missing'
    | 'not_found'
    | 'validation_failed'
    | 'rate_limited'
    | 'method_not_allowed'
    | 'conflict'
    | 'internal_error';

/** Body shape returned for every error response. */
export interface ApiErrorBody {
    ok: false;
    error: {
        code: ApiErrorCode;
        message: string;
        /** Optional per-field errors for `validation_failed`. */
        details?: Array<{ path: string; message: string }>;
    };
}

/** Body shape returned for every success response (paginated list flavour). */
export interface ApiSuccessListBody<T> {
    ok: true;
    data: T[];
    page: number;
    hasMore: boolean;
    total?: number;
}

/** Body shape returned for every success response (single-record flavour). */
export interface ApiSuccessItemBody<T> {
    ok: true;
    data: T;
}

/**
 * Build a `NextResponse` carrying `{ ok: false, error: { code, message } }`
 * with the right HTTP status. Use the static helpers for common cases.
 */
export function apiError(
    code: ApiErrorCode,
    message: string,
    status: number = 400,
    details?: Array<{ path: string; message: string }>,
): NextResponse<ApiErrorBody> {
    const body: ApiErrorBody = {
        ok: false,
        error: details ? { code, message, details } : { code, message },
    };
    return NextResponse.json(body, { status });
}

/** Wraps a successful list response. */
export function apiListResponse<T>(
    data: T[],
    page: number,
    hasMore: boolean,
    total?: number,
): NextResponse<ApiSuccessListBody<T>> {
    return NextResponse.json({ ok: true, data, page, hasMore, total });
}

/** Wraps a successful single-record response. */
export function apiItemResponse<T>(
    data: T,
    status: number = 200,
): NextResponse<ApiSuccessItemBody<T>> {
    return NextResponse.json({ ok: true, data }, { status });
}

/* ── Shorthand factories for the common error cases ─────────────────────── */

export const ApiErrors = {
    unauthorized: (message = 'Missing or invalid Authorization header') =>
        apiError('unauthorized', message, 401),
    invalidToken: (message = 'API token is invalid or expired') =>
        apiError('invalid_token', message, 401),
    scopeMissing: (scope: string) =>
        apiError('scope_missing', `Missing required scope: ${scope}`, 403),
    forbidden: (message = 'Forbidden') => apiError('forbidden', message, 403),
    notFound: (message = 'Resource not found') =>
        apiError('not_found', message, 404),
    methodNotAllowed: (message = 'Method not allowed') =>
        apiError('method_not_allowed', message, 405),
    validationFailed: (
        message = 'Validation failed',
        details?: Array<{ path: string; message: string }>,
    ) => apiError('validation_failed', message, 422, details),
    conflict: (message = 'Resource conflict') =>
        apiError('conflict', message, 409),
    rateLimited: (message = 'Rate limit exceeded') =>
        apiError('rate_limited', message, 429),
    internalError: (message = 'Internal server error') =>
        apiError('internal_error', message, 500),
} as const;
