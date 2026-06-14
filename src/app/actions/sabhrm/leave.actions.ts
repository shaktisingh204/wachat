'use server';

import { ObjectId, type Db } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  LeaveRequestRow,
  LeaveTypeRow,
  LeaveStatus,
  ListParams,
  Paginated,
} from '@/lib/sabhrm/types';

/* ── doc shapes (server-internal) ────────────────────────────────────── */

interface LeaveRequestDoc {
  _id: ObjectId;
  workspaceId: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  from: Date;
  to: Date;
  days: number;
  reason?: string;
  status: LeaveStatus;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface LeaveTypeDoc {
  _id: ObjectId;
  workspaceId: string;
  name: string;
  code: string;
  annualQuota: number;
  paid: boolean;
  carryForward: boolean;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/* ── form value shapes (local — not in shared types.ts) ──────────────── */

export interface CreateLeaveRequestValues {
  employeeId: string;
  leaveTypeId: string;
  from: string;
  to: string;
  reason?: string;
}

export interface LeaveTypeFormValues {
  name: string;
  code: string;
  annualQuota: number;
  paid: boolean;
  carryForward: boolean;
  color?: string;
}

/* ── row mappers ─────────────────────────────────────────────────────── */

function toRequestRow(d: LeaveRequestDoc): LeaveRequestRow {
  return {
    id: String(d._id),
    employeeId: d.employeeId,
    employeeName: d.employeeName,
    leaveTypeId: d.leaveTypeId,
    leaveTypeName: d.leaveTypeName,
    from: d.from instanceof Date ? d.from.toISOString().slice(0, 10) : String(d.from).slice(0, 10),
    to: d.to instanceof Date ? d.to.toISOString().slice(0, 10) : String(d.to).slice(0, 10),
    days: d.days,
    reason: d.reason ?? null,
    status: d.status,
    appliedAt: d.appliedAt instanceof Date ? d.appliedAt.toISOString().slice(0, 10) : String(d.appliedAt).slice(0, 10),
  };
}

function toTypeRow(d: LeaveTypeDoc): LeaveTypeRow {
  return {
    id: String(d._id),
    name: d.name,
    code: d.code,
    annualQuota: d.annualQuota,
    paid: d.paid,
    carryForward: d.carryForward,
    color: d.color ?? null,
  };
}

/** Inclusive whole-day difference between two YYYY-MM-DD dates (min 1). */
function inclusiveDays(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const diff = Math.round((b - a) / 86_400_000) + 1;
  return diff < 1 ? 1 : diff;
}

/* ── name resolution ─────────────────────────────────────────────────── */

async function resolveEmployeeName(db: Db, workspaceId: string, employeeId: string): Promise<string | null> {
  if (!ObjectId.isValid(employeeId)) return null;
  const emp = (await db
    .collection(SABHRM_COLLECTIONS.employees)
    .findOne(
      { _id: new ObjectId(employeeId), workspaceId },
      { projection: { displayName: 1, firstName: 1, lastName: 1 } },
    )) as Record<string, unknown> | null;
  if (!emp) return null;
  return String(emp.displayName || `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim());
}

async function resolveLeaveTypeName(db: Db, workspaceId: string, leaveTypeId: string): Promise<string | null> {
  if (!ObjectId.isValid(leaveTypeId)) return null;
  const lt = (await db
    .collection(SABHRM_COLLECTIONS.leaveTypes)
    .findOne({ _id: new ObjectId(leaveTypeId), workspaceId }, { projection: { name: 1 } })) as
    | Record<string, unknown>
    | null;
  if (!lt) return null;
  return String(lt.name);
}

/* ════════════════════════════ Leave requests ═══════════════════════════ */

export async function listLeaveRequests(
  params: ListParams = {},
): Promise<ActionResult<Paginated<LeaveRequestRow>>> {
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
      filter.$or = [{ employeeName: rx }, { leaveTypeName: rx }, { reason: rx }];
    }

    const col = db.collection<LeaveRequestDoc>(SABHRM_COLLECTIONS.leaveRequests);
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ appliedAt: -1, createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      col.countDocuments(filter),
    ]);

    return {
      ok: true,
      data: {
        rows: docs.map(toRequestRow),
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load leave requests.' };
  }
}

export async function createLeaveRequest(
  form: CreateLeaveRequestValues,
): Promise<ActionResult<LeaveRequestRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  const employeeId = form.employeeId?.trim();
  const leaveTypeId = form.leaveTypeId?.trim();
  if (!employeeId) return { ok: false, error: 'An employee is required.' };
  if (!leaveTypeId) return { ok: false, error: 'A leave type is required.' };
  if (!form.from) return { ok: false, error: 'A start date is required.' };
  if (!form.to) return { ok: false, error: 'An end date is required.' };

  const from = new Date(`${form.from}T00:00:00.000Z`);
  const to = new Date(`${form.to}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, error: 'Invalid leave dates.' };
  }
  if (to.getTime() < from.getTime()) {
    return { ok: false, error: 'The end date cannot be before the start date.' };
  }

  try {
    const [employeeName, leaveTypeName] = await Promise.all([
      resolveEmployeeName(db, workspaceId, employeeId),
      resolveLeaveTypeName(db, workspaceId, leaveTypeId),
    ]);
    if (!employeeName) return { ok: false, error: 'Selected employee was not found.' };
    if (!leaveTypeName) return { ok: false, error: 'Selected leave type was not found.' };

    const now = new Date();
    const doc: Omit<LeaveRequestDoc, '_id'> = {
      workspaceId,
      employeeId,
      employeeName,
      leaveTypeId,
      leaveTypeName,
      from,
      to,
      days: inclusiveDays(from, to),
      reason: form.reason?.trim() || undefined,
      status: 'pending',
      appliedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };
    const ins = await db
      .collection<LeaveRequestDoc>(SABHRM_COLLECTIONS.leaveRequests)
      .insertOne(doc as LeaveRequestDoc);
    revalidatePath('/sabhrm/leave');
    revalidatePath('/sabhrm');
    return { ok: true, data: toRequestRow({ ...(doc as LeaveRequestDoc), _id: ins.insertedId }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create leave request.' };
  }
}

export async function setLeaveStatus(
  id: string,
  status: 'approved' | 'rejected' | 'cancelled',
): Promise<ActionResult<LeaveRequestRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid leave request id.' };
  if (status !== 'approved' && status !== 'rejected' && status !== 'cancelled') {
    return { ok: false, error: 'Invalid leave status.' };
  }
  const { db, workspaceId } = g.ctx;

  try {
    const col = db.collection<LeaveRequestDoc>(SABHRM_COLLECTIONS.leaveRequests);
    const existing = await col.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Leave request not found.' };

    await col.updateOne({ _id: existing._id }, { $set: { status, updatedAt: new Date() } });
    const updated = await col.findOne({ _id: existing._id });
    revalidatePath('/sabhrm/leave');
    revalidatePath('/sabhrm');
    return { ok: true, data: toRequestRow(updated as LeaveRequestDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update leave request.' };
  }
}

export async function deleteLeaveRequest(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid leave request id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const res = await db
      .collection<LeaveRequestDoc>(SABHRM_COLLECTIONS.leaveRequests)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Leave request not found.' };
    revalidatePath('/sabhrm/leave');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete leave request.' };
  }
}

/* ════════════════════════════ Leave types ══════════════════════════════ */

export async function listLeaveTypes(): Promise<ActionResult<LeaveTypeRow[]>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;
  try {
    const docs = await db
      .collection<LeaveTypeDoc>(SABHRM_COLLECTIONS.leaveTypes)
      .find({ workspaceId })
      .sort({ name: 1 })
      .limit(500)
      .toArray();
    return { ok: true, data: docs.map(toTypeRow) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load leave types.' };
  }
}

export async function createLeaveType(
  form: LeaveTypeFormValues,
): Promise<ActionResult<LeaveTypeRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  const name = form.name?.trim();
  const code = form.code?.trim().toUpperCase();
  if (!name) return { ok: false, error: 'A leave type name is required.' };
  if (!code) return { ok: false, error: 'A leave type code is required.' };

  try {
    const col = db.collection<LeaveTypeDoc>(SABHRM_COLLECTIONS.leaveTypes);
    const dupe = await col.findOne({ workspaceId, code }, { projection: { _id: 1 } });
    if (dupe) return { ok: false, error: `A leave type already uses the code ${code}.` };

    const annualQuota = Number.isFinite(form.annualQuota) ? Math.max(0, Number(form.annualQuota)) : 0;
    const now = new Date();
    const doc: Omit<LeaveTypeDoc, '_id'> = {
      workspaceId,
      name,
      code,
      annualQuota,
      paid: !!form.paid,
      carryForward: !!form.carryForward,
      color: form.color?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };
    const ins = await col.insertOne(doc as LeaveTypeDoc);
    revalidatePath('/sabhrm/leave');
    return { ok: true, data: toTypeRow({ ...(doc as LeaveTypeDoc), _id: ins.insertedId }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create leave type.' };
  }
}

export async function updateLeaveType(
  id: string,
  form: Partial<LeaveTypeFormValues>,
): Promise<ActionResult<LeaveTypeRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid leave type id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const col = db.collection<LeaveTypeDoc>(SABHRM_COLLECTIONS.leaveTypes);
    const existing = await col.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Leave type not found.' };

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (form.name !== undefined) {
      const name = form.name.trim();
      if (!name) return { ok: false, error: 'A leave type name is required.' };
      set.name = name;
    }
    if (form.code !== undefined) {
      const code = form.code.trim().toUpperCase();
      if (!code) return { ok: false, error: 'A leave type code is required.' };
      const dupe = await col.findOne(
        { workspaceId, code, _id: { $ne: existing._id } },
        { projection: { _id: 1 } },
      );
      if (dupe) return { ok: false, error: `A leave type already uses the code ${code}.` };
      set.code = code;
    }
    if (form.annualQuota !== undefined) {
      set.annualQuota = Number.isFinite(form.annualQuota) ? Math.max(0, Number(form.annualQuota)) : 0;
    }
    if (form.paid !== undefined) set.paid = !!form.paid;
    if (form.carryForward !== undefined) set.carryForward = !!form.carryForward;
    if (form.color !== undefined) set.color = form.color.trim() || undefined;

    await col.updateOne({ _id: existing._id }, { $set: set });
    const updated = await col.findOne({ _id: existing._id });
    revalidatePath('/sabhrm/leave');
    return { ok: true, data: toTypeRow(updated as LeaveTypeDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update leave type.' };
  }
}

export async function deleteLeaveType(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid leave type id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const res = await db
      .collection<LeaveTypeDoc>(SABHRM_COLLECTIONS.leaveTypes)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Leave type not found.' };
    revalidatePath('/sabhrm/leave');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete leave type.' };
  }
}

/* ── pickers (employee + leave type) ─────────────────────────────────── */

export interface LeavePickerOptions {
  employees: Array<{ value: string; label: string }>;
  leaveTypes: Array<{ value: string; label: string }>;
}

export async function getLeavePickerOptions(): Promise<ActionResult<LeavePickerOptions>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;
  try {
    const [emps, types] = await Promise.all([
      db
        .collection(SABHRM_COLLECTIONS.employees)
        .find({ workspaceId }, { projection: { displayName: 1, firstName: 1, lastName: 1 } })
        .limit(1000)
        .toArray(),
      db
        .collection(SABHRM_COLLECTIONS.leaveTypes)
        .find({ workspaceId }, { projection: { name: 1 } })
        .sort({ name: 1 })
        .limit(500)
        .toArray(),
    ]);
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
        leaveTypes: types.map((d) => ({
          value: String(d._id),
          label: String((d as Record<string, unknown>).name),
        })),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load options.' };
  }
}
