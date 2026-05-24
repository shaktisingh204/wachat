'use server';

/**
 * Tenant-scoped status / lifecycle mutations for HR pillar detail pages
 * — flow-style actions (timesheets, travel, expense claims, probation,
 * onboarding, jobs, offers, asset assignments, awards, disciplinary).
 *
 * The other half lives in `hr-status.actions.ts` (exits, succession,
 * comp bands, announcements, policies, assets, documents, document
 * templates). Both files share the `mutate` helper from
 * `@/lib/hr-status`.
 *
 * Tenant isolation: every write filters by `userId == session.user._id`.
 * Audit logging is best-effort via `writeAuditEntry` — failures there
 * never unwind the primary mutation.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';
import { mutate, type HrActionResult } from '@/lib/hr-status';

/* ─── Timesheets ────────────────────────────────────────────────────── */

export async function submitTimesheet(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'timesheet',
    id,
    patch: { status: 'submitted', submittedAt: new Date() },
    action: 'status_change',
    reason: 'Submitted',
  });
}

export async function approveTimesheet(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'timesheet',
    id,
    patch: { status: 'approved', approvedAt: new Date() },
    action: 'status_change',
    reason: 'Approved',
  });
}

export async function rejectTimesheet(
  id: string,
  reason: string,
): Promise<HrActionResult> {
  return mutate({
    pillar: 'timesheet',
    id,
    patch: {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectionReason: reason || undefined,
    },
    action: 'status_change',
    reason: reason ? `Rejected: ${reason}` : 'Rejected',
  });
}

/* ─── Travel ────────────────────────────────────────────────────────── */

export async function approveTravelRequest(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'travel',
    id,
    patch: { status: 'approved', approvedAt: new Date() },
    action: 'status_change',
    reason: 'Approved',
  });
}

export async function rejectTravelRequest(
  id: string,
  reason: string,
): Promise<HrActionResult> {
  return mutate({
    pillar: 'travel',
    id,
    patch: {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectionReason: reason || undefined,
    },
    action: 'status_change',
    reason: reason ? `Rejected: ${reason}` : 'Rejected',
  });
}

export async function markTravelComplete(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'travel',
    id,
    patch: { status: 'completed', completedAt: new Date() },
    action: 'status_change',
    reason: 'Completed',
  });
}

/* ─── Expense claims ────────────────────────────────────────────────── */

export async function approveExpenseClaim(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'expenseClaim',
    id,
    patch: { status: 'approved', approvedAt: new Date() },
    action: 'status_change',
    reason: 'Approved',
  });
}

export async function rejectExpenseClaim(
  id: string,
  reason: string,
): Promise<HrActionResult> {
  return mutate({
    pillar: 'expenseClaim',
    id,
    patch: {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectionReason: reason || undefined,
    },
    action: 'status_change',
    reason: reason ? `Rejected: ${reason}` : 'Rejected',
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
  return mutate({
    pillar: 'expenseClaim',
    id,
    patch,
    action: 'pay',
    reason: typeof amount === 'number' ? `Reimbursed ${amount}` : 'Reimbursed',
  });
}

/* ─── Probation ─────────────────────────────────────────────────────── */

export async function confirmProbation(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'probation',
    id,
    patch: { status: 'confirmed', confirmedAt: new Date() },
    action: 'status_change',
    reason: 'Confirmed',
  });
}

export async function extendProbation(
  id: string,
  newEndDate: string,
): Promise<HrActionResult> {
  if (!newEndDate) return { error: 'New end date is required.' };
  const d = new Date(newEndDate);
  if (Number.isNaN(d.getTime())) return { error: 'Invalid date.' };

  return mutate({
    pillar: 'probation',
    id,
    patch: {
      status: 'extended',
      extendedEndDate: d,
      extension_date: new Date(),
    },
    action: 'update',
    reason: `Extended until ${newEndDate}`,
  });
}

export async function terminateProbation(
  id: string,
  reason: string,
): Promise<HrActionResult> {
  return mutate({
    pillar: 'probation',
    id,
    patch: {
      status: 'terminated',
      terminationReason: reason || undefined,
      terminatedAt: new Date(),
    },
    action: 'status_change',
    reason: reason ? `Terminated: ${reason}` : 'Terminated',
  });
}

/* ─── Onboarding ────────────────────────────────────────────────────── */

export async function markOnboardingComplete(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'onboarding',
    id,
    patch: { status: 'completed', completedAt: new Date() },
    action: 'status_change',
    reason: 'Completed',
  });
}

export async function sendOnboardingWelcomeKit(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'onboarding',
    id,
    patch: { welcomeKitSentAt: new Date() },
    action: 'send',
    reason: 'Welcome kit sent',
  });
}

/* ─── Jobs ──────────────────────────────────────────────────────────── */

export async function publishJobPosting(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'job',
    id,
    patch: { status: 'published', publishedAt: new Date() },
    action: 'status_change',
    reason: 'Published',
  });
}

export async function pauseJobPosting(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'job',
    id,
    patch: { status: 'paused', pausedAt: new Date() },
    action: 'status_change',
    reason: 'Paused',
  });
}

export async function closeJobPosting(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'job',
    id,
    patch: { status: 'closed', closedAt: new Date() },
    action: 'status_change',
    reason: 'Closed',
  });
}

/* ─── Offers ────────────────────────────────────────────────────────── */

export async function sendOfferLetter(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'offer',
    id,
    patch: { status: 'sent', sentAt: new Date() },
    action: 'send',
    reason: 'Sent',
  });
}

export async function withdrawOfferLetter(
  id: string,
  reason: string,
): Promise<HrActionResult> {
  return mutate({
    pillar: 'offer',
    id,
    patch: {
      status: 'withdrawn',
      withdrawnAt: new Date(),
      withdrawnReason: reason || undefined,
    },
    action: 'status_change',
    reason: reason ? `Withdrawn: ${reason}` : 'Withdrawn',
  });
}

export async function markOfferAccepted(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'offer',
    id,
    patch: { status: 'accepted', respondedAt: new Date(), acceptedAt: new Date() },
    action: 'status_change',
    reason: 'Accepted',
  });
}

/* ─── Asset assignments ─────────────────────────────────────────────── */

export async function returnAssetAssignment(
  id: string,
  condition: string,
): Promise<HrActionResult> {
  const patch: Record<string, unknown> = {
    status: 'returned',
    returnedAt: new Date(),
  };
  if (condition) patch.returnCondition = condition;

  return mutate({
    pillar: 'assetAssignment',
    id,
    patch,
    action: 'status_change',
    reason: condition ? `Returned (${condition})` : 'Returned',
  });
}

/* ─── Award programs ────────────────────────────────────────────────── */

export async function recordAwardVote(
  programId: string,
  nomineeRef: string,
  reason?: string,
): Promise<HrActionResult> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  if (!programId || !ObjectId.isValid(programId)) return { error: 'Invalid id.' };
  if (!nomineeRef) return { error: 'Nominee is required.' };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    // Mongo's typings reject `Record<string, unknown>` on $push for an
    // untyped collection. Cast through `unknown` keeps the call site
    // schema-free.
    const res = await db.collection('crm_award_programs').updateOne(
      { _id: new ObjectId(programId), userId: userObjectId },
      {
        $push: {
          nominations: {
            nominatorId: userObjectId,
            nomineeName: nomineeRef,
            reason: reason || undefined,
            submittedAt: new Date(),
          },
        },
        $set: { updatedAt: new Date() },
      } as unknown as Parameters<
        ReturnType<typeof db.collection>['updateOne']
      >[1],
    );
    if (res.matchedCount === 0) return { error: 'Not found.' };

    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'update',
      entityKind: 'award',
      entityId: programId,
      reason: `Nomination for ${nomineeRef}`,
    });

    revalidatePath('/dashboard/hrm/hr/awards');
    revalidatePath(`/dashboard/hrm/hr/awards/${programId}`);
    return { message: 'Nomination recorded.' };
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
        },
        $set: { status: 'closed', updatedAt: new Date() },
      } as unknown as Parameters<
        ReturnType<typeof db.collection>['updateOne']
      >[1],
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

/* ─── Disciplinary cases ────────────────────────────────────────────── */

export async function closeDisciplinaryCase(
  caseId: string,
  decision: string,
): Promise<HrActionResult> {
  return mutate({
    pillar: 'disciplinary',
    id: caseId,
    patch: {
      status: 'resolved',
      resolvedAt: new Date(),
      decision: decision || undefined,
    },
    action: 'status_change',
    reason: decision ? `Resolved: ${decision}` : 'Resolved',
  });
}

export async function escalateDisciplinaryCase(caseId: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'disciplinary',
    id: caseId,
    patch: { status: 'under_review', escalatedAt: new Date() },
    action: 'status_change',
    reason: 'Escalated',
  });
}

export async function appealDisciplinaryCase(
  caseId: string,
  reason: string,
): Promise<HrActionResult> {
  return mutate({
    pillar: 'disciplinary',
    id: caseId,
    patch: {
      status: 'appealed',
      appealedAt: new Date(),
      appealReason: reason || undefined,
    },
    action: 'status_change',
    reason: reason ? `Appealed: ${reason}` : 'Appealed',
  });
}

export async function sendAwardCashToPayroll(programId: string): Promise<HrActionResult> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  if (!programId || !ObjectId.isValid(programId)) return { error: 'Invalid id.' };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    const res = await db.collection('crm_award_programs').updateOne(
      { _id: new ObjectId(programId), userId: userObjectId },
      {
        $set: { payrollStatus: 'processed', updatedAt: new Date() },
      } as unknown as Parameters<
        ReturnType<typeof db.collection>['updateOne']
      >[1],
    );
    if (res.matchedCount === 0) return { error: 'Not found.' };

    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'status_change',
      entityKind: 'award',
      entityId: programId,
      reason: 'Cash reward sent to payroll',
    });

    revalidatePath('/dashboard/hrm/hr/awards');
    revalidatePath(`/dashboard/hrm/hr/awards/${programId}`);
    return { message: 'Cash reward sent to payroll.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[sendAwardCashToPayroll]', e);
    return { error: msg };
  }
}
