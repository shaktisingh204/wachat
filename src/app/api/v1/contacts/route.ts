/**
 * /api/v1/contacts — public versioned contacts endpoint.
 *
 *   GET  /api/v1/contacts?cursor=<id>&limit=<n>
 *     → { data: Contact[], next_cursor: string | null }
 *
 *   POST /api/v1/contacts
 *     Body: { name?, email?, phone?, tags? }
 *     → 201 Contact
 *
 * Auth: API key.  Required scopes:
 *   GET  → contacts:read
 *   POST → contacts:write
 *
 * Pagination uses an opaque cursor which is the hex string of the
 * Mongo `_id` of the last item from the previous page; we fetch
 * `{ _id: { $lt: cursor } }` sorted by `_id` desc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import {
  consumeToken,
  rateLimitHeaders,
  requireScope,
  verifyApiKey,
  type ApiAuthContext,
} from '@/lib/api-platform';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COLLECTION = 'api_contacts';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/* ── Shared helpers ──────────────────────────────────────────────────────── */

interface ContactDoc {
  _id: ObjectId;
  tenantId: string;
  name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  createdAt: Date;
}

interface ContactJSON {
  id: string;
  tenantId: string;
  name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  createdAt: string;
}

function docToJSON(doc: ContactDoc): ContactJSON {
  return {
    id: doc._id.toHexString(),
    tenantId: doc.tenantId,
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    tags: doc.tags,
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date().toISOString(),
  };
}

/**
 * Run the standard guard chain: verify API key, apply rate limit, then
 * check that `scope` is granted.  Returns either the auth context + the
 * rate-limit headers to attach, or a NextResponse representing the
 * failure to short-circuit on.
 */
async function guard(
  req: NextRequest,
  scope: 'contacts:read' | 'contacts:write',
): Promise<
  | { ctx: ApiAuthContext; headers: Record<string, string> }
  | { response: NextResponse }
> {
  const ctx = await verifyApiKey(req);
  if (!ctx) {
    return {
      response: NextResponse.json(
        { error: 'Missing or invalid API key' },
        { status: 401 },
      ),
    };
  }

  const limit = await consumeToken(ctx.keyId, ctx.tier);
  const headers = rateLimitHeaders(limit);
  if (!limit.allowed) {
    return {
      response: NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers },
      ),
    };
  }

  if (!requireScope(scope, ctx)) {
    return {
      response: NextResponse.json(
        { error: `Missing required scope: ${scope}` },
        { status: 403, headers },
      ),
    };
  }

  return { ctx, headers };
}

/* ── GET ─────────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest): Promise<NextResponse> {
  const g = await guard(req, 'contacts:read');
  if ('response' in g) return g.response;
  const { ctx, headers } = g;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  const rawLimit = Number(searchParams.get('limit') ?? DEFAULT_LIMIT);
  const pageSize = Math.max(
    1,
    Math.min(MAX_LIMIT, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : DEFAULT_LIMIT),
  );

  const filter: Record<string, unknown> = { tenantId: ctx.tenantId };
  if (cursor) {
    if (!ObjectId.isValid(cursor)) {
      return NextResponse.json(
        { error: 'Invalid cursor' },
        { status: 400, headers },
      );
    }
    filter._id = { $lt: new ObjectId(cursor) };
  }

  try {
    const { db } = await connectToDatabase();
    const col = db.collection<ContactDoc>(COLLECTION);
    // We fetch one extra row so we know whether there's another page.
    const docs = await col
      .find(filter)
      .sort({ _id: -1 })
      .limit(pageSize + 1)
      .toArray();

    const hasMore = docs.length > pageSize;
    const page = hasMore ? docs.slice(0, pageSize) : docs;
    const next_cursor = hasMore ? page[page.length - 1]._id.toHexString() : null;

    return NextResponse.json(
      { data: page.map(docToJSON), next_cursor },
      { headers },
    );
  } catch (err) {
    console.error('[api/v1/contacts] GET failed', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers },
    );
  }
}

/* ── POST ────────────────────────────────────────────────────────────────── */

interface CreateBody {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  tags?: unknown;
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const g = await guard(req, 'contacts:write');
  if ('response' in g) return g.response;
  const { ctx, headers } = g;

  let raw: CreateBody;
  try {
    raw = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers },
    );
  }

  if (!raw || typeof raw !== 'object') {
    return NextResponse.json(
      { error: 'Body must be a JSON object' },
      { status: 400, headers },
    );
  }

  const name = pickString(raw.name);
  const email = pickString(raw.email);
  const phone = pickString(raw.phone);
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : undefined;

  if (!name && !email && !phone) {
    return NextResponse.json(
      { error: 'At least one of name, email or phone is required' },
      { status: 400, headers },
    );
  }

  try {
    const { db } = await connectToDatabase();
    const col = db.collection<ContactDoc>(COLLECTION);
    await col.createIndex({ tenantId: 1, _id: -1 }, { background: true });

    const now = new Date();
    const _id = new ObjectId();
    const doc: ContactDoc = {
      _id,
      tenantId: ctx.tenantId,
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(tags && tags.length ? { tags } : {}),
      createdAt: now,
    };
    await col.insertOne(doc);

    return NextResponse.json(docToJSON(doc), { status: 201, headers });
  } catch (err) {
    console.error('[api/v1/contacts] POST failed', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers },
    );
  }
}
