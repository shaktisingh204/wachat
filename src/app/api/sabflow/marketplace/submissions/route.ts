/**
 * SabFlow Marketplace Submissions — list + submit endpoint.
 *
 * Phase C.10.3 — Admin review queue.
 *
 *   GET  /api/sabflow/marketplace/submissions?status=pending&page=1&limit=20
 *     → { submissions: SubmissionRow[]; total: number; page: number; totalPages: number }
 *     Admin only — requires `sabflow:marketplace:review` permission.
 *
 *   POST /api/sabflow/marketplace/submissions
 *     Body: { flowId: string; name: string; description: string; category: string; tags?: string[] }
 *     → { id: string; status: 'pending' }
 *     Authenticated user with `sabflow:marketplace:submit` permission.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { canServer } from '@/lib/rbac-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── Constants ─────────────────────────────────────────────────────────── */

export const SUBMISSIONS_COLLECTION = 'sabflow_marketplace_submissions';
const PAGE_SIZE = 20;

/* ── Types ─────────────────────────────────────────────────────────────── */

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface MarketplaceSubmission {
  _id?: ObjectId;
  flowId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  authorId: string;
  authorName?: string;
  status: SubmissionStatus;
  rejectionReason?: string;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  updatedAt: Date;
}

/* ── Auth helpers ───────────────────────────────────────────────────────── */

function resolveSession(session: { user: unknown } | null) {
  const u = (session?.user ?? {}) as {
    _id?: string | { toString(): string };
    id?: string;
    name?: string;
    activeProjectId?: string;
  };
  const userId =
    (typeof u._id === 'string' ? u._id : u._id?.toString()) ?? u.id ?? '';
  const workspaceId = u.activeProjectId ?? userId;
  return { userId, workspaceId, name: u.name };
}

/* ── GET — list submissions (admin only) ───────────────────────────────── */

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { workspaceId } = resolveSession(session);

  const canReview = await canServer('sabflow:marketplace:review', 'view', workspaceId);
  if (!canReview) {
    return NextResponse.json(
      { error: 'You do not have permission to review marketplace submissions.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as SubmissionStatus | null;
  const pageRaw = Number(searchParams.get('page') ?? '1');
  const page = Number.isFinite(pageRaw) ? Math.max(pageRaw, 1) : 1;
  const limit = PAGE_SIZE;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    filter.status = status;
  }

  try {
    const { db } = await connectToDatabase();
    const col = db.collection<MarketplaceSubmission>(SUBMISSIONS_COLLECTION);

    const [docs, total] = await Promise.all([
      col.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    return NextResponse.json({
      submissions: docs.map((d) => ({ ...d, _id: d._id?.toHexString() })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[SABFLOW MARKETPLACE SUBMISSIONS] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ── POST — submit a template for review ───────────────────────────────── */

interface SubmitBody {
  flowId?: unknown;
  name?: unknown;
  description?: unknown;
  category?: unknown;
  tags?: unknown;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { userId, workspaceId, name: authorName } = resolveSession(session);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const canSubmit = await canServer('sabflow:marketplace:submit', 'edit', workspaceId);
  if (!canSubmit) {
    return NextResponse.json(
      { error: 'You do not have permission to submit marketplace templates.' },
      { status: 403 },
    );
  }

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const flowId = typeof body.flowId === 'string' ? body.flowId.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === 'string')
    : [];

  if (!flowId) {
    return NextResponse.json({ error: '`flowId` is required' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: '`name` is required' }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: '`description` is required' }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ error: '`category` is required' }, { status: 400 });
  }

  const now = new Date();
  const doc: MarketplaceSubmission = {
    flowId,
    name,
    description,
    category,
    tags,
    authorId: userId,
    ...(authorName ? { authorName } : {}),
    status: 'pending',
    submittedAt: now,
    updatedAt: now,
  };

  try {
    const { db } = await connectToDatabase();
    const result = await db
      .collection<MarketplaceSubmission>(SUBMISSIONS_COLLECTION)
      .insertOne(doc);

    console.log(
      `[SABFLOW MARKETPLACE] submission created id=${result.insertedId.toHexString()} user=${userId} flow=${flowId}`,
    );

    return NextResponse.json(
      { id: result.insertedId.toHexString(), status: 'pending' },
      { status: 201 },
    );
  } catch (err) {
    console.error('[SABFLOW MARKETPLACE SUBMISSIONS] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
