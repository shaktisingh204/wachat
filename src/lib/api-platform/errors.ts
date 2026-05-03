/**
 * SabNode Developer Platform — RFC 7807 problem-details error envelope.
 *
 * All errors raised inside `withApiV1` are funneled through `ApiError`.  The
 * `toResponse()` helper produces a standards-compliant
 * `application/problem+json` body so SDKs can branch on `type` strings rather
 * than fragile status-code/message pairs.
 *
 *   throw new ApiError({ type: 'rate_limited', status: 429, title: '...' });
 *
 * The `type` URN doubles as a stable taxonomy for client-side error handling.
 * Documented at /api/v1/openapi.
 */

import 'server-only';

/* ── Problem-type taxonomy ──────────────────────────────────────────────── */

/** Stable problem-type identifiers exposed in the `type` field. */
export type ProblemType =
  | 'auth_required'
  | 'scope_missing'
  | 'rate_limited'
  | 'validation_failed'
  | 'not_found'
  | 'idempotency_conflict'
  | 'unsupported_media_type'
  | 'server_error';

/** Base URN namespace for problem types — stable, public. */
const PROBLEM_BASE = 'https://errors.sabnode.dev/v1/';

/** RFC 7807 problem-details object. */
export interface ProblemDetails {
  /** URN identifying the problem class. */
  type: string;
  /** Short human-readable summary. */
  title: string;
  /** HTTP status code. */
  status: number;
  /** Long-form explanation, may include caller-specific data. */
  detail?: string;
  /** Optional request-id echoed for log correlation. */
  request_id?: string;
  /** Optional structured field errors (used for `validation_failed`). */
  errors?: Array<{ path: string; message: string }>;
  /** Free-form extension fields. */
  [extension: string]: unknown;
}

/* ── ApiError ───────────────────────────────────────────────────────────── */

export interface ApiErrorOptions {
  type: ProblemType;
  status: number;
  title: string;
  detail?: string;
  errors?: Array<{ path: string; message: string }>;
  /** Extra response headers (e.g. `Retry-After`, rate-limit headers). */
  headers?: Record<string, string>;
  /** Underlying cause for server-side logging only — never serialised. */
  cause?: unknown;
}

/**
 * Throwable error class understood by `withApiV1`.  Use the static helpers
 * (`ApiError.authRequired()`, `ApiError.notFound(detail)`, …) to keep call
 * sites short.
 */
export class ApiError extends Error {
  public readonly type: ProblemType;
  public readonly status: number;
  public readonly title: string;
  public readonly detail?: string;
  public readonly errors?: Array<{ path: string; message: string }>;
  public readonly headers: Record<string, string>;

  constructor(opts: ApiErrorOptions) {
    super(opts.title + (opts.detail ? `: ${opts.detail}` : ''));
    this.name = 'ApiError';
    this.type = opts.type;
    this.status = opts.status;
    this.title = opts.title;
    this.detail = opts.detail;
    this.errors = opts.errors;
    this.headers = opts.headers ?? {};
    if (opts.cause !== undefined) {
      // Preserve original cause for server-side logging.
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }

  /** Build the RFC 7807 body. */
  toProblem(requestId?: string): ProblemDetails {
    const body: ProblemDetails = {
      type: PROBLEM_BASE + this.type,
      title: this.title,
      status: this.status,
    };
    if (this.detail) body.detail = this.detail;
    if (this.errors && this.errors.length) body.errors = this.errors;
    if (requestId) body.request_id = requestId;
    return body;
  }

  /** Serialise to a `Response` with `application/problem+json`. */
  toResponse(requestId?: string): Response {
    const headers: Record<string, string> = {
      'content-type': 'application/problem+json; charset=utf-8',
      ...this.headers,
    };
    if (requestId) headers['x-request-id'] = requestId;
    return new Response(JSON.stringify(this.toProblem(requestId)), {
      status: this.status,
      headers,
    });
  }

  /* ── Standard problem types ───────────────────────────────────────────── */

  static authRequired(detail = 'Missing or invalid API key'): ApiError {
    return new ApiError({
      type: 'auth_required',
      status: 401,
      title: 'Authentication required',
      detail,
      headers: { 'www-authenticate': 'Bearer realm="api.sabnode.dev"' },
    });
  }

  static scopeMissing(scope: string): ApiError {
    return new ApiError({
      type: 'scope_missing',
      status: 403,
      title: 'Insufficient scope',
      detail: `Missing required scope: ${scope}`,
    });
  }

  static rateLimited(
    detail = 'Rate limit exceeded',
    headers: Record<string, string> = {},
  ): ApiError {
    return new ApiError({
      type: 'rate_limited',
      status: 429,
      title: 'Too many requests',
      detail,
      headers,
    });
  }

  static validationFailed(
    errors: Array<{ path: string; message: string }>,
    detail = 'Request body failed validation',
  ): ApiError {
    return new ApiError({
      type: 'validation_failed',
      status: 422,
      title: 'Validation failed',
      detail,
      errors,
    });
  }

  static notFound(detail = 'Resource not found'): ApiError {
    return new ApiError({
      type: 'not_found',
      status: 404,
      title: 'Not found',
      detail,
    });
  }

  static idempotencyConflict(detail = 'Idempotency-Key replay with mismatched body'): ApiError {
    return new ApiError({
      type: 'idempotency_conflict',
      status: 409,
      title: 'Idempotency conflict',
      detail,
    });
  }

  static unsupportedMediaType(detail = 'Expected application/json'): ApiError {
    return new ApiError({
      type: 'unsupported_media_type',
      status: 415,
      title: 'Unsupported media type',
      detail,
    });
  }

  static serverError(detail = 'Internal server error', cause?: unknown): ApiError {
    return new ApiError({
      type: 'server_error',
      status: 500,
      title: 'Internal server error',
      detail,
      cause,
    });
  }
}

/** Type guard. */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
