'use server';

/**
 * SabCRM Forms — PUBLIC submit action.
 *
 * Intentionally UNAUTHENTICATED: this is invoked from the public form page
 * (`/embed/sabcrm-form/[publicId]`) which has no session, and from the CORS
 * API route (`/api/sabcrm/forms/submit/[publicId]`) used by external
 * embeds. Tenant resolution happens entirely on the Rust side: the form
 * document carries its `userId` + `projectId`, and the public endpoints
 * (`GET /v1/sabcrm/forms/public/{id}`,
 * `POST /v1/sabcrm/form-submissions/public/{id}`) inherit that tenant —
 * the caller can never choose one. The Rust handler also dispatches the
 * form's webhook with the HMAC-SHA256 `X-Form-Webhook-Signature` header
 * (signed with the stored secret), bumps `submissionCount`, and returns
 * the configured success message / redirect URL, which we echo through.
 *
 * Defense layers here, BEFORE the Rust call:
 *   - honeypot field (`_hp`) — silently accepted when filled;
 *   - naive per-instance rate limit (per public id);
 *   - server-side re-validation of required fields / email shape / select
 *     options against the SANITISED public form definition (the webhook
 *     secret never reaches this layer — Rust strips it).
 */

import { headers } from 'next/headers';

import {
  sabcrmPublicFormsApi,
  type SabcrmFormField,
} from '@/lib/rust-client/sabcrm-forms';

export type SabcrmPublicSubmitResult =
  | { ok: true; message: string; redirectUrl?: string }
  | { ok: false; error: string };

/** Naive in-process rate limiter — best-effort, per server instance. */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

/** Validate one submitted value against its field definition. */
function validateValue(
  field: SabcrmFormField,
  raw: unknown,
): string | null {
  const label = field.label || field.name;
  const value = typeof raw === 'string' ? raw.trim() : raw;
  const empty =
    value === undefined || value === null || value === '';
  if (field.required && empty) return `${label} is required.`;
  if (empty) return null;
  if (typeof value !== 'string') return null;
  if (
    field.type === 'email' &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  ) {
    return `${label} must be a valid email.`;
  }
  if (
    field.type === 'select' &&
    Array.isArray(field.options) &&
    field.options.length > 0 &&
    !field.options.includes(value)
  ) {
    return `${label} has an invalid choice.`;
  }
  return null;
}

/**
 * Submit a public form by its public id (24-char hex `_id` or slug).
 *
 * `data` is the raw field-key → value blob from the rendered form. Only
 * keys that exist on the form's field list are forwarded to the engine —
 * stray keys are dropped so a hostile client can't stuff arbitrary data
 * into the tenant's collection.
 */
export async function submitSabcrmPublicForm(
  publicId: string,
  data: Record<string, unknown>,
  sourceUrl?: string,
): Promise<SabcrmPublicSubmitResult> {
  if (!publicId || typeof publicId !== 'string') {
    return { ok: false, error: 'Invalid form.' };
  }

  // Honeypot: hidden field bots tend to fill. Silently "accept".
  if (typeof data?._hp === 'string' && data._hp.trim() !== '') {
    return { ok: true, message: 'Submission successful.' };
  }

  if (rateLimited(publicId.trim())) {
    return {
      ok: false,
      error: 'Too many submissions. Please try again shortly.',
    };
  }

  // Re-resolve the sanitised public form (no tenant ids, no secrets) and
  // validate the payload against it server-side.
  let form;
  try {
    form = await sabcrmPublicFormsApi.getPublicForm(publicId.trim());
  } catch {
    return { ok: false, error: 'This form no longer exists.' };
  }
  if (form.status && form.status === 'draft') {
    return { ok: false, error: 'This form is not accepting submissions yet.' };
  }

  const fields = Array.isArray(form.fields) ? form.fields : [];
  const clean: Record<string, unknown> = {};
  for (const field of fields) {
    const err = validateValue(field, data?.[field.name]);
    if (err) return { ok: false, error: err };
    const raw = data?.[field.name];
    if (raw === undefined || raw === null || raw === '') continue;
    clean[field.name] =
      typeof raw === 'string' ? raw.trim() : raw;
  }
  if (fields.length === 0) {
    return { ok: false, error: 'This form has no fields.' };
  }

  const h = await headers();
  try {
    const res = await sabcrmPublicFormsApi.submitPublicForm(publicId.trim(), {
      data: clean,
      sourceUrl: sourceUrl?.slice(0, 1000) || undefined,
      userAgent: h.get('user-agent')?.slice(0, 500) || undefined,
      referrer: h.get('referer')?.slice(0, 1000) || undefined,
    });
    if (!res.success) {
      return { ok: false, error: res.message || 'Submission failed.' };
    }
    return {
      ok: true,
      message: res.message || 'Submission successful.',
      redirectUrl: res.redirectUrl,
    };
  } catch (e) {
    console.error('[sabcrm-forms] public submit failed:', e);
    return {
      ok: false,
      error: 'Submission failed. Please try again shortly.',
    };
  }
}
