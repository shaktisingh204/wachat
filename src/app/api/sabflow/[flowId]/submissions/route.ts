/**
 * GET /api/sabflow/[flowId]/submissions
 *
 * Query params:
 *   page    — 1-based page number (default 1)
 *   limit   — page size (default 20, max 100)
 *   search  — optional string; matched against any variable value (case-insensitive)
 *
 * Returns:
 *   { submissions: Submission[], total: number, page: number, totalPages: number }
 *
 * Auth: session cookie ownership check — the caller must own the flow.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSabFlowCollection } from '@/lib/sabflow/db';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

const SUBMISSIONS_COLLECTION = 'sabflow_submissions';

/* ── ownership guard ──────────────────────────────────────── */

async function assertOwnsFlow(flowId: string): Promise<boolean> {
  const session = await getSession();
  if (!session?.user) return false;
  if (!ObjectId.isValid(flowId)) return false;

  const flows = await getSabFlowCollection();
  const flow = await flows.findOne(
    { _id: new ObjectId(flowId), userId: session.user._id.toString() },
    { projection: { _id: 1 } },
  );
  return flow !== null;
}

/* ── GET ──────────────────────────────────────────────────── */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> },
) {
  const { flowId } = await params;

  const owns = await assertOwnsFlow(flowId);
  if (!owns) {
    return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const search = searchParams.get('search')?.trim() ?? '';

  try {
    const { db } = await connectToDatabase();
    const col = db.collection(SUBMISSIONS_COLLECTION);

    const baseFilter: Record<string, unknown> = { flowId };

    // If a search term is provided, do a regex match against the stringified variables map.
    // We store variables as a nested object, so we use $where or $expr. Using $regex on
    // a stringified projection is not ideal — instead we scan variable values directly.
    // For scalable deployments a text index on variables could replace this.
    const filter: Record<string, unknown> = search
      ? {
          ...baseFilter,
          $or: [
            { sessionId: { $regex: search, $options: 'i' } },
            // Match any string value inside the variables subdocument
            {
              $expr: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: { $objectToArray: { $ifNull: ['$variables', {}] } },
                        as: 'kv',
                        cond: {
                          $regexMatch: {
                            input: { $toString: '$$kv.v' },
                            regex: search,
                            options: 'i',
                          },
                        },
                      },
                    },
                  },
                  0,
                ],
              },
            },
          ],
        }
      : baseFilter;

    const [total, docs] = await Promise.all([
      col.countDocuments(filter),
      col
        .find(filter)
        .sort({ completedAt: -1, startedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    const submissions = docs.map((doc) => ({
      _id: doc._id?.toString() ?? '',
      sessionId: (doc.sessionId as string) ?? '',
      flowId: (doc.flowId as string) ?? flowId,
      variables: (doc.variables as Record<string, unknown>) ?? {},
      completedAt: doc.completedAt instanceof Date
        ? doc.completedAt.toISOString()
        : (doc.completedAt as string | null) ?? null,
      startedAt: doc.startedAt instanceof Date
        ? doc.startedAt.toISOString()
        : (doc.startedAt as string | null) ?? null,
      isComplete: (doc.isComplete as boolean) ?? (doc.completedAt != null),
    }));

    return NextResponse.json({
      submissions,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[SABFLOW SUBMISSIONS] GET error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
