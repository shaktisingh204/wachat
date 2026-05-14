'use server';

/**
 * Tenant-scoped status / lifecycle mutations for HR pillar detail pages.
 *
 * Every HR detail page (per §1D.2 of the CRM rebuild contract) has a
 * header action group with buttons like "Approve", "Reject", "Mark
 * complete" etc. The shared CRUD helpers in `hr.actions.ts` only cover
 * full-record save + delete — they don't expose targeted status
 * mutations. Rather than scatter a dozen near-identical actions across
 * pillar-specific files, every status mutation funnels through the
 * generic `setHrEntityStatus` helper below and the thin per-entity
 * wrappers compose on top.
 *
 * Tenant isolation: every write filters by `userId == session.user._id`.
 * Audit logging is best-effort via `writeAuditEntry` — failures there
 * never unwind the primary mutation (see `src/lib/audit-log.ts`).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';

export type HrActionResult = { message?: string; error?: string };

interface StatusMutationOpts {
  collection: string;
  id: string;
  /** Mongo `$set` patch (timestamps / status fields applied to the doc). */
  patch: Record<string, unknown>;
  entityKind: string;
  action: string;
  reason?: string;
  /** Path(s) to revalidate after a successful write. */
  revalidate: string | string[];
}

/**
 * Single tenant-scoped status mutation. Loaded via `getSession`, writes
 * `patch` plus an `updatedAt` timestamp, fires an audit entry, and
 * revalidates the supplied surfaces.
 */
async function setHrEntityStatus(opts: StatusMutationOpts): Promise<HrActionResult> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  if (!opts.id || !ObjectId.isValid(opts.id)) return { error: 'Invalid id.' };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    const res = await db.collection(opts.collection).updateOne(
      { _id: new ObjectId(opts.id), userId: userObjectId },
      { $set: { ...opts.patch, updatedAt: new Date() } },
    );
    if (res.matchedCount === 0) {
      return { error: 'Not found.' };
    }

    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: opts.action,
      entityKind: opts.entityKind,
      entityId: opts.id,
      reason: opts.reason,
    });

    const paths = Array.isArray(opts.revalidate) ? opts.revalidate : [opts.revalidate];
    for (const p of paths) revalidatePath(p);

    return { message: 'Saved.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[setHrEntityStatus]', e);
    return { error: msg };
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Exits — confirm KT, mark NOC, mark cleared
 * ══════════════════════════════════════════════════════════════════ */

export async function confirmExitKt(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_exits',
    id,
    patch: { knowledgeTransfer: 'complete', knowledgeTransferStatus: 'complete' },
    entityKind: 'exit',
    action: 'status_change',
    reason: 'KT confirmed',
    revalidate: [
      '/dashboard/hrm/hr/exits',
      `/dashboard/hrm/hr/exits/${id}`,
    ],
  });
}

export async function markExitNoc(
  id: string,
  nocStatus: 'issued' | 'na' = 'issued',
): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_exits',
    id,
    patch: { nocStatus },
    entityKind: 'exit',
    action: 'status_change',
    reason: `NOC ${nocStatus}`,
    revalidate: [
      '/dashboard/hrm/hr/exits',
      `/dashboard/hrm/hr/exits/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Succession — mark reviewed
 * ══════════════════════════════════════════════════════════════════ */

export async function markSuccessionReviewed(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_succession_plans',
    id,
    patch: { lastReviewedAt: new Date(), status: 'reviewed' },
    entityKind: 'succession',
    action: 'status_change',
    reason: 'Plan reviewed',
    revalidate: [
      '/dashboard/hrm/hr/succession',
      `/dashboard/hrm/hr/succession/${id}`,
    ],
  });
}

export async function promoteSuccessor(
  id: string,
  successorRef: string,
): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_succession_plans',
    id,
    patch: {
      promotedSuccessor: successorRef,
      promotedAt: new Date(),
      status: 'promoted',
    },
    entityKind: 'succession',
    action: 'status_change',
    reason: `Promoted successor ${successorRef}`,
    revalidate: [
      '/dashboard/hrm/hr/succession',
      `/dashboard/hrm/hr/succession/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Compensation bands — duplicate / archive
 * ══════════════════════════════════════════════════════════════════ */

export async function archiveCompensationBand(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_compensation_bands',
    id,
    patch: { isActive: false, archivedAt: new Date() },
    entityKind: 'compensation_band',
    action: 'archive',
    revalidate: [
      '/dashboard/hrm/hr/compensation-bands',
      `/dashboard/hrm/hr/compensation-bands/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Announcements — pin / send / archive
 * ══════════════════════════════════════════════════════════════════ */

export async function toggleAnnouncementPin(
  id: string,
  pinned: boolean,
): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_announcements',
    id,
    patch: { pinned },
    entityKind: 'announcement',
    action: 'status_change',
    reason: pinned ? 'Pinned' : 'Unpinned',
    revalidate: [
      '/dashboard/hrm/hr/announcements',
      `/dashboard/hrm/hr/announcements/${id}`,
    ],
  });
}

export async function sendAnnouncementNow(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_announcements',
    id,
    patch: { sentAt: new Date(), status: 'sent', publishAt: new Date() },
    entityKind: 'announcement',
    action: 'send',
    revalidate: [
      '/dashboard/hrm/hr/announcements',
      `/dashboard/hrm/hr/announcements/${id}`,
    ],
  });
}

export async function archiveAnnouncement(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_announcements',
    id,
    patch: { archived: true, archivedAt: new Date() },
    entityKind: 'announcement',
    action: 'archive',
    revalidate: [
      '/dashboard/hrm/hr/announcements',
      `/dashboard/hrm/hr/announcements/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Policies — publish / archive
 * ══════════════════════════════════════════════════════════════════ */

export async function publishPolicy(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_policies',
    id,
    patch: { status: 'active', publishedAt: new Date() },
    entityKind: 'policy',
    action: 'status_change',
    reason: 'Published',
    revalidate: [
      '/dashboard/hrm/hr/policies',
      `/dashboard/hrm/hr/policies/${id}`,
    ],
  });
}

export async function archivePolicy(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_policies',
    id,
    patch: { status: 'archived', archivedAt: new Date() },
    entityKind: 'policy',
    action: 'archive',
    revalidate: [
      '/dashboard/hrm/hr/policies',
      `/dashboard/hrm/hr/policies/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Assets — mark returned / retire
 * ══════════════════════════════════════════════════════════════════ */

export async function markAssetReturned(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_assets',
    id,
    patch: { assignedTo: null, custodian: null, returnedAt: new Date() },
    entityKind: 'asset',
    action: 'status_change',
    reason: 'Asset returned',
    revalidate: [
      '/dashboard/hrm/hr/assets',
      `/dashboard/hrm/hr/assets/${id}`,
    ],
  });
}

export async function retireAsset(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_assets',
    id,
    patch: { condition: 'retired', retiredAt: new Date(), archived: true },
    entityKind: 'asset',
    action: 'archive',
    reason: 'Retired',
    revalidate: [
      '/dashboard/hrm/hr/assets',
      `/dashboard/hrm/hr/assets/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Documents — mark verified / renew
 * ══════════════════════════════════════════════════════════════════ */

export async function markDocumentVerified(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_documents',
    id,
    patch: { verified: true, isVerified: true, verifiedAt: new Date() },
    entityKind: 'document',
    action: 'status_change',
    reason: 'Verified',
    revalidate: [
      '/dashboard/hrm/hr/documents',
      `/dashboard/hrm/hr/documents/${id}`,
    ],
  });
}

export async function renewDocument(
  id: string,
  newExpiry: string,
): Promise<HrActionResult> {
  if (!newExpiry) return { error: 'New expiry date is required.' };
  const d = new Date(newExpiry);
  if (Number.isNaN(d.getTime())) return { error: 'Invalid date.' };

  return setHrEntityStatus({
    collection: 'hr_documents',
    id,
    patch: { expiresAt: d, renewedAt: new Date() },
    entityKind: 'document',
    action: 'update',
    reason: `Renewed until ${newExpiry}`,
    revalidate: [
      '/dashboard/hrm/hr/documents',
      `/dashboard/hrm/hr/documents/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Document templates — duplicate / archive
 * ══════════════════════════════════════════════════════════════════ */

export async function archiveDocumentTemplate(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_document_templates',
    id,
    patch: { archived: true, archivedAt: new Date() },
    entityKind: 'document_template',
    action: 'archive',
    revalidate: [
      '/dashboard/hrm/hr/document-templates',
      `/dashboard/hrm/hr/document-templates/${id}`,
    ],
  });
}

export async function duplicateDocumentTemplate(id: string): Promise<HrActionResult> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  if (!id || !ObjectId.isValid(id)) return { error: 'Invalid id.' };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    const original = await db.collection('hr_document_templates').findOne({
      _id: new ObjectId(id),
      userId: userObjectId,
    });
    if (!original) return { error: 'Template not found.' };

    const { _id, ...rest } = original as Record<string, unknown> & { _id: unknown };
    const now = new Date();
    const copy = {
      ...rest,
      name: `${rest.name ?? 'Template'} (copy)`,
      userId: userObjectId,
      createdAt: now,
      updatedAt: now,
    };
    const inserted = await db.collection('hr_document_templates').insertOne(copy);

    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'create',
      entityKind: 'document_template',
      entityId: String(inserted.insertedId),
      reason: `Duplicate of ${id}`,
    });

    revalidatePath('/dashboard/hrm/hr/document-templates');
    void _id;
    return { message: 'Template duplicated.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[duplicateDocumentTemplate]', e);
    return { error: msg };
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Timesheets — submit / approve / reject
 * ══════════════════════════════════════════════════════════════════ */

export async function submitTimesheet(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_timesheets',
    id,
    patch: { status: 'submitted', submittedAt: new Date() },
    entityKind: 'timesheet',
    action: 'status_change',
    reason: 'Submitted',
    revalidate: [
      '/dashboard/hrm/hr/timesheets',
      `/dashboard/hrm/hr/timesheets/${id}`,
    ],
  });
}

export async function approveTimesheet(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_timesheets',
    id,
    patch: { status: 'approved', approvedAt: new Date() },
    entityKind: 'timesheet',
    action: 'status_change',
    reason: 'Approved',
    revalidate: [
      '/dashboard/hrm/hr/timesheets',
      `/dashboard/hrm/hr/timesheets/${id}`,
    ],
  });
}

export async function rejectTimesheet(
  id: string,
  reason: string,
): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_timesheets',
    id,
    patch: {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectionReason: reason || undefined,
    },
    entityKind: 'timesheet',
    action: 'status_change',
    reason: reason ? `Rejected: ${reason}` : 'Rejected',
    revalidate: [
      '/dashboard/hrm/hr/timesheets',
      `/dashboard/hrm/hr/timesheets/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Travel — approve / reject / mark complete
 * ══════════════════════════════════════════════════════════════════ */

export async function approveTravelRequest(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_travel_requests',
    id,
    patch: { status: 'approved', approvedAt: new Date() },
    entityKind: 'travel',
    action: 'status_change',
    reason: 'Approved',
    revalidate: [
      '/dashboard/hrm/hr/travel',
      `/dashboard/hrm/hr/travel/${id}`,
    ],
  });
}

export async function rejectTravelRequest(
  id: string,
  reason: string,
): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_travel_requests',
    id,
    patch: {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectionReason: reason || undefined,
    },
    entityKind: 'travel',
    action: 'status_change',
    reason: reason ? `Rejected: ${reason}` : 'Rejected',
    revalidate: [
      '/dashboard/hrm/hr/travel',
      `/dashboard/hrm/hr/travel/${id}`,
    ],
  });
}

export async function markTravelComplete(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_travel_requests',
    id,
    patch: { status: 'completed', completedAt: new Date() },
    entityKind: 'travel',
    action: 'status_change',
    reason: 'Completed',
    revalidate: [
      '/dashboard/hrm/hr/travel',
      `/dashboard/hrm/hr/travel/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Expense claims — approve / reject / reimburse
 * ══════════════════════════════════════════════════════════════════ */

export async function approveExpenseClaim(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_expense_claims',
    id,
    patch: { status: 'approved', approvedAt: new Date() },
    entityKind: 'expense_claim',
    action: 'status_change',
    reason: 'Approved',
    revalidate: [
      '/dashboard/hrm/hr/expense-claims',
      `/dashboard/hrm/hr/expense-claims/${id}`,
    ],
  });
}

export async function rejectExpenseClaim(
  id: string,
  reason: string,
): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_expense_claims',
    id,
    patch: {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectionReason: reason || undefined,
    },
    entityKind: 'expense_claim',
    action: 'status_change',
    reason: reason ? `Rejected: ${reason}` : 'Rejected',
    revalidate: [
      '/dashboard/hrm/hr/expense-claims',
      `/dashboard/hrm/hr/expense-claims/${id}`,
    ],
  });
}

export async function markExpenseClaimReimbursed(
  id: string,
  amount?: number,
): Promise<HrActionResult> {
  const patch: Record<string, unknown> = {
    status: 'reimbursed',
    reimbursed: true,
    reimbursedAt: new Date(),
  };
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    patch.reimbursedAmount = amount;
  }
  return setHrEntityStatus({
    collection: 'hr_expense_claims',
    id,
    patch,
    entityKind: 'expense_claim',
    action: 'pay',
    reason: typeof amount === 'number' ? `Reimbursed ${amount}` : 'Reimbursed',
    revalidate: [
      '/dashboard/hrm/hr/expense-claims',
      `/dashboard/hrm/hr/expense-claims/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Probation — confirm / extend / terminate
 * ══════════════════════════════════════════════════════════════════ */

export async function confirmProbation(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_probations',
    id,
    patch: { status: 'confirmed', confirmedAt: new Date() },
    entityKind: 'probation',
    action: 'status_change',
    reason: 'Confirmed',
    revalidate: [
      '/dashboard/hrm/hr/probation',
      `/dashboard/hrm/hr/probation/${id}`,
    ],
  });
}

export async function extendProbation(
  id: string,
  newEndDate: string,
): Promise<HrActionResult> {
  if (!newEndDate) return { error: 'New end date is required.' };
  const d = new Date(newEndDate);
  if (Number.isNaN(d.getTime())) return { error: 'Invalid date.' };

  return setHrEntityStatus({
    collection: 'hr_probations',
    id,
    patch: {
      status: 'extended',
      extendedEndDate: d,
      extension_date: new Date(),
    },
    entityKind: 'probation',
    action: 'update',
    reason: `Extended until ${newEndDate}`,
    revalidate: [
      '/dashboard/hrm/hr/probation',
      `/dashboard/hrm/hr/probation/${id}`,
    ],
  });
}

export async function terminateProbation(
  id: string,
  reason: string,
): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_probations',
    id,
    patch: {
      status: 'terminated',
      terminationReason: reason || undefined,
      terminatedAt: new Date(),
    },
    entityKind: 'probation',
    action: 'status_change',
    reason: reason ? `Terminated: ${reason}` : 'Terminated',
    revalidate: [
      '/dashboard/hrm/hr/probation',
      `/dashboard/hrm/hr/probation/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Onboarding — mark complete / send welcome kit
 * ══════════════════════════════════════════════════════════════════ */

export async function markOnboardingComplete(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_onboarding_templates',
    id,
    patch: { status: 'completed', completedAt: new Date() },
    entityKind: 'onboarding',
    action: 'status_change',
    reason: 'Completed',
    revalidate: [
      '/dashboard/hrm/hr/onboarding',
      `/dashboard/hrm/hr/onboarding/${id}`,
    ],
  });
}

export async function sendOnboardingWelcomeKit(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_onboarding_templates',
    id,
    patch: { welcomeKitSentAt: new Date() },
    entityKind: 'onboarding',
    action: 'send',
    reason: 'Welcome kit sent',
    revalidate: [
      '/dashboard/hrm/hr/onboarding',
      `/dashboard/hrm/hr/onboarding/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Jobs — publish / pause / close
 * ══════════════════════════════════════════════════════════════════ */

export async function publishJobPosting(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_job_postings',
    id,
    patch: { status: 'published', publishedAt: new Date() },
    entityKind: 'job',
    action: 'status_change',
    reason: 'Published',
    revalidate: [
      '/dashboard/hrm/hr/jobs',
      `/dashboard/hrm/hr/jobs/${id}`,
    ],
  });
}

export async function pauseJobPosting(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_job_postings',
    id,
    patch: { status: 'paused', pausedAt: new Date() },
    entityKind: 'job',
    action: 'status_change',
    reason: 'Paused',
    revalidate: [
      '/dashboard/hrm/hr/jobs',
      `/dashboard/hrm/hr/jobs/${id}`,
    ],
  });
}

export async function closeJobPosting(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_job_postings',
    id,
    patch: { status: 'closed', closedAt: new Date() },
    entityKind: 'job',
    action: 'status_change',
    reason: 'Closed',
    revalidate: [
      '/dashboard/hrm/hr/jobs',
      `/dashboard/hrm/hr/jobs/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Offers — send / withdraw / mark accepted
 * ══════════════════════════════════════════════════════════════════ */

export async function sendOfferLetter(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_offer_letters',
    id,
    patch: { status: 'sent', sentAt: new Date() },
    entityKind: 'offer',
    action: 'send',
    reason: 'Sent',
    revalidate: [
      '/dashboard/hrm/hr/offers',
      `/dashboard/hrm/hr/offers/${id}`,
    ],
  });
}

export async function withdrawOfferLetter(
  id: string,
  reason: string,
): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_offer_letters',
    id,
    patch: {
      status: 'withdrawn',
      withdrawnAt: new Date(),
      withdrawnReason: reason || undefined,
    },
    entityKind: 'offer',
    action: 'status_change',
    reason: reason ? `Withdrawn: ${reason}` : 'Withdrawn',
    revalidate: [
      '/dashboard/hrm/hr/offers',
      `/dashboard/hrm/hr/offers/${id}`,
    ],
  });
}

export async function markOfferAccepted(id: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'hr_offer_letters',
    id,
    patch: { status: 'accepted', respondedAt: new Date(), acceptedAt: new Date() },
    entityKind: 'offer',
    action: 'status_change',
    reason: 'Accepted',
    revalidate: [
      '/dashboard/hrm/hr/offers',
      `/dashboard/hrm/hr/offers/${id}`,
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Asset Assignments — return / set condition
 * ══════════════════════════════════════════════════════════════════ */

export async function returnAssetAssignment(
  id: string,
  condition: string,
): Promise<HrActionResult> {
  const patch: Record<string, unknown> = {
    status: 'returned',
    returnedAt: new Date(),
  };
  if (condition) patch.returnCondition = condition;

  return setHrEntityStatus({
    collection: 'hr_asset_assignments',
    id,
    patch,
    entityKind: 'asset_assignment',
    action: 'status_change',
    reason: condition ? `Returned (${condition})` : 'Returned',
    revalidate: [
      '/dashboard/hrm/hr/asset-assignments',
    ],
  });
}

/* ═══════════════════════════════════════════════════════════════════
 *  Award programs — record vote / declare winner
 * ══════════════════════════════════════════════════════════════════ */

export async function recordAwardVote(
  programId: string,
  nomineeRef: string,
): Promise<HrActionResult> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  if (!programId || !ObjectId.isValid(programId)) return { error: 'Invalid id.' };
  if (!nomineeRef) return { error: 'Nominee is required.' };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    const res = await db.collection('crm_award_programs').updateOne(
      { _id: new ObjectId(programId), userId: userObjectId },
      {
        $push: {
          // Cast required because Mongo driver typings do not infer
          // dynamic array shapes on untyped collections.
          votes: {
            voterId: userObjectId,
            nomineeRef,
            votedAt: new Date(),
          },
        } as Record<string, unknown>,
        $set: { updatedAt: new Date() },
      },
    );
    if (res.matchedCount === 0) return { error: 'Not found.' };

    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'update',
      entityKind: 'award',
      entityId: programId,
      reason: `Vote for ${nomineeRef}`,
    });

    revalidatePath('/dashboard/hrm/hr/awards');
    revalidatePath(`/dashboard/hrm/hr/awards/${programId}`);
    return { message: 'Vote recorded.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[recordAwardVote]', e);
    return { error: msg };
  }
}

export async function declareAwardWinner(
  programId: string,
  winnerRef: string,
  citation?: string,
): Promise<HrActionResult> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  if (!programId || !ObjectId.isValid(programId)) return { error: 'Invalid id.' };
  if (!winnerRef) return { error: 'Winner is required.' };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    const res = await db.collection('crm_award_programs').updateOne(
      { _id: new ObjectId(programId), userId: userObjectId },
      {
        $push: {
          winners: {
            employeeId: winnerRef,
            citation: citation || undefined,
            awardedAt: new Date(),
          },
        } as Record<string, unknown>,
        $set: { status: 'closed', updatedAt: new Date() },
      },
    );
    if (res.matchedCount === 0) return { error: 'Not found.' };

    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'status_change',
      entityKind: 'award',
      entityId: programId,
      reason: `Winner declared: ${winnerRef}`,
    });

    revalidatePath('/dashboard/hrm/hr/awards');
    revalidatePath(`/dashboard/hrm/hr/awards/${programId}`);
    return { message: 'Winner declared.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[declareAwardWinner]', e);
    return { error: msg };
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Disciplinary cases — close / escalate / appeal
 * ══════════════════════════════════════════════════════════════════ */

export async function closeDisciplinaryCase(
  caseId: string,
  decision: string,
): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'crm_disciplinary_cases',
    id: caseId,
    patch: {
      status: 'resolved',
      resolvedAt: new Date(),
      decision: decision || undefined,
    },
    entityKind: 'disciplinary',
    action: 'status_change',
    reason: decision ? `Resolved: ${decision}` : 'Resolved',
    revalidate: [
      '/dashboard/hrm/hr/disciplinary',
      `/dashboard/hrm/hr/disciplinary/${caseId}`,
    ],
  });
}

export async function escalateDisciplinaryCase(caseId: string): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'crm_disciplinary_cases',
    id: caseId,
    patch: { status: 'under_review', escalatedAt: new Date() },
    entityKind: 'disciplinary',
    action: 'status_change',
    reason: 'Escalated',
    revalidate: [
      '/dashboard/hrm/hr/disciplinary',
      `/dashboard/hrm/hr/disciplinary/${caseId}`,
    ],
  });
}

export async function appealDisciplinaryCase(
  caseId: string,
  reason: string,
): Promise<HrActionResult> {
  return setHrEntityStatus({
    collection: 'crm_disciplinary_cases',
    id: caseId,
    patch: {
      status: 'appealed',
      appealedAt: new Date(),
      appealReason: reason || undefined,
    },
    entityKind: 'disciplinary',
    action: 'status_change',
    reason: reason ? `Appealed: ${reason}` : 'Appealed',
    revalidate: [
      '/dashboard/hrm/hr/disciplinary',
      `/dashboard/hrm/hr/disciplinary/${caseId}`,
    ],
  });
}
