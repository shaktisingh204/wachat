/**
 * Contacts route handlers — invoked by the generated `route.ts` under
 * `withApiV1`. Business logic only; the wrapper handles auth, rate-limit,
 * scope, request-id, and error envelope.
 *
 * Storage: `api_contacts` Mongo collection. Pagination is cursor-based on
 * `_id` (descending). The cursor returned to clients is the hex string of
 * the last `_id` on the page.
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import type { ApiV1Handler } from '@/lib/api-platform';
import { ApiError } from '@/lib/api-platform';
import { connectToDatabase } from '@/lib/mongodb';

const COLLECTION = 'api_contacts';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

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

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/* ── GET /contacts ───────────────────────────────────────────────────────── */

export const listContacts: ApiV1Handler = async (req, { ctx }) => {
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
      throw ApiError.validationFailed([{ path: 'cursor', message: 'Invalid cursor' }]);
    }
    filter._id = { $lt: new ObjectId(cursor) };
  }

  const { db } = await connectToDatabase();
  const col = db.collection<ContactDoc>(COLLECTION);
  const docs = await col
    .find(filter)
    .sort({ _id: -1 })
    .limit(pageSize + 1)
    .toArray();

  const hasMore = docs.length > pageSize;
  const page = hasMore ? docs.slice(0, pageSize) : docs;
  const next_cursor = hasMore ? page[page.length - 1]._id.toHexString() : null;

  return NextResponse.json({ data: page.map(docToJSON), next_cursor });
};

/* ── POST /contacts ──────────────────────────────────────────────────────── */

interface CreateBody {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  tags?: unknown;
}

export const createContact: ApiV1Handler = async (req, { ctx }) => {
  let raw: CreateBody;
  try {
    raw = (await req.json()) as CreateBody;
  } catch {
    throw ApiError.validationFailed([{ path: 'body', message: 'Invalid JSON body' }]);
  }
  if (!raw || typeof raw !== 'object') {
    throw ApiError.validationFailed([{ path: 'body', message: 'Body must be a JSON object' }]);
  }

  const name = pickString(raw.name);
  const email = pickString(raw.email);
  const phone = pickString(raw.phone);
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : undefined;

  if (!name && !email && !phone) {
    throw ApiError.validationFailed([
      { path: 'body', message: 'At least one of name, email or phone is required' },
    ]);
  }

  const { db } = await connectToDatabase();
  const col = db.collection<ContactDoc>(COLLECTION);
  await col.createIndex({ tenantId: 1, _id: -1 }, { background: true });

  const _id = new ObjectId();
  const doc: ContactDoc = {
    _id,
    tenantId: ctx.tenantId,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(tags && tags.length ? { tags } : {}),
    createdAt: new Date(),
  };
  await col.insertOne(doc);

  return NextResponse.json(docToJSON(doc), { status: 201 });
};
