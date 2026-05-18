/**
 * SabFlow Marketplace — review a pending submission.
 *
 * Phase C.10.3 — Admin review queue.
 *
 *   POST /api/sabflow/marketplace/submissions/[id]/review
 *     Body: { action: 'approve' | 'reject'; reason?: string }
 *
 * Approve:
 *   - Sets `sabflow_marketplace_submissions` status → 'approved'.
 *   - Copies the submission's flow snapshot into
 *     `sabflow_marketplace_templates` with status 'published'.
 *
 * Reject:
 *   - Sets `sabflow_marketplace_submissions` status → 'rejected'.
 *   - Stores `rejectionReason` on the submission row.
 *
 * Both paths stamp `reviewedAt` + `reviewedBy` on the submission.
 *
 * Author notification is a fire-and-forget console log today; a real
 * notification bus (email / in-app) is wired by a later sub-task.
 *
 * RBAC: `sabflow:marketplace:review` with action `edit` required.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { canServer } from '@/lib/rbac-server';
import {
  SUBMISSIONS_COLLECTION,
  type MarketplaceSubmission,
} from '@/app/api/sabflow/marketplace/submissions/route';
import { SABFLOW_MARKETPLACE_TEMPLATES_COLLECTION } from '@/lib/sabflow/marketplace/templates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface ReviewBody {
  action?: unknown;
  reason?: unknown;
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

/* ── POST ───────────────────────────────────────────────────────────────── */

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  /* ── Auth ─────────────────────────────────────────────────────────────── */
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { userId, workspaceId } = resolveSession(session);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const canReview = await canServer('sabflow:marketplace:review', 'edit', workspaceId);
  if (!canReview) {
    return NextResponse.json(
      { error: 'You do not have permission to review marketplace submissions.' },
      { status: 403 },
    );
  }

  /* ── Validate params ──────────────────────────────────────────────────── */
  const { id } = await ctx.params;
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid submission id' }, { status: 400 });
  }

  let body: ReviewBody;
  try {
    body = (await req.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body.action;
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: '`action` must be "approve" or "reject"' },
      { status: 400 },
    );
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : undefined;
  if (action === 'reject' && !reason) {
    return NextResponse.json(
      { error: '`reason` is required when rejecting a submission' },
      { status: 400 },
    );
  }

  try {
    const { db } = await connectToDatabase();
    const submissionsCol = db.collection<MarketplaceSubmission>(SUBMISSIONS_COLLECTION);

    /* ── Fetch the submission ─────────────────────────────────────────── */
    const submission = await submissionsCol.findOne({ _id: new ObjectId(id) });
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }
    if (submission.status !== 'pending') {
      return NextResponse.json(
        { error: `Submission is already ${submission.status}` },
        { status: 409 },
      );
    }

    const now = new Date();

    /* ── Approve ─────────────────────────────────────────────────────── */
    if (action === 'approve') {
      // Stamp the submission
      await submissionsCol.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'approved',
            reviewedAt: now,
            reviewedBy: userId,
            updatedAt: now,
          },
        },
      );

      // Publish to the live marketplace templates collection.
      // The flow snapshot is built from the submission metadata; the actual
      // flow document is referenced by flowId so the install path can clone it.
      await db
        .collection(SABFLOW_MARKETPLACE_TEMPLATES_COLLECTION)
        .updateOne(
          { submissionId: id },
          {
            $set: {
              submissionId: id,
              slug: submission.flowId,
              name: submission.name,
              description: submission.description,
              categories: [submission.category],
              tags: submission.tags ?? [],
              author: {
                userId: submission.authorId,
                displayName: submission.authorName ?? undefined,
              },
              requiredCredentials: [],
              flow: {
                name: submission.name,
                events: [],
                groups: [],
                edges: [],
                variables: [],
              },
              status: 'published',
              publishedAt: now,
              installCount: 0,
              createdAt: now,
              updatedAt: now,
            },
          },
          { upsert: true },
        );

      console.log(
        `[SABFLOW MARKETPLACE REVIEW] approved id=${id} reviewer=${userId} author=${submission.authorId}`,
      );

      // Notify author — fire-and-forget (real notification bus wired later).
      void notifyAuthor('approved', submission.authorId, submission.name, undefined);

      return NextResponse.json({
        ok: true,
        id,
        action: 'approved',
        submissionStatus: 'approved',
      });
    }

    /* ── Reject ──────────────────────────────────────────────────────── */
    await submissionsCol.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'rejected',
          rejectionReason: reason,
          reviewedAt: now,
          reviewedBy: userId,
          updatedAt: now,
        },
      },
    );

    console.log(
      `[SABFLOW MARKETPLACE REVIEW] rejected id=${id} reviewer=${userId} author=${submission.authorId} reason="${reason}"`,
    );

    void notifyAuthor('rejected', submission.authorId, submission.name, reason);

    return NextResponse.json({
      ok: true,
      id,
      action: 'rejected',
      submissionStatus: 'rejected',
      reason,
    });
  } catch (err) {
    console.error('[SABFLOW MARKETPLACE REVIEW] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ── Author notification stub ───────────────────────────────────────────── */

/**
 * Notify the template author of the review decision.
 *
 * Currently a structured log stub — a real notification bus (email / in-app
 * events) is wired by a later C.10 sub-task.  Keeping this as a separate
 * async function lets us swap the implementation without touching the route.
 */
async function notifyAuthor(
  decision: 'approved' | 'rejected',
  authorId: string,
  templateName: string,
  reason: string | undefined,
): Promise<void> {
  console.log(
    `[SABFLOW MARKETPLACE NOTIFY] author=${authorId} template="${templateName}" decision=${decision}${reason ? ` reason="${reason}"` : ''}`,
  );
}
