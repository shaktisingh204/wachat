/**
 * GET /api/sabflow/marketplace/analytics
 *
 * Phase C.10.10 — Marketplace telemetry & analytics.
 *
 * Returns aggregated marketplace analytics for the admin dashboard.
 *
 * Response shape:
 * {
 *   totalTemplates:  number,              — published template count
 *   totalInstalls:   number,              — all-time install event count
 *   topTemplates:    [{ id, name, installs, views }],  — top 10 by installs
 *   last30dInstalls: number,
 *   last30dViews:    number,
 * }
 *
 * RBAC: requires `sabflow:marketplace:review` with action `read`.
 * Mirrors the auth pattern used by the submission review route:
 *   `src/app/api/sabflow/marketplace/submissions/[id]/review/route.ts`
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { canServer } from '@/lib/rbac-server';
import { MARKETPLACE_EVENTS_COLLECTION } from '@/lib/sabflow/marketplace/telemetry';
import { SABFLOW_MARKETPLACE_TEMPLATES_COLLECTION } from '@/lib/sabflow/marketplace/templates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── Analytics types ────────────────────────────────────────────────────── */

interface TopTemplate {
  id: string;
  name: string;
  installs: number;
  views: number;
}

interface AnalyticsResponse {
  totalTemplates: number;
  totalInstalls: number;
  topTemplates: TopTemplate[];
  last30dInstalls: number;
  last30dViews: number;
}

/* ── Auth helper ────────────────────────────────────────────────────────── */

function resolveSession(session: { user: unknown } | null) {
  const u = (session?.user ?? {}) as {
    _id?: string | { toString(): string };
    id?: string;
    activeProjectId?: string;
  };
  const userId =
    (typeof u._id === 'string' ? u._id : u._id?.toString()) ?? u.id ?? '';
  const workspaceId = u.activeProjectId ?? userId;
  return { userId, workspaceId };
}

/* ── GET handler ────────────────────────────────────────────────────────── */

export async function GET(_request: NextRequest) {
  /* ── 1. Auth ─────────────────────────────────────────────────────────── */
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { userId, workspaceId } = resolveSession(session);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  /* ── 2. RBAC: requires sabflow:marketplace:review ────────────────────── */
  const canReview = await canServer('sabflow:marketplace:review', 'view', workspaceId);
  if (!canReview) {
    return NextResponse.json(
      { error: 'Requires sabflow:marketplace:review permission.' },
      { status: 403 },
    );
  }

  try {
    const { db } = await connectToDatabase();
    const eventsCol = db.collection(MARKETPLACE_EVENTS_COLLECTION);
    const templatesCol = db.collection(SABFLOW_MARKETPLACE_TEMPLATES_COLLECTION);

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    /* ── 3. Parallel aggregations ────────────────────────────────────── */
    const [
      totalTemplates,
      totalInstalls,
      last30dInstalls,
      last30dViews,
      topInstallsRaw,
    ] = await Promise.all([
      // Total published templates
      templatesCol.countDocuments({ status: 'published' }),

      // All-time installs (from events collection)
      eventsCol.countDocuments({ type: 'install' }),

      // Last-30d install count
      eventsCol.countDocuments({ type: 'install', ts: { $gte: thirtyDaysAgo } }),

      // Last-30d view count
      eventsCol.countDocuments({ type: 'view', ts: { $gte: thirtyDaysAgo } }),

      // Top 10 templates by install event count, with view count
      eventsCol
        .aggregate<{ _id: string; installs: number; views: number }>([
          { $match: { type: { $in: ['install', 'view'] }, templateId: { $exists: true } } },
          {
            $group: {
              _id: '$templateId',
              installs: {
                $sum: { $cond: [{ $eq: ['$type', 'install'] }, 1, 0] },
              },
              views: {
                $sum: { $cond: [{ $eq: ['$type', 'view'] }, 1, 0] },
              },
            },
          },
          { $sort: { installs: -1 } },
          { $limit: 10 },
        ])
        .toArray(),
    ]);

    /* ── 4. Enrich top templates with names ──────────────────────────── */
    let topTemplates: TopTemplate[] = [];
    if (topInstallsRaw.length > 0) {
      const { ObjectId } = await import('mongodb');
      const ids = topInstallsRaw
        .map((r) => {
          try {
            return new ObjectId(r._id);
          } catch {
            return null;
          }
        })
        .filter((id): id is InstanceType<typeof ObjectId> => id !== null);

      const nameDocs = ids.length > 0
        ? await templatesCol
            .find(
              { _id: { $in: ids } },
              { projection: { _id: 1, name: 1 } },
            )
            .toArray()
        : [];

      const nameMap = new Map<string, string>(
        nameDocs.map((d) => [
          (d._id as { toHexString(): string }).toHexString(),
          (d as unknown as { name: string }).name,
        ]),
      );

      topTemplates = topInstallsRaw.map((r) => ({
        id: r._id,
        name: nameMap.get(r._id) ?? r._id,
        installs: r.installs,
        views: r.views,
      }));
    }

    const response: AnalyticsResponse = {
      totalTemplates,
      totalInstalls,
      topTemplates,
      last30dInstalls,
      last30dViews,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[SABFLOW MARKETPLACE ANALYTICS] GET error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
