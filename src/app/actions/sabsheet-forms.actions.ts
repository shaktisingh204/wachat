'use server';

/**
 * SabSheet Forms — owner-scoped server actions.
 *
 * CRUD for `sabsheet_forms` documents. Every action requires a session
 * (`getSession()`); reads/mutations are scoped to `ownerUserId =
 * sessionUserId`. Public form RENDERING + SUBMISSION live in
 * `sabsheet-forms-public.actions.ts` (no session) — this file is the
 * authenticated builder surface only.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
  COLL_SABSHEET_FORMS,
  type SabsheetForm,
  type SabsheetFormCreateInput,
  type SabsheetFormField,
  type SabsheetFormPatch,
} from '@/lib/sabsheet/forms/types';

async function requireUserOid(): Promise<ObjectId> {
  const session = await getSession();
  if (!session?.user?._id) {
    throw new Error('SabSheet Forms: not authenticated');
  }
  return new ObjectId(session.user._id);
}

function sanitizeFields(raw: unknown): SabsheetFormField[] {
  if (!Array.isArray(raw)) return [];
  const out: SabsheetFormField[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const rec = f as Record<string, unknown>;
    const columnIndex = Number(rec.columnIndex);
    const label = typeof rec.label === 'string' ? rec.label.trim() : '';
    const type = rec.type;
    if (!Number.isInteger(columnIndex) || columnIndex < 0) continue;
    if (!label) continue;
    const allowedTypes = ['text', 'number', 'email', 'date', 'select'] as const;
    const safeType = (allowedTypes as readonly string[]).includes(type as string)
      ? (type as SabsheetFormField['type'])
      : 'text';
    const field: SabsheetFormField = {
      columnIndex,
      label,
      type: safeType,
      required: Boolean(rec.required),
    };
    if (safeType === 'select' && Array.isArray(rec.options)) {
      field.options = rec.options
        .filter((o): o is string => typeof o === 'string')
        .map((o) => o.trim())
        .filter(Boolean);
    }
    out.push(field);
  }
  return out;
}

function formFromDoc(d: any): SabsheetForm {
  return {
    _id: String(d._id),
    ownerUserId: String(d.ownerUserId),
    workbookId: String(d.workbookId),
    sheetId: String(d.sheetId),
    token: String(d.token),
    title: d.title ?? '',
    description: d.description ?? undefined,
    fields: sanitizeFields(d.fields),
    status: d.status === 'closed' ? 'closed' : 'active',
    submitCount: Number(d.submitCount ?? 0),
  };
}

/** List every form the session user owns for a given workbook. */
export async function listForms(workbookId: string): Promise<SabsheetForm[]> {
  const userId = await requireUserOid();
  let wbOid: ObjectId;
  try {
    wbOid = new ObjectId(workbookId);
  } catch {
    return [];
  }
  const { db } = await connectToDatabase();
  const rows = await db
    .collection(COLL_SABSHEET_FORMS)
    .find({ workbookId: wbOid, ownerUserId: userId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return rows.map(formFromDoc);
}

/** Create a form for a workbook + sheet the session user owns. */
export async function createForm(
  input: SabsheetFormCreateInput,
): Promise<SabsheetForm> {
  const userId = await requireUserOid();
  const title = input.title?.trim();
  if (!title) throw new Error('SabSheet Forms: title is required');

  let wbOid: ObjectId;
  let sheetOid: ObjectId;
  try {
    wbOid = new ObjectId(input.workbookId);
    sheetOid = new ObjectId(input.sheetId);
  } catch {
    throw new Error('SabSheet Forms: invalid workbookId / sheetId');
  }

  const { db } = await connectToDatabase();
  // Ownership guard: the workbook + sheet must belong to the caller.
  const sheet = await db
    .collection('sabsheet_sheets')
    .findOne({ _id: sheetOid, workbookId: wbOid, ownerUserId: userId });
  if (!sheet) throw new Error('SabSheet Forms: target sheet not found');

  const now = new Date();
  const doc = {
    ownerUserId: userId,
    workbookId: wbOid,
    sheetId: sheetOid,
    token: createId(),
    title,
    description: input.description?.trim() || undefined,
    fields: sanitizeFields(input.fields),
    status: input.status === 'closed' ? 'closed' : 'active',
    submitCount: 0,
    // 1-based next data row. Row 1 is reserved for a header; submissions
    // start at row 2 and `nextRow` is atomically incremented per submit.
    nextRow: 2,
    createdAt: now,
    updatedAt: now,
  };
  const r = await db.collection(COLL_SABSHEET_FORMS).insertOne(doc);
  revalidatePath(`/dashboard/sabsheet/${input.workbookId}`);
  const fresh = await db
    .collection(COLL_SABSHEET_FORMS)
    .findOne({ _id: r.insertedId });
  return formFromDoc(fresh);
}

/** Patch a form the session user owns. Returns the updated doc or null. */
export async function updateForm(
  id: string,
  patch: SabsheetFormPatch,
): Promise<SabsheetForm | null> {
  const userId = await requireUserOid();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof patch.title === 'string' && patch.title.trim()) {
    set.title = patch.title.trim();
  }
  if (typeof patch.description === 'string') {
    set.description = patch.description.trim() || undefined;
  }
  if (patch.sheetId) {
    try {
      set.sheetId = new ObjectId(patch.sheetId);
    } catch {
      /* ignore invalid id */
    }
  }
  if (patch.fields !== undefined) {
    set.fields = sanitizeFields(patch.fields);
  }
  if (patch.status === 'active' || patch.status === 'closed') {
    set.status = patch.status;
  }

  const { db } = await connectToDatabase();
  await db
    .collection(COLL_SABSHEET_FORMS)
    .updateOne({ _id: oid, ownerUserId: userId }, { $set: set });
  const fresh = await db
    .collection(COLL_SABSHEET_FORMS)
    .findOne({ _id: oid, ownerUserId: userId });
  if (fresh) revalidatePath(`/dashboard/sabsheet/${String(fresh.workbookId)}`);
  return fresh ? formFromDoc(fresh) : null;
}

/** Delete a form the session user owns. */
export async function deleteForm(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserOid();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return { ok: false };
  }
  const { db } = await connectToDatabase();
  const r = await db
    .collection(COLL_SABSHEET_FORMS)
    .deleteOne({ _id: oid, ownerUserId: userId });
  return { ok: r.deletedCount > 0 };
}
