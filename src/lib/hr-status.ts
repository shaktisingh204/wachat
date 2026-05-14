/**
 * Shared internals for HR pillar status mutations
 * (`src/app/actions/hr-status*.actions.ts`).
 *
 * Lives in `src/lib/` (not under `app/actions`) so it can be imported
 * by multiple `'use server'` action modules without each re-declaring
 * the same `mutate` helper. The exported `HrActionResult` shape is the
 * uniform return contract every wired action surfaces back to the
 * `<HrActionButtons />` client island.
 */

import 'server-only';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';

export type HrActionResult = { message?: string; error?: string };

/**
 * Map a logical pillar → its Mongo collection + detail-page URL prefix.
 * Adding a new pillar is a single-row change; per-pillar wrappers stay
 * as one-liners on top of `mutate`.
 */
export const HR_PILLAR: Record<
  string,
  { collection: string; routePrefix: string; entityKind: string }
> = {
  exit: { collection: 'hr_exits', routePrefix: '/dashboard/hrm/hr/exits', entityKind: 'exit' },
  succession: {
    collection: 'hr_succession_plans',
    routePrefix: '/dashboard/hrm/hr/succession',
    entityKind: 'succession',
  },
  compensationBand: {
    collection: 'hr_compensation_bands',
    routePrefix: '/dashboard/hrm/hr/compensation-bands',
    entityKind: 'compensation_band',
  },
  announcement: {
    collection: 'hr_announcements',
    routePrefix: '/dashboard/hrm/hr/announcements',
    entityKind: 'announcement',
  },
  policy: {
    collection: 'hr_policies',
    routePrefix: '/dashboard/hrm/hr/policies',
    entityKind: 'policy',
  },
  asset: {
    collection: 'hr_assets',
    routePrefix: '/dashboard/hrm/hr/assets',
    entityKind: 'asset',
  },
  assetAssignment: {
    collection: 'hr_asset_assignments',
    routePrefix: '/dashboard/hrm/hr/asset-assignments',
    entityKind: 'asset_assignment',
  },
  document: {
    collection: 'hr_documents',
    routePrefix: '/dashboard/hrm/hr/documents',
    entityKind: 'document',
  },
  documentTemplate: {
    collection: 'hr_document_templates',
    routePrefix: '/dashboard/hrm/hr/document-templates',
    entityKind: 'document_template',
  },
  timesheet: {
    collection: 'hr_timesheets',
    routePrefix: '/dashboard/hrm/hr/timesheets',
    entityKind: 'timesheet',
  },
  travel: {
    collection: 'hr_travel_requests',
    routePrefix: '/dashboard/hrm/hr/travel',
    entityKind: 'travel',
  },
  expenseClaim: {
    collection: 'hr_expense_claims',
    routePrefix: '/dashboard/hrm/hr/expense-claims',
    entityKind: 'expense_claim',
  },
  probation: {
    collection: 'hr_probations',
    routePrefix: '/dashboard/hrm/hr/probation',
    entityKind: 'probation',
  },
  onboarding: {
    collection: 'hr_onboarding_templates',
    routePrefix: '/dashboard/hrm/hr/onboarding',
    entityKind: 'onboarding',
  },
  job: {
    collection: 'hr_job_postings',
    routePrefix: '/dashboard/hrm/hr/jobs',
    entityKind: 'jobPosting',
  },
  offer: {
    collection: 'hr_offer_letters',
    routePrefix: '/dashboard/hrm/hr/offers',
    entityKind: 'offerLetter',
  },
  award: {
    collection: 'crm_award_programs',
    routePrefix: '/dashboard/hrm/hr/awards',
    entityKind: 'award',
  },
  disciplinary: {
    collection: 'crm_disciplinary_cases',
    routePrefix: '/dashboard/hrm/hr/disciplinary',
    entityKind: 'disciplinary',
  },
};

export type HrPillar = keyof typeof HR_PILLAR;

export interface MutateArgs {
  pillar: HrPillar;
  id: string;
  /** Mongo `$set` patch (timestamps / status fields applied to the doc). */
  patch: Record<string, unknown>;
  /** Audit-log action verb (e.g. `'status_change'`, `'archive'`). */
  action: string;
  /** Optional one-line reason recorded with the audit row. */
  reason?: string;
}

/**
 * Single tenant-scoped status mutation. Loaded via `getSession`, writes
 * `patch` plus an `updatedAt` timestamp, fires an audit entry, and
 * revalidates the list view + the detail page.
 */
export async function mutate({
  pillar,
  id,
  patch,
  action,
  reason,
}: MutateArgs): Promise<HrActionResult> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  if (!id || !ObjectId.isValid(id)) return { error: 'Invalid id.' };

  const cfg = HR_PILLAR[pillar];
  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    const res = await db.collection(cfg.collection).updateOne(
      { _id: new ObjectId(id), userId: userObjectId },
      { $set: { ...patch, updatedAt: new Date() } },
    );
    if (res.matchedCount === 0) return { error: 'Not found.' };

    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action,
      entityKind: cfg.entityKind,
      entityId: id,
      reason,
    });

    revalidatePath(cfg.routePrefix);
    revalidatePath(`${cfg.routePrefix}/${id}`);
    return { message: 'Saved.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error(`[hr-status mutate:${pillar}]`, e);
    return { error: msg };
  }
}
