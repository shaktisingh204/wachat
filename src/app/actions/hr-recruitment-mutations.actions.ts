'use server';

/**
 * HR recruitment mutators — P1.1B Wave 6 (§1D.2).
 *
 * Wave-6 spec calls out three single-field mutators that drive the
 * recruitment detail-page action buttons:
 *
 *   • moveCandidateStage(id, stage)       — pipeline stage change
 *   • setInterviewStatus(id, status)      — Scheduled / Completed /
 *                                            Cancelled / No-show
 *   • setOfferStatus(id, status)          — Sent / Accepted / Declined /
 *                                            Withdrawn etc.
 *
 * All three return the standard `HrActionResult` shape used by
 * `<HrActionButtons />` so the detail-page wires cleanly. They also
 * revalidate the relevant list/detail paths so the new state is
 * reflected immediately.
 *
 * Tenant isolation: every write is scoped to the authenticated user via
 * `requireSession()` — `updateOne` filter always includes `userId` so
 * cross-tenant writes are impossible.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { requireSession } from '@/lib/hr-crud';

export type HrActionResult = { message?: string; error?: string };

const CANDIDATE_STAGES = [
  'applied',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

const INTERVIEW_STATUSES = [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

const OFFER_STATUSES = [
  'draft',
  'sent',
  'pending',
  'accepted',
  'rejected',
  'declined',
  'expired',
  'withdrawn',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

async function mutateOne(
  collection: string,
  id: string,
  patch: Record<string, unknown>,
  revalidate: string[],
): Promise<HrActionResult> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection(collection).updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(user._id) },
      {
        $set: {
          ...patch,
          updatedAt: new Date(),
        },
      },
    );
    if (!res.matchedCount) return { error: 'Not found' };
    for (const p of revalidate) revalidatePath(p);
    return { message: 'Updated.' };
  } catch (e: any) {
    return { error: e?.message || 'Failed to update' };
  }
}

export async function moveCandidateStage(
  id: string,
  stage: CandidateStage,
): Promise<HrActionResult> {
  if (!CANDIDATE_STAGES.includes(stage)) {
    return { error: `Invalid stage: ${stage}` };
  }
  const patch: Record<string, unknown> = { stage };
  if (stage === 'hired') patch.hiredAt = new Date();
  if (stage === 'rejected') patch.rejectedAt = new Date();
  return mutateOne(
    'hr_candidates',
    id,
    patch,
    [
      '/dashboard/hrm/hr/candidates',
      `/dashboard/hrm/hr/candidates/${id}`,
    ],
  );
}

export async function setInterviewStatus(
  id: string,
  status: InterviewStatus,
): Promise<HrActionResult> {
  if (!INTERVIEW_STATUSES.includes(status)) {
    return { error: `Invalid status: ${status}` };
  }
  return mutateOne(
    'hr_interviews',
    id,
    { status },
    [
      '/dashboard/hrm/hr/interviews',
      `/dashboard/hrm/hr/interviews/${id}`,
    ],
  );
}

export async function setOfferStatus(
  id: string,
  status: OfferStatus,
): Promise<HrActionResult> {
  if (!OFFER_STATUSES.includes(status)) {
    return { error: `Invalid status: ${status}` };
  }
  const patch: Record<string, unknown> = { status };
  if (status === 'sent') patch.sentAt = new Date();
  if (
    status === 'accepted' ||
    status === 'rejected' ||
    status === 'declined' ||
    status === 'withdrawn'
  ) {
    patch.respondedAt = new Date();
  }
  return mutateOne(
    'hr_offer_letters',
    id,
    patch,
    [
      '/dashboard/hrm/hr/offers',
      `/dashboard/hrm/hr/offers/${id}`,
    ],
  );
}

/**
 * Convenience helper for the candidate detail "Hire" / "Reject" /
 * "Archive" buttons — small wrappers around moveCandidateStage that
 * accept no stage argument from the caller (so they can be dropped
 * into <HrActionButtons /> with zero coupling).
 */
export async function hireCandidate(id: string): Promise<HrActionResult> {
  return moveCandidateStage(id, 'hired');
}
export async function rejectCandidate(id: string): Promise<HrActionResult> {
  return moveCandidateStage(id, 'rejected');
}
export async function archiveCandidate(id: string): Promise<HrActionResult> {
  return moveCandidateStage(id, 'withdrawn');
}

import { writeAuditEntry } from '@/lib/audit-log';

export async function addCandidateNote(id: string, note: string): Promise<HrActionResult> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { error: 'Invalid id' };

  try {
    const { db } = await connectToDatabase();
    
    // Check if candidate exists and maybe append the note to candidate's notes?
    // Wait, let's just log it in the audit stream as a "note" action since the plan says "tie it directly into the audit stream".
    const res = await db.collection('hr_candidates').updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(user._id) },
      {
        $set: { updatedAt: new Date() },
      },
    );
    if (!res.matchedCount) return { error: 'Not found' };

    await writeAuditEntry({
      tenantUserId: String(user._id),
      actorId: String(user._id),
      action: 'note',
      entityKind: 'candidate',
      entityId: id,
      reason: note,
    });

    revalidatePath(`/dashboard/hrm/hr/candidates/${id}`);
    revalidatePath('/dashboard/hrm/hr/candidates');
    return { message: 'Note added' };
  } catch (e: any) {
    return { error: e?.message || 'Failed to add note' };
  }
}
