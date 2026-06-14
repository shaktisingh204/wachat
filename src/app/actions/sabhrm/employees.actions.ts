'use server';

import { ObjectId, type Db } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { hashPassword, createFirebaseAuthUser, getFirebaseAuthUserByEmail } from '@/lib/auth';
import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  EmployeeRow,
  EmployeeFormValues,
  EmploymentType,
  EmployeeStatus,
  ListParams,
  Paginated,
} from '@/lib/sabhrm/types';

/* ── doc shape (server-internal) ─────────────────────────────────────── */

interface EmployeeDoc {
  _id: ObjectId;
  workspaceId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone?: string;
  departmentId?: string;
  departmentName?: string;
  designationId?: string;
  designationName?: string;
  reportingManagerId?: string;
  reportingManagerName?: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  dateOfJoining?: Date;
  dob?: Date;
  workLocation?: string;
  ctc?: number;
  salaryStructureId?: string;
  pan?: string;
  uan?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  photoUrl?: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

function toRow(d: EmployeeDoc): EmployeeRow {
  return {
    id: String(d._id),
    employeeCode: d.employeeCode,
    firstName: d.firstName,
    lastName: d.lastName,
    displayName: d.displayName || `${d.firstName} ${d.lastName}`.trim(),
    email: d.email,
    phone: d.phone ?? null,
    departmentId: d.departmentId ?? null,
    departmentName: d.departmentName ?? null,
    designationId: d.designationId ?? null,
    designationName: d.designationName ?? null,
    reportingManagerId: d.reportingManagerId ?? null,
    reportingManagerName: d.reportingManagerName ?? null,
    employmentType: d.employmentType,
    status: d.status,
    dateOfJoining: d.dateOfJoining ? d.dateOfJoining.toISOString().slice(0, 10) : null,
    workLocation: d.workLocation ?? null,
    ctc: typeof d.ctc === 'number' ? d.ctc : null,
    photoUrl: d.photoUrl ?? null,
    userId: d.userId ?? null,
  };
}

/* ── name resolution from the org collections ───────────────────────── */

async function resolveNames(
  db: Db,
  workspaceId: string,
  ids: { departmentId?: string; designationId?: string; reportingManagerId?: string },
): Promise<{ departmentName?: string; designationName?: string; reportingManagerName?: string }> {
  const out: { departmentName?: string; designationName?: string; reportingManagerName?: string } = {};
  if (ids.departmentId && ObjectId.isValid(ids.departmentId)) {
    const dep = await db
      .collection(SABHRM_COLLECTIONS.departments)
      .findOne({ _id: new ObjectId(ids.departmentId), workspaceId }, { projection: { name: 1 } });
    if (dep) out.departmentName = String((dep as Record<string, unknown>).name);
  }
  if (ids.designationId && ObjectId.isValid(ids.designationId)) {
    const des = await db
      .collection(SABHRM_COLLECTIONS.designations)
      .findOne({ _id: new ObjectId(ids.designationId), workspaceId }, { projection: { name: 1 } });
    if (des) out.designationName = String((des as Record<string, unknown>).name);
  }
  if (ids.reportingManagerId && ObjectId.isValid(ids.reportingManagerId)) {
    const mgr = (await db
      .collection(SABHRM_COLLECTIONS.employees)
      .findOne(
        { _id: new ObjectId(ids.reportingManagerId), workspaceId },
        { projection: { displayName: 1, firstName: 1, lastName: 1 } },
      )) as Record<string, unknown> | null;
    if (mgr) out.reportingManagerName = String(mgr.displayName || `${mgr.firstName ?? ''} ${mgr.lastName ?? ''}`.trim());
  }
  return out;
}

/* ── list ────────────────────────────────────────────────────────────── */

export async function listEmployees(
  params: ListParams = {},
): Promise<ActionResult<Paginated<EmployeeRow>>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;

  try {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const filter: Record<string, unknown> = { workspaceId };
    if (params.status) filter.status = params.status;
    if (params.departmentId) filter.departmentId = params.departmentId;
    if (params.q) {
      const rx = new RegExp(params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ firstName: rx }, { lastName: rx }, { displayName: rx }, { email: rx }, { employeeCode: rx }];
    }

    const col = db.collection<EmployeeDoc>(SABHRM_COLLECTIONS.employees);
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
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load employees.' };
  }
}

/* ── get ─────────────────────────────────────────────────────────────── */

export async function getEmployee(id: string): Promise<ActionResult<EmployeeRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid employee id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const doc = await db
      .collection<EmployeeDoc>(SABHRM_COLLECTIONS.employees)
      .findOne({ _id: new ObjectId(id), workspaceId });
    if (!doc) return { ok: false, error: 'Employee not found.' };
    return { ok: true, data: toRow(doc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load employee.' };
  }
}

/* ── create (with email + password login) ────────────────────────────── */

export async function createEmployee(
  form: EmployeeFormValues,
): Promise<ActionResult<EmployeeRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  const firstName = form.firstName?.trim();
  const lastName = form.lastName?.trim();
  const email = form.email?.trim().toLowerCase();
  if (!firstName || !lastName) return { ok: false, error: 'First and last name are required.' };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'A valid work email is required.' };
  }
  const password = form.password?.trim();
  if (!password || password.length < 8) {
    return { ok: false, error: 'A password of at least 8 characters is required to create the login.' };
  }

  try {
    const employees = db.collection<EmployeeDoc>(SABHRM_COLLECTIONS.employees);

    // Uniqueness within the workspace.
    const dupe = await employees.findOne({ workspaceId, email }, { projection: { _id: 1 } });
    if (dupe) return { ok: false, error: `An employee already uses ${email}.` };

    // ── Login (email + password) — reuse the app's auth primitives. ──────
    // Mongo `users` doc is the source of truth for password sign-in; Firebase
    // is created best-effort so it stays consistent with the rest of the app.
    let loginUserId: string | undefined;
    const existingUser = await db
      .collection('users')
      .findOne({ email }, { projection: { _id: 1 } });
    if (existingUser) {
      loginUserId = String(existingUser._id);
    } else {
      const fb = await getFirebaseAuthUserByEmail(email).catch(() => null);
      const fbUser = fb ?? (await createFirebaseAuthUser({
        email,
        password,
        displayName: `${firstName} ${lastName}`.trim(),
      }).catch(() => null));
      const passwordHash = await hashPassword(password);
      const now = new Date();
      const ins = await db.collection('users').insertOne({
        name: `${firstName} ${lastName}`.trim(),
        email,
        password: passwordHash,
        authProvider: 'password',
        emailVerified: now,
        firebaseUid: fbUser?.uid,
        role: 'employee',
        isProvisionedEmployee: true,
        mustChangePassword: true,
        onboarding: { status: 'complete' },
        createdAt: now,
        updatedAt: now,
      } as never);
      loginUserId = String(ins.insertedId);
    }

    // Employee code: EMP-<seq> based on current count (best-effort sequence).
    const count = await employees.countDocuments({ workspaceId });
    const employeeCode = `EMP-${String(count + 1).padStart(4, '0')}`;

    const names = await resolveNames(db, workspaceId, {
      departmentId: form.departmentId,
      designationId: form.designationId,
      reportingManagerId: form.reportingManagerId,
    });

    const now = new Date();
    const doc: Omit<EmployeeDoc, '_id'> = {
      workspaceId,
      employeeCode,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`.trim(),
      email,
      phone: form.phone?.trim() || undefined,
      departmentId: form.departmentId || undefined,
      departmentName: names.departmentName,
      designationId: form.designationId || undefined,
      designationName: names.designationName,
      reportingManagerId: form.reportingManagerId || undefined,
      reportingManagerName: names.reportingManagerName,
      employmentType: form.employmentType ?? 'full_time',
      status: form.status ?? 'active',
      dateOfJoining: form.dateOfJoining ? new Date(form.dateOfJoining) : now,
      workLocation: form.workLocation?.trim() || undefined,
      ctc: typeof form.ctc === 'number' ? form.ctc : undefined,
      salaryStructureId: form.salaryStructureId || undefined,
      pan: form.pan?.trim() || undefined,
      uan: form.uan?.trim() || undefined,
      bankAccountNo: form.bankAccountNo?.trim() || undefined,
      bankIfsc: form.bankIfsc?.trim() || undefined,
      userId: loginUserId,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };
    const ins = await employees.insertOne(doc as EmployeeDoc);
    revalidatePath('/sabhrm/employees');
    revalidatePath('/sabhrm');
    return { ok: true, data: toRow({ ...(doc as EmployeeDoc), _id: ins.insertedId }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create employee.' };
  }
}

/* ── update ──────────────────────────────────────────────────────────── */

export async function updateEmployee(
  id: string,
  form: Partial<EmployeeFormValues>,
): Promise<ActionResult<EmployeeRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid employee id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const employees = db.collection<EmployeeDoc>(SABHRM_COLLECTIONS.employees);
    const existing = await employees.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Employee not found.' };

    const names = await resolveNames(db, workspaceId, {
      departmentId: form.departmentId ?? existing.departmentId,
      designationId: form.designationId ?? existing.designationId,
      reportingManagerId: form.reportingManagerId ?? existing.reportingManagerId,
    });

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (form.firstName !== undefined) set.firstName = form.firstName.trim();
    if (form.lastName !== undefined) set.lastName = form.lastName.trim();
    if (form.firstName !== undefined || form.lastName !== undefined) {
      set.displayName = `${form.firstName ?? existing.firstName} ${form.lastName ?? existing.lastName}`.trim();
    }
    if (form.phone !== undefined) set.phone = form.phone.trim() || undefined;
    if (form.departmentId !== undefined) {
      set.departmentId = form.departmentId || undefined;
      set.departmentName = names.departmentName;
    }
    if (form.designationId !== undefined) {
      set.designationId = form.designationId || undefined;
      set.designationName = names.designationName;
    }
    if (form.reportingManagerId !== undefined) {
      set.reportingManagerId = form.reportingManagerId || undefined;
      set.reportingManagerName = names.reportingManagerName;
    }
    if (form.employmentType !== undefined) set.employmentType = form.employmentType;
    if (form.status !== undefined) set.status = form.status;
    if (form.dateOfJoining !== undefined) set.dateOfJoining = form.dateOfJoining ? new Date(form.dateOfJoining) : undefined;
    if (form.workLocation !== undefined) set.workLocation = form.workLocation.trim() || undefined;
    if (form.ctc !== undefined) set.ctc = typeof form.ctc === 'number' ? form.ctc : undefined;
    if (form.salaryStructureId !== undefined) set.salaryStructureId = form.salaryStructureId || undefined;
    if (form.pan !== undefined) set.pan = form.pan.trim() || undefined;
    if (form.uan !== undefined) set.uan = form.uan.trim() || undefined;
    if (form.bankAccountNo !== undefined) set.bankAccountNo = form.bankAccountNo.trim() || undefined;
    if (form.bankIfsc !== undefined) set.bankIfsc = form.bankIfsc.trim() || undefined;

    await employees.updateOne({ _id: existing._id }, { $set: set });
    const updated = await employees.findOne({ _id: existing._id });
    revalidatePath('/sabhrm/employees');
    return { ok: true, data: toRow(updated as EmployeeDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update employee.' };
  }
}

/* ── delete ──────────────────────────────────────────────────────────── */

export async function deleteEmployee(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid employee id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const res = await db
      .collection<EmployeeDoc>(SABHRM_COLLECTIONS.employees)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Employee not found.' };
    revalidatePath('/sabhrm/employees');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete employee.' };
  }
}

/* ── picker options for the form ─────────────────────────────────────── */

export interface EmployeePickerOptions {
  departments: Array<{ value: string; label: string }>;
  designations: Array<{ value: string; label: string }>;
  managers: Array<{ value: string; label: string }>;
  salaryStructures: Array<{ value: string; label: string }>;
}

export async function getEmployeePickerOptions(): Promise<ActionResult<EmployeePickerOptions>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;
  try {
    const [deps, dess, mgrs, sals] = await Promise.all([
      db.collection(SABHRM_COLLECTIONS.departments).find({ workspaceId }, { projection: { name: 1 } }).limit(500).toArray(),
      db.collection(SABHRM_COLLECTIONS.designations).find({ workspaceId }, { projection: { name: 1 } }).limit(500).toArray(),
      db.collection(SABHRM_COLLECTIONS.employees).find({ workspaceId }, { projection: { displayName: 1, firstName: 1, lastName: 1 } }).limit(1000).toArray(),
      db.collection(SABHRM_COLLECTIONS.salaryStructures).find({ workspaceId }, { projection: { name: 1 } }).limit(500).toArray(),
    ]);
    return {
      ok: true,
      data: {
        departments: deps.map((d) => ({ value: String(d._id), label: String((d as Record<string, unknown>).name) })),
        designations: dess.map((d) => ({ value: String(d._id), label: String((d as Record<string, unknown>).name) })),
        managers: mgrs.map((d) => {
          const r = d as Record<string, unknown>;
          return { value: String(r._id), label: String(r.displayName || `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim()) };
        }),
        salaryStructures: sals.map((d) => ({ value: String(d._id), label: String((d as Record<string, unknown>).name) })),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load options.' };
  }
}
