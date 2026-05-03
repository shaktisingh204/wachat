/**
 * POST /api/v1/contacts/[id]/merge — merge two canonical Data Fabric
 * contacts under one id.
 *
 *   Body: { from: string }      // contact id to fold INTO `[id]`
 *   →    { id: string }         // the surviving canonical id
 *
 * Auth: API key first (api-platform from Impl 2 — `contacts:write`
 * scope). When the request lacks an API key we fall back to the
 * dashboard `getSession()` cookie so the operator-tooling UI can call
 * this endpoint directly.
 *
 * The merge is idempotent: re-running with the same body is a no-op.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import {
  consumeToken,
  rateLimitHeaders,
  requireScope,
  verifyApiKey,
} from '@/lib/api-platform';
import { mergeContacts } from '@/lib/data-fabric';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── Auth ────────────────────────────────────────────────────────────────── */

interface AuthOk {
  tenantId: string;
  headers: Record<string, string>;
}

async function authenticate(
  req: NextRequest,
): Promise<AuthOk | NextResponse> {
  // 1. API key path.
  const ctx = await verifyApiKey(req);
  if (ctx) {
    const limit = await consumeToken(ctx.keyId, ctx.tier);
    const headers = rateLimitHeaders(limit);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers },
      );
    }
    if (!requireScope('contacts:write', ctx)) {
      return NextResponse.json(
        { error: 'Missing required scope: contacts:write' },
        { status: 403, headers },
      );
    }
    return { tenantId: ctx.tenantId, headers };
  }

  // 2. Session-cookie fallback (dashboard UI).
  const session = await getSession();
  const userId = (session as { user?: { _id?: unknown } } | null)?.user?._id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { tenantId: String(userId), headers: {} };
}

/* ── Body validation ─────────────────────────────────────────────────────── */

interface MergeBody {
  from?: unknown;
}

function isHexId(v: unknown): v is string {
  return typeof v === 'string' && ObjectId.isValid(v);
}

/* ── Handler ─────────────────────────────────────────────────────────────── */

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, headers } = auth;

  const { id } = await context.params;
  if (!isHexId(id)) {
    return NextResponse.json(
      { error: 'Invalid contact id in path' },
      { status: 400, headers },
    );
  }

  let raw: MergeBody;
  try {
    raw = (await req.json()) as MergeBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers },
    );
  }

  if (!raw || !isHexId(raw.from)) {
    return NextResponse.json(
      { error: 'Body must include `from` (hex contact id)' },
      { status: 400, headers },
    );
  }
  if (raw.from === id) {
    return NextResponse.json(
      { error: '`from` and path id must differ' },
      { status: 400, headers },
    );
  }

  try {
    const canonical = await mergeContacts(tenantId, id, raw.from);
    return NextResponse.json({ id: canonical }, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Merge failed';
    const status = /not found/i.test(message) ? 404 : 500;
    if (status === 500) {
      console.error('[api/v1/contacts/merge] failed', err);
    }
    return NextResponse.json({ error: message }, { status, headers });
  }
}
