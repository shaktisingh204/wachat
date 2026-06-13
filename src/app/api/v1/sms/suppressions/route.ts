import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { hashPhone } from '@/app/sabsms/suppressions/lib';
import { apiError, readJsonBody, withSabsmsApi } from '@/lib/sabsms/apikeys/http';
import { getSabsmsCollections } from '@/lib/sabsms/db/collections';
import type { SabsmsSuppression } from '@/lib/sabsms/types';

/**
 * Public API — `GET /api/v1/sms/suppressions` (list) and
 * `POST /api/v1/sms/suppressions` (suppress a phone).
 *
 * Raw phone numbers are never stored — only their sha-256 hash (same
 * `hashPhone` the dashboard uses, so both surfaces hit the same docs).
 */

function projectSuppression(doc: SabsmsSuppression) {
  return {
    phoneHash: doc.phoneHash,
    source: doc.source,
    reason: doc.reason ?? null,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
    expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
  };
}

export const GET = withSabsmsApi('messages:read', async (req: NextRequest, { auth }) => {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get('limit') ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 500) : 100;

  const { cols } = await getSabsmsCollections();
  const docs = await cols.suppressions
    .find({ workspaceId: auth.workspaceId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return NextResponse.json({ data: docs.map(projectSuppression) });
});

const ADD_BODY = z
  .object({
    phone: z.string().min(4).max(32),
    reason: z.string().max(500).optional(),
  })
  .strict();

export const POST = withSabsmsApi('messages:send', async (req: NextRequest, { auth }) => {
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.res;

  const body = ADD_BODY.safeParse(parsed.body);
  if (!body.success) {
    const first = body.error.issues[0];
    return apiError(
      'validation_failed',
      `${first?.path?.join('.') || 'body'}: ${first?.message ?? 'invalid'}`,
      422,
    );
  }

  const phoneHash = hashPhone(body.data.phone);
  const now = new Date();
  const { cols } = await getSabsmsCollections();
  await cols.suppressions.updateOne(
    { workspaceId: auth.workspaceId, phoneHash },
    {
      $setOnInsert: {
        workspaceId: auth.workspaceId,
        phoneHash,
        source: 'manual',
        createdAt: now,
      },
      $set: { reason: body.data.reason ?? 'API suppression' },
    },
    { upsert: true },
  );

  const doc = await cols.suppressions.findOne({ workspaceId: auth.workspaceId, phoneHash });
  return NextResponse.json(doc ? projectSuppression(doc) : { phoneHash, source: 'manual' }, {
    status: 201,
  });
});
