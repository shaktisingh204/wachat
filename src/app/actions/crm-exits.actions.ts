'use server';

/**
 * CRM Exit (offboarding) server actions.
 *
 * Tenant-scoped reads/writes against the `crm_exits` Mongo collection.
 * Mirrors the legacy direct-Mongo branch of `crm-accounts.actions.ts`
 * (no Rust wiring for this entity). Soft-deletes via `archived` flag.
 *
 * Schema (per `crm_function_plan.md` §10):
 *   - type: 'resignation' | 'termination' | 'end-of-contract'
 *   - noticeStart, lastDay (Date)
 *   - fnfStatus: 'pending' | 'in-progress' | 'cleared'
 *   - exitInterviewNotes (string)
 *   - nocStatus, assetReturnStatus, knowledgeTransferStatus
 *
 * Tenant scope: every operation filters by `userId == session.user._id`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';

export interface CrmExitDoc {
  _id?: ObjectId;
  userId: ObjectId;
  employeeId?: string;
  employeeName?: string;
  type: 'resignation' | 'termination' | 'end-of-contract';
  noticeStart?: Date;
  lastDay?: Date;
  fnfStatus: 'pending' | 'in-progress' | 'cleared';
  nocStatus: 'pending' | 'issued' | 'na';
  assetReturnStatus: 'pending' | 'partial' | 'complete';
  knowledgeTransferStatus: 'pending' | 'in-progress' | 'complete';
  exitInterviewNotes?: string;
  reason?: string;
  notes?: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function revalidateSurfaces(id?: string): void {
  revalidatePath('/dashboard/hrm/hr/exits');
  if (id) revalidatePath(`/dashboard/hrm/hr/exits/${id}`);
}

/* ─── getCrmExits ─────────────────────────────────────────────────────── */

export async function getCrmExits(
  status: 'active' | 'archived' | 'all' = 'active',
): Promise<WithId<CrmExitDoc>[]> {
  const session = await getSession();
  if (!session?.user) return [];

  try {
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = {
      userId: new ObjectId(session.user._id as string),
    };
    if (status === 'active') filter.archived = { $ne: true };
    else if (status === 'archived') filter.archived = true;

    const docs = await db
      .collection<CrmExitDoc>('crm_exits')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();
    return JSON.parse(JSON.stringify(docs)) as WithId<CrmExitDoc>[];
  } catch (e) {
    console.error('[getCrmExits]', e);
    return [];
  }
}

/* ─── getCrmExitById ──────────────────────────────────────────────────── */

export async function getCrmExitById(
  id: string,
): Promise<WithId<CrmExitDoc> | null> {
  const session = await getSession();
  if (!session?.user) return null;
  if (!id || !ObjectId.isValid(id)) return null;

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection<CrmExitDoc>('crm_exits').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id as string),
    });
    return doc ? (JSON.parse(JSON.stringify(doc)) as WithId<CrmExitDoc>) : null;
  } catch (e) {
    console.error('[getCrmExitById]', e);
    return null;
  }
}

/* ─── saveCrmExit (create + update via _id) ───────────────────────────── */

export async function saveCrmExit(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const idRaw = (formData.get('_id') as string | null) || '';
  const employeeName = ((formData.get('employeeName') as string | null) || '').trim();
  const employeeId = ((formData.get('employeeId') as string | null) || '').trim();
  const type =
    ((formData.get('type') as string | null) || 'resignation') as CrmExitDoc['type'];
  const noticeStartRaw = (formData.get('noticeStart') as string | null) || '';
  const lastDayRaw = (formData.get('lastDay') as string | null) || '';
  const fnfStatus =
    ((formData.get('fnfStatus') as string | null) || 'pending') as CrmExitDoc['fnfStatus'];
  const nocStatus =
    ((formData.get('nocStatus') as string | null) || 'pending') as CrmExitDoc['nocStatus'];
  const assetReturnStatus =
    ((formData.get('assetReturnStatus') as string | null) || 'pending') as CrmExitDoc['assetReturnStatus'];
  const knowledgeTransferStatus =
    ((formData.get('knowledgeTransferStatus') as string | null) ||
      'pending') as CrmExitDoc['knowledgeTransferStatus'];
  const exitInterviewNotes =
    ((formData.get('exitInterviewNotes') as string | null) || '').trim() || undefined;
  const reason = ((formData.get('reason') as string | null) || '').trim() || undefined;
  const notes = ((formData.get('notes') as string | null) || '').trim() || undefined;

  if (!employeeName && !employeeId) {
    return { error: 'Employee name or ID is required.' };
  }

  const update: Partial<CrmExitDoc> = {
    employeeName: employeeName || undefined,
    employeeId: employeeId || undefined,
    type,
    fnfStatus,
    nocStatus,
    assetReturnStatus,
    knowledgeTransferStatus,
    exitInterviewNotes,
    reason,
    notes,
    updatedAt: new Date(),
  };
  if (noticeStartRaw) update.noticeStart = new Date(noticeStartRaw);
  if (lastDayRaw) update.lastDay = new Date(lastDayRaw);

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);

    if (idRaw && ObjectId.isValid(idRaw)) {
      const res = await db
        .collection<CrmExitDoc>('crm_exits')
        .updateOne(
          { _id: new ObjectId(idRaw), userId },
          { $set: update },
        );
      if (res.matchedCount === 0) {
        return { error: 'Exit not found or access denied.' };
      }
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'update',
        entityKind: 'exit',
        entityId: idRaw,
      });
      revalidateSurfaces(idRaw);
      return { message: 'Exit updated.', id: idRaw };
    }

    const doc: CrmExitDoc = {
      userId,
      type,
      fnfStatus,
      nocStatus,
      assetReturnStatus,
      knowledgeTransferStatus,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...update,
    };

    const result = await db.collection<CrmExitDoc>('crm_exits').insertOne(doc);
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'create',
      entityKind: 'exit',
      entityId: String(result.insertedId),
    });

    revalidateSurfaces();
    return { message: 'Exit created.', id: result.insertedId.toString() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[saveCrmExit]', e);
    return { error: msg };
  }
}

/* ─── deleteCrmExit (soft-delete via `archived`) ──────────────────────── */

export async function deleteCrmExit(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  if (!id || !ObjectId.isValid(id)) {
    return { success: false, error: 'Invalid id.' };
  }

  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_exits').updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: { archived: true, updatedAt: new Date() } },
    );
    if (res.matchedCount === 0) {
      return { success: false, error: 'Not found.' };
    }
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'archive',
      entityKind: 'exit',
      entityId: id,
    });
    revalidateSurfaces(id);
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}
