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
 * generic `mutate` helper (see `_hr-status-helpers.ts`) and the thin
 * per-entity wrappers compose on top.
 *
 * This file is split into two halves for the <600 line budget:
 *   - `hr-status.actions.ts`      — exits, succession, comp bands,
 *     announcements, policies, assets, documents, document templates
 *   - `hr-status-flow.actions.ts` — timesheets, travel, expense claims,
 *     probation, onboarding, jobs, offers, asset assignments, awards,
 *     disciplinary
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


export async function markExitNoc(
  id: string,
  nocStatus: 'issued' | 'na' = 'issued',
): Promise<HrActionResult> {
  return mutate({
    pillar: 'exit',
    id,
    patch: { nocStatus },
    action: 'status_change',
    reason: `NOC ${nocStatus}`,
  });
}

/* ─── Succession ────────────────────────────────────────────────────── */

export async function markSuccessionReviewed(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'succession',
    id,
    patch: { lastReviewedAt: new Date(), status: 'reviewed' },
    action: 'status_change',
    reason: 'Plan reviewed',
  });
}

export async function promoteSuccessor(
  id: string,
  successorRef: string,
): Promise<HrActionResult> {
  return mutate({
    pillar: 'succession',
    id,
    patch: {
      promotedSuccessor: successorRef,
      promotedAt: new Date(),
      status: 'promoted',
    },
    action: 'status_change',
    reason: `Promoted successor ${successorRef}`,
  });
}

/* ─── Compensation bands ────────────────────────────────────────────── */

export async function archiveCompensationBand(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'compensationBand',
    id,
    patch: { isActive: false, archivedAt: new Date() },
    action: 'archive',
  });
}

/* ─── Announcements ─────────────────────────────────────────────────── */

export async function toggleAnnouncementPin(
  id: string,
  pinned: boolean,
): Promise<HrActionResult> {
  return mutate({
    pillar: 'announcement',
    id,
    patch: { pinned },
    action: 'status_change',
    reason: pinned ? 'Pinned' : 'Unpinned',
  });
}

export async function sendAnnouncementNow(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'announcement',
    id,
    patch: { sentAt: new Date(), status: 'sent', publishAt: new Date() },
    action: 'send',
  });
}

export async function archiveAnnouncement(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'announcement',
    id,
    patch: { archived: true, archivedAt: new Date() },
    action: 'archive',
  });
}

/* ─── Policies ──────────────────────────────────────────────────────── */

export async function publishPolicy(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'policy',
    id,
    patch: { status: 'active', publishedAt: new Date() },
    action: 'status_change',
    reason: 'Published',
  });
}

export async function archivePolicy(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'policy',
    id,
    patch: { status: 'archived', archivedAt: new Date() },
    action: 'archive',
  });
}

/* ─── Assets ────────────────────────────────────────────────────────── */

export async function markAssetReturned(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'asset',
    id,
    patch: { assignedTo: null, custodian: null, returnedAt: new Date() },
    action: 'status_change',
    reason: 'Asset returned',
  });
}

export async function retireAsset(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'asset',
    id,
    patch: { condition: 'retired', retiredAt: new Date(), archived: true },
    action: 'archive',
    reason: 'Retired',
  });
}

/* ─── Documents ─────────────────────────────────────────────────────── */

export async function markDocumentVerified(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'document',
    id,
    patch: { verified: true, isVerified: true, verifiedAt: new Date() },
    action: 'status_change',
    reason: 'Verified',
  });
}

export async function renewDocument(
  id: string,
  newExpiry: string,
): Promise<HrActionResult> {
  if (!newExpiry) return { error: 'New expiry date is required.' };
  const d = new Date(newExpiry);
  if (Number.isNaN(d.getTime())) return { error: 'Invalid date.' };

  return mutate({
    pillar: 'document',
    id,
    patch: { expiresAt: d, renewedAt: new Date() },
    action: 'update',
    reason: `Renewed until ${newExpiry}`,
  });
}

/* ─── Document templates ────────────────────────────────────────────── */

export async function archiveDocumentTemplate(id: string): Promise<HrActionResult> {
  return mutate({
    pillar: 'documentTemplate',
    id,
    patch: { archived: true, archivedAt: new Date() },
    action: 'archive',
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

    const { _id: _ignore, ...rest } = original as Record<string, unknown> & {
      _id: unknown;
    };
    void _ignore;
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
    return { message: 'Template duplicated.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[duplicateDocumentTemplate]', e);
    return { error: msg };
  }
}
