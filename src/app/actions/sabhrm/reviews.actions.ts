'use server';

import { ObjectId, type Db } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  ReviewRow,
  ReviewStatus,
  ListParams,
  Paginated,
} from '@/lib/sabhrm/types';

/* ── form values (local — not in shared types.ts) ────────────────────── */

export interface ReviewFormValues {
  employeeId: string;
  reviewerId?: string;
  cycle: string;
  rating?: number;
  status?: ReviewStatus;
}

/* ── doc shape (server-internal) ─────────────────────────────────────── */

interface ReviewDoc {
  _id: ObjectId;
  workspaceId: string;
  employeeId: string;
  employeeName: string;
  reviewerId?: string;
  reviewerName?: string;
  cycle: string;
  rating?: number;
  status: ReviewStatus;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

function toRow(d: ReviewDoc): ReviewRow {
  return {
    id: String(d._id),
    employeeId: d.employeeId,
    employeeName: d.employeeName,
    reviewerId: d.reviewerId ?? null,
    reviewerName: d.reviewerName ?? null,
    cycle: d.cycle,
    rating: typeof d.rating === 'number' ? d.rating : null,
    status: d.status,
    submittedAt: d.submittedAt ? d.submittedAt.toISOString().slice(0, 10) : null,
  };
}

/* ── name resolution from the employees collection ───────────────────── */

async function resolveEmployeeName(
  db: Db,
  workspaceId: string,
  id?: string,
): Promise<string | undefined> {
  if (!id || !ObjectId.isValid(id)) return undefined;
  const emp = (await db
    .collection(SABHRM_COLLECTIONS.employees)
    .findOne(
      { _id: new ObjectId(id), workspaceId },
      { projection: { displayName: 1, firstName: 1, lastName: 1 } },
    )) as Record<string, unknown> | null;
  if (!emp) return undefined;
  return String(emp.displayName || `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim());
}

/* ── list ────────────────────────────────────────────────────────────── */

export async function listReviews(
  params: ListParams = {},
): Promise<ActionResult<Paginated<ReviewRow>>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;

  try {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const filter: Record<string, unknown> = { workspaceId };
    if (params.status) filter.status = params.status;
    if (params.q) {
      const rx = new RegExp(params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ employeeName: rx }, { reviewerName: rx }, { cycle: rx }];
    }

    const col = db.collection<ReviewDoc>(SABHRM_COLLECTIONS.reviews);
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      col.countDocuments(filter),
    ]);

    return {
      ok: true,
      data: {
        rows: docs.map(toRow),
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load reviews.' };
  }
}

/* ── create ──────────────────────────────────────────────────────────── */

export async function createReview(
  form: ReviewFormValues,
): Promise<ActionResult<ReviewRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  const employeeId = form.employeeId?.trim();
  const cycle = form.cycle?.trim();
  if (!employeeId || !ObjectId.isValid(employeeId)) {
    return { ok: false, error: 'A valid employee is required.' };
  }
  if (!cycle) return { ok: false, error: 'A review cycle is required.' };

  const rating = typeof form.rating === 'number' ? form.rating : undefined;
  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return { ok: false, error: 'Rating must be between 1 and 5.' };
  }

  try {
    const employeeName = await resolveEmployeeName(db, workspaceId, employeeId);
    if (!employeeName) return { ok: false, error: 'Employee not found.' };
    const reviewerName = await resolveEmployeeName(db, workspaceId, form.reviewerId);

    const status = form.status ?? 'draft';
    const now = new Date();
    const doc: Omit<ReviewDoc, '_id'> = {
      workspaceId,
      employeeId,
      employeeName,
      reviewerId: form.reviewerId || undefined,
      reviewerName,
      cycle,
      rating,
      status,
      submittedAt: status === 'submitted' || status === 'acknowledged' ? now : undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };
    const ins = await db
      .collection<ReviewDoc>(SABHRM_COLLECTIONS.reviews)
      .insertOne(doc as ReviewDoc);
    revalidatePath('/sabhrm/reviews');
    return { ok: true, data: toRow({ ...(doc as ReviewDoc), _id: ins.insertedId }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create review.' };
  }
}

/* ── update ──────────────────────────────────────────────────────────── */

export async function updateReview(
  id: string,
  form: Partial<ReviewFormValues>,
): Promise<ActionResult<ReviewRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid review id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const reviews = db.collection<ReviewDoc>(SABHRM_COLLECTIONS.reviews);
    const existing = await reviews.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Review not found.' };

    if (form.rating !== undefined && form.rating !== null) {
      if (form.rating < 1 || form.rating > 5) {
        return { ok: false, error: 'Rating must be between 1 and 5.' };
      }
    }

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (form.employeeId !== undefined) {
      if (!ObjectId.isValid(form.employeeId)) return { ok: false, error: 'A valid employee is required.' };
      const name = await resolveEmployeeName(db, workspaceId, form.employeeId);
      if (!name) return { ok: false, error: 'Employee not found.' };
      set.employeeId = form.employeeId;
      set.employeeName = name;
    }
    if (form.reviewerId !== undefined) {
      set.reviewerId = form.reviewerId || undefined;
      set.reviewerName = await resolveEmployeeName(db, workspaceId, form.reviewerId);
    }
    if (form.cycle !== undefined) {
      const cycle = form.cycle.trim();
      if (!cycle) return { ok: false, error: 'A review cycle is required.' };
      set.cycle = cycle;
    }
    if (form.rating !== undefined) {
      set.rating = typeof form.rating === 'number' ? form.rating : undefined;
    }
    if (form.status !== undefined) {
      set.status = form.status;
      if ((form.status === 'submitted' || form.status === 'acknowledged') && !existing.submittedAt) {
        set.submittedAt = new Date();
      }
    }

    await reviews.updateOne({ _id: existing._id }, { $set: set });
    const updated = await reviews.findOne({ _id: existing._id });
    revalidatePath('/sabhrm/reviews');
    return { ok: true, data: toRow(updated as ReviewDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update review.' };
  }
}

/* ── set status (submit / acknowledge) ───────────────────────────────── */

export async function setReviewStatus(
  id: string,
  status: 'submitted' | 'acknowledged',
): Promise<ActionResult<ReviewRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid review id.' };
  if (status !== 'submitted' && status !== 'acknowledged') {
    return { ok: false, error: 'Invalid review status.' };
  }
  const { db, workspaceId } = g.ctx;

  try {
    const reviews = db.collection<ReviewDoc>(SABHRM_COLLECTIONS.reviews);
    const existing = await reviews.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Review not found.' };

    const set: Record<string, unknown> = { status, updatedAt: new Date() };
    if (!existing.submittedAt) set.submittedAt = new Date();

    await reviews.updateOne({ _id: existing._id }, { $set: set });
    const updated = await reviews.findOne({ _id: existing._id });
    revalidatePath('/sabhrm/reviews');
    return { ok: true, data: toRow(updated as ReviewDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update review status.' };
  }
}

/* ── delete ──────────────────────────────────────────────────────────── */

export async function deleteReview(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid review id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const res = await db
      .collection<ReviewDoc>(SABHRM_COLLECTIONS.reviews)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Review not found.' };
    revalidatePath('/sabhrm/reviews');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete review.' };
  }
}

/* ── employee picker (used for both employee + reviewer) ──────────────── */

export interface ReviewPickerOptions {
  employees: Array<{ value: string; label: string }>;
}

export async function getReviewPickerOptions(): Promise<ActionResult<ReviewPickerOptions>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;
  try {
    const emps = await db
      .collection(SABHRM_COLLECTIONS.employees)
      .find({ workspaceId }, { projection: { displayName: 1, firstName: 1, lastName: 1 } })
      .limit(1000)
      .toArray();
    return {
      ok: true,
      data: {
        employees: emps.map((d) => {
          const r = d as Record<string, unknown>;
          return {
            value: String(r._id),
            label: String(r.displayName || `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim()),
          };
        }),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load options.' };
  }
}
