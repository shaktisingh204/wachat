/**
 * /api/partners/roadmap
 *
 *   GET   — public roadmap items, sorted by votes (top first).
 *           Optional ?status=<RoadmapStatus> filter and ?category= filter.
 *
 *   POST  — cast a vote on an item. Requires an authenticated session
 *           (cookie). Body: { itemId: string }. Vote weight is derived from
 *           the caller's plan tier (see `voteWeightForPlan`). One vote per
 *           tenant per item.
 *
 * Mongo collections:
 *   - roadmap_items
 *   - roadmap_votes
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import {
  castVote,
  sortByVotes,
  voteWeightForPlan,
  type RoadmapPlanTier,
} from '@/lib/partners/roadmap';
import type { RoadmapItem, RoadmapStatus, RoadmapVote } from '@/lib/partners/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_STATUSES: RoadmapStatus[] = [
  'submitted',
  'planned',
  'in_progress',
  'shipped',
  'declined',
];

// ── GET — public list ────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const search = new URL(request.url).searchParams;
  const statusParam = search.get('status');
  const category = search.get('category')?.trim();

  try {
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = {};
    if (statusParam && VALID_STATUSES.includes(statusParam as RoadmapStatus)) {
      filter.status = statusParam;
    }
    if (category) filter.category = category;
    const items = (await db
      .collection('roadmap_items')
      .find(filter)
      .toArray()) as unknown as RoadmapItem[];
    const sorted = sortByVotes(items).map(toPublicRoadmap);
    return NextResponse.json({ success: true, items: sorted, total: sorted.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load roadmap.';
    console.error('[api/partners/roadmap] GET failed', { error: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── POST — cast a vote ───────────────────────────────────────────────────────

interface VoteBody {
  itemId?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: VoteBody;
  try {
    body = (await request.json()) as VoteBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.itemId || typeof body.itemId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'itemId is required.' },
      { status: 400 },
    );
  }

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const userId = String(session.user._id);
  const tenantId = inferTenantId(session);
  const plan = inferPlanTier(session);

  try {
    const { db } = await connectToDatabase();
    const items = db.collection('roadmap_items');
    const votes = db.collection('roadmap_votes');

    const item = (await items.findOne({ itemId: body.itemId })) as unknown as RoadmapItem | null;
    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Roadmap item not found.' },
        { status: 404 },
      );
    }

    const existing = (await votes
      .find({ itemId: body.itemId, tenantId })
      .toArray()) as unknown as RoadmapVote[];

    const result = castVote({ item, tenantId, userId, plan, existingVotes: existing });

    if (!result.applied) {
      return NextResponse.json({
        success: true,
        applied: false,
        item: toPublicRoadmap(result.item),
      });
    }

    if (result.vote) {
      await votes.insertOne(result.vote as unknown as Record<string, unknown>);
    }
    await items.updateOne(
      { itemId: item.itemId },
      {
        $set: {
          votes: result.item.votes,
          voterCount: result.item.voterCount,
          updatedAt: result.item.updatedAt,
        },
      },
    );

    return NextResponse.json({
      success: true,
      applied: true,
      item: toPublicRoadmap(result.item),
      weight: voteWeightForPlan(plan),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cast vote.';
    console.error('[api/partners/roadmap] POST failed', { error: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toPublicRoadmap(item: RoadmapItem): Omit<RoadmapItem, 'submittedByTenantId'> {
  // Strip submitter tenant id from public payload to avoid leaking customer identity.
  const { submittedByTenantId: _omit, ...publicFields } = item;
  void _omit;
  return publicFields;
}

interface SessionLike {
  user?: { _id: unknown; activeProjectId?: unknown };
  plan?: { name?: unknown } | null;
  activeProject?: { _id?: unknown } | null;
}

function inferTenantId(session: SessionLike): string {
  // Tenants in SabNode are scoped to a project; fall back to the user id when
  // no project is active (e.g. an admin without a workspace selection).
  const project = session.activeProject?._id ?? session.user?.activeProjectId;
  if (project) return String(project);
  return String(session.user?._id);
}

function inferPlanTier(session: SessionLike): RoadmapPlanTier {
  const name = String(session.plan?.name ?? '').toLowerCase();
  if (name.includes('enterprise')) return 'enterprise';
  if (name.includes('scale') || name.includes('business')) return 'scale';
  if (name.includes('pro') || name.includes('growth')) return 'pro';
  return 'free';
}
