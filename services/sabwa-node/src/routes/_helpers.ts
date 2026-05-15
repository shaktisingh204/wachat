/**
 * Tiny shared helpers used across the CRUD route files.
 */

import type { Request, Response } from 'express';
import type { AppState } from '../state.js';

/** Pull the shared AppState off `app.locals`. */
export function stateOf(req: Request): AppState {
  return req.app.locals.state as AppState;
}

/** First non-empty actor identifier from common header conventions. */
export function actorContext(req: Request): {
  userId?: string;
  actorEmail?: string;
  actorIp?: string;
  userAgent?: string;
} {
  const h = (n: string): string | undefined => {
    const v = req.header(n);
    return v && v.trim().length > 0 ? v.trim() : undefined;
  };
  const out: {
    userId?: string;
    actorEmail?: string;
    actorIp?: string;
    userAgent?: string;
  } = {};
  const userId = h('x-sabwa-user-id') ?? h('x-user-id');
  if (userId) out.userId = userId;
  const actorEmail = h('x-sabwa-user-email') ?? h('x-user-email');
  if (actorEmail) out.actorEmail = actorEmail;
  const fwd = h('x-forwarded-for');
  const actorIp = fwd?.split(',')[0]?.trim() ?? req.ip;
  if (actorIp) out.actorIp = actorIp;
  const ua = h('user-agent');
  if (ua) out.userAgent = ua;
  return out;
}

/** Format a zod-style issue array for a `400` response body. */
export function badRequest(res: Response, message: string, details?: unknown): void {
  res.status(400).json({ error: message, code: 'bad_request', details });
}

export function notFound(res: Response, resource: string): void {
  res.status(404).json({ error: `${resource} not found`, code: 'not_found' });
}

/**
 * Coerce an Express `req.params.X` / `req.query.X` / `req.body.X` value to a
 * trimmed string. Some installed @types/express versions widen
 * `req.params[k]` to `string | string[] | undefined` because they share the
 * qs/ParsedQs index signature with `req.query`. Pass the value through this
 * helper to get a clean, narrowed `string` (empty string if missing/array).
 *
 * Callers should still guard with `if (!s) badRequest(...)` after — the
 * empty-string sentinel keeps existing branch logic intact.
 */
export function asString(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) {
    const first = v[0];
    if (typeof first === 'string') return first.trim();
  }
  return '';
}
