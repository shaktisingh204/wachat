import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { withIdempotency } from '@/lib/api-platform/idempotency';
import { isApiError } from '@/lib/api-platform/errors';
import { apiError, readJsonBody, withSabsmsApi } from '@/lib/sabsms/apikeys/http';
import { getSabsmsCollections } from '@/lib/sabsms/db/collections';
import { sabsmsEngine, SabsmsEngineError } from '@/lib/sabsms/engine-client';
import { renderTemplate } from '@/lib/sabsms/render';
import { estimateSegments } from '@/lib/sabsms/segments';
import type { SabsmsMessage, SabsmsMessageStatus } from '@/lib/sabsms/types';

import { resolveMmsMedia, type ResolvedMedia } from './media';
import { projectMessage } from './projection';

/**
 * Public API — `POST /api/v1/sms/messages` (single send) and
 * `GET /api/v1/sms/messages` (workspace-scoped list).
 *
 * The send path deliberately duplicates ONLY the thin glue from the
 * composer's `sendSmsAction` (template render → `sabsmsEngine.enqueueSend`)
 * instead of importing it: `src/app/sabsms/send/actions.ts` is owned by
 * the V2.11 workstream and is session-authenticated — these routes are
 * API-key-only.
 *
 * Idempotency: an `Idempotency-Key` header makes the POST replayable for
 * 24h via the platform Redis cache (same key + same body → cached
 * response; same key + different body → 409).
 */

const CATEGORY = z.enum(['transactional', 'otp', 'marketing', 'alert', 'service']);

const SEND_BODY = z
  .object({
    to: z.string().min(4).max(32),
    body: z.string().max(4096).optional(),
    from: z.string().max(32).optional(),
    category: CATEGORY.optional(),
    templateId: z.string().regex(/^[0-9a-f]{24}$/i, 'templateId must be a 24-hex id').optional(),
    vars: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    /**
     * SabFiles ids ONLY — every file in SabNode lives in SabFiles.
     * Raw URLs are rejected (see the explicit guard below).
     */
    mediaSabFileIds: z
      .array(z.string().regex(/^[0-9a-f]{24}$/i, 'each media id must be a SabFiles 24-hex id'))
      .max(10)
      .optional(),
  })
  .strict();

export const POST = withSabsmsApi('messages:send', async (req: NextRequest, { auth }) => {
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.res;

  // SabFiles policy: refuse raw media URLs loudly, before zod's generic
  // unknown-key error, so integrators get an actionable message.
  if (parsed.body && typeof parsed.body === 'object') {
    const raw = parsed.body as Record<string, unknown>;
    if ('mediaUrls' in raw || 'media_urls' in raw || 'media' in raw) {
      return apiError(
        'validation_failed',
        'Raw media URLs are not accepted. Upload files to SabFiles and pass their ids in mediaSabFileIds.',
        422,
      );
    }
  }

  const body = SEND_BODY.safeParse(parsed.body);
  if (!body.success) {
    const first = body.error.issues[0];
    return apiError(
      'validation_failed',
      `${first?.path?.join('.') || 'body'}: ${first?.message ?? 'invalid'}`,
      422,
    );
  }
  const input = body.data;

  const idempotencyKey = req.headers.get('idempotency-key')?.trim() || null;

  try {
    const out = await withIdempotency(auth.workspaceId, idempotencyKey, parsed.body, async () => {
      const result = await sendOnce(auth.workspaceId, input);
      return result;
    });
    return new NextResponse(out.body, {
      status: out.status,
      headers: { 'content-type': 'application/json', ...out.headers },
    });
  } catch (err) {
    if (isApiError(err) && err.type === 'idempotency_conflict') {
      return apiError('idempotency_conflict', err.detail ?? err.title, 409);
    }
    // Transient engine failures are thrown (not returned) by sendOnce so
    // the idempotency cache never pins a 5xx for 24h — the caller can
    // safely retry with the SAME Idempotency-Key.
    if (err instanceof EngineUnavailableError) {
      return apiError('engine_unavailable', err.message, 502);
    }
    throw err;
  }
});

/** Marker for "do not cache this outcome" engine failures. */
class EngineUnavailableError extends Error {}

async function sendOnce(
  workspaceId: string,
  input: z.infer<typeof SEND_BODY>,
): Promise<{ status: number; headers?: Record<string, string>; body: unknown }> {
  // Render: stored template wins over the free-form body (the template is
  // the compliance-reviewed source of truth — same rule as the composer).
  let text = input.body ?? '';
  if (input.templateId) {
    const { cols } = await getSabsmsCollections();
    const doc = await cols.templates.findOne({
      _id: new ObjectId(input.templateId),
      workspaceId,
    });
    if (!doc) {
      return { status: 404, body: { error: { code: 'not_found', message: 'Template not found' } } };
    }
    const rawBody =
      doc.bodies?.find((b) => b.locale === 'en')?.body ?? doc.bodies?.[0]?.body ?? '';
    const rendered = renderTemplate(rawBody, input.vars ?? {});
    if (rendered.missing.length > 0) {
      return {
        status: 422,
        body: {
          error: {
            code: 'validation_failed',
            message: `Missing template variables: ${rendered.missing.join(', ')}`,
          },
        },
      };
    }
    text = rendered.text;
  } else if (input.vars && Object.keys(input.vars).length > 0) {
    const rendered = renderTemplate(text, input.vars);
    if (rendered.missing.length > 0) {
      return {
        status: 422,
        body: {
          error: {
            code: 'validation_failed',
            message: `Missing variables: ${rendered.missing.join(', ')}`,
          },
        },
      };
    }
    text = rendered.text;
  }

  // Resolve MMS media (if any) BEFORE the empty-body check — an MMS may
  // carry media with no text body. The resolver loads the SabFiles docs
  // workspace-scoped, 404s on missing/foreign ids, and produces the
  // provider-fetchable `mediaUrls` the engine worker actually sends.
  const mediaIds = input.mediaSabFileIds ?? [];
  let resolved: ResolvedMedia | null = null;
  if (mediaIds.length > 0) {
    const outcome = await resolveMmsMedia(workspaceId, mediaIds);
    if (!outcome.ok) {
      return {
        status: outcome.status,
        body: { error: { code: outcome.code, message: outcome.message } },
      };
    }
    resolved = outcome.resolved;
  }
  const hasMedia = !!resolved && resolved.mediaUrls.length > 0;

  if (!text.trim() && !hasMedia) {
    return {
      status: 422,
      body: { error: { code: 'validation_failed', message: 'body, templateId or mediaSabFileIds is required' } },
    };
  }

  const category = input.category ?? 'transactional';
  try {
    const res = await sabsmsEngine.enqueueSend({
      workspaceId,
      to: input.to,
      body: text,
      category,
      // Media present → MMS so the worker attaches mediaUrls + the rate
      // card bills at the MMS multiplier (mirrors the rates table).
      channel: hasMedia ? 'mms' : undefined,
      from: input.from || undefined,
      templateId: input.templateId,
      media: resolved ? resolved.media : undefined,
      mediaUrls: resolved ? resolved.mediaUrls : undefined,
      eventKey: 'sabsms.api.messages',
    });
    return {
      status: 201,
      body: {
        id: res.id,
        to: input.to,
        from: input.from ?? null,
        body: text,
        category,
        channel: hasMedia ? 'mms' : 'sms',
        media: resolved
          ? resolved.media.map((m) => ({ sabFileId: m.sabFileId, mime: m.mime, bytes: m.bytes }))
          : [],
        status: res.status,
        segments: res.segments ?? estimateSegments(text),
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return engineErrorBody(err);
  }
}

function engineErrorBody(err: unknown): { status: number; body: unknown } {
  if (err instanceof SabsmsEngineError) {
    if (err.status < 400 || err.status >= 500) {
      // Transient/unreachable engine: throw past the idempotency cache.
      throw new EngineUnavailableError(err.message);
    }
    const engineCode =
      err.body && typeof err.body === 'object' && typeof (err.body as { error?: unknown }).error === 'string'
        ? String((err.body as { error: string }).error)
        : 'send_rejected';
    return { status: err.status, body: { error: { code: engineCode, message: err.message } } };
  }
  throw err;
}

const LIST_QUERY = z.object({
  status: z
    .enum(['queued', 'sending', 'sent', 'delivered', 'failed', 'undelivered', 'rejected', 'suppressed'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = withSabsmsApi('messages:read', async (req: NextRequest, { auth }) => {
  const url = new URL(req.url);
  const query = LIST_QUERY.safeParse({
    status: url.searchParams.get('status') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!query.success) {
    const first = query.error.issues[0];
    return apiError(
      'validation_failed',
      `${first?.path?.join('.') || 'query'}: ${first?.message ?? 'invalid'}`,
      422,
    );
  }

  const { cols } = await getSabsmsCollections();
  const filter: Record<string, unknown> = { workspaceId: auth.workspaceId };
  if (query.data.status) filter.status = query.data.status as SabsmsMessageStatus;

  const docs = (await cols.messages
    .find(filter as never)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.data.limit)
    .toArray()) as SabsmsMessage[];

  return NextResponse.json({ data: docs.map(projectMessage) });
});
