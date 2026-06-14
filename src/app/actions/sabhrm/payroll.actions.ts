'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  PayrollRunRow,
  PayslipRow,
  PayrollStatus,
  PayslipStatus,
  ListParams,
  Paginated,
} from '@/lib/sabhrm/types';

/* ── doc shapes (server-internal) ────────────────────────────────────── */

interface PayrollRunDoc {
  _id: ObjectId;
  workspaceId: string;
  label: string;
  periodMonth: number; // 1-12
  periodYear: number;
  status: PayrollStatus;
  employeeCount: number;
  grossTotal: number;
  deductionTotal: number;
  netTotal: number;
  computedAt?: Date;
  approvedAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface PayslipDoc {
  _id: ObjectId;
  workspaceId: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  periodLabel: string;
  gross: number;
  deductions: number;
  net: number;
  status: PayslipStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Minimal active-employee shape we read for computation. */
interface ActiveEmployeeDoc {
  _id: ObjectId;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  ctc?: number;
}

/* ── form values (local — not in shared types) ───────────────────────── */

export interface PayrollRunFormValues {
  label: string;
  periodMonth: number; // 1-12
  periodYear: number;
}

/* ── helpers ─────────────────────────────────────────────────────────── */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function periodLabelOf(month: number, year: number): string {
  const m = MONTHS[Math.min(11, Math.max(0, month - 1))] ?? 'Jan';
  return `${m} ${year}`;
}

function toRunRow(d: PayrollRunDoc): PayrollRunRow {
  return {
    id: String(d._id),
    label: d.label,
    periodMonth: d.periodMonth,
    periodYear: d.periodYear,
    status: d.status,
    employeeCount: d.employeeCount ?? 0,
    grossTotal: d.grossTotal ?? 0,
    deductionTotal: d.deductionTotal ?? 0,
    netTotal: d.netTotal ?? 0,
    computedAt: d.computedAt ? d.computedAt.toISOString().slice(0, 10) : null,
    approvedAt: d.approvedAt ? d.approvedAt.toISOString().slice(0, 10) : null,
    paidAt: d.paidAt ? d.paidAt.toISOString().slice(0, 10) : null,
  };
}

function toPayslipRow(d: PayslipDoc): PayslipRow {
  return {
    id: String(d._id),
    payrollRunId: d.payrollRunId,
    employeeId: d.employeeId,
    employeeName: d.employeeName,
    periodLabel: d.periodLabel,
    gross: d.gross ?? 0,
    deductions: d.deductions ?? 0,
    net: d.net ?? 0,
    status: d.status,
  };
}

/* ── list ────────────────────────────────────────────────────────────── */

export async function listPayrollRuns(
  params: ListParams = {},
): Promise<ActionResult<Paginated<PayrollRunRow>>> {
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
      filter.$or = [{ label: rx }];
    }

    const col = db.collection<PayrollRunDoc>(SABHRM_COLLECTIONS.payrollRuns);
    const [docs, total] = await Promise.all([
      col
        .find(filter)
        .sort({ periodYear: -1, periodMonth: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      col.countDocuments(filter),
    ]);

    return {
      ok: true,
      data: {
        rows: docs.map(toRunRow),
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load payroll runs.' };
  }
}

/* ── get (run + its payslips) ────────────────────────────────────────── */

export interface PayrollRunDetail {
  run: PayrollRunRow;
  payslips: PayslipRow[];
}

export async function getPayrollRun(id: string): Promise<ActionResult<PayrollRunDetail>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid payroll run id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const run = await db
      .collection<PayrollRunDoc>(SABHRM_COLLECTIONS.payrollRuns)
      .findOne({ _id: new ObjectId(id), workspaceId });
    if (!run) return { ok: false, error: 'Payroll run not found.' };

    const slips = await db
      .collection<PayslipDoc>(SABHRM_COLLECTIONS.payslips)
      .find({ workspaceId, payrollRunId: id })
      .sort({ employeeName: 1 })
      .toArray();

    return {
      ok: true,
      data: {
        run: toRunRow(run),
        payslips: slips.map(toPayslipRow),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load payroll run.' };
  }
}

/* ── create ──────────────────────────────────────────────────────────── */

export async function createPayrollRun(
  form: PayrollRunFormValues,
): Promise<ActionResult<PayrollRunRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  const label = form.label?.trim();
  const periodMonth = Number(form.periodMonth);
  const periodYear = Number(form.periodYear);
  if (!label) return { ok: false, error: 'A label is required.' };
  if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
    return { ok: false, error: 'Select a valid month (1-12).' };
  }
  if (!Number.isInteger(periodYear) || periodYear < 2000 || periodYear > 2100) {
    return { ok: false, error: 'Enter a valid year.' };
  }

  try {
    const now = new Date();
    const doc: Omit<PayrollRunDoc, '_id'> = {
      workspaceId,
      label,
      periodMonth,
      periodYear,
      status: 'draft',
      employeeCount: 0,
      grossTotal: 0,
      deductionTotal: 0,
      netTotal: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };
    const ins = await db
      .collection<PayrollRunDoc>(SABHRM_COLLECTIONS.payrollRuns)
      .insertOne(doc as PayrollRunDoc);
    revalidatePath('/sabhrm/payroll-runs');
    revalidatePath('/sabhrm');
    return { ok: true, data: toRunRow({ ...(doc as PayrollRunDoc), _id: ins.insertedId }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create payroll run.' };
  }
}

/* ── compute ─────────────────────────────────────────────────────────── */

export async function computePayrollRun(id: string): Promise<ActionResult<PayrollRunRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid payroll run id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const runs = db.collection<PayrollRunDoc>(SABHRM_COLLECTIONS.payrollRuns);
    const run = await runs.findOne({ _id: new ObjectId(id), workspaceId });
    if (!run) return { ok: false, error: 'Payroll run not found.' };
    if (run.status === 'paid') return { ok: false, error: 'A paid run cannot be recomputed.' };

    const periodLabel = periodLabelOf(run.periodMonth, run.periodYear);

    const employees = (await db
      .collection<ActiveEmployeeDoc>(SABHRM_COLLECTIONS.employees)
      .find({ workspaceId, status: 'active' })
      .toArray()) as ActiveEmployeeDoc[];

    const payslips = db.collection<PayslipDoc>(SABHRM_COLLECTIONS.payslips);
    const now = new Date();

    let grossTotal = 0;
    let deductionTotal = 0;
    let netTotal = 0;

    for (const emp of employees) {
      const empId = String(emp._id);
      const employeeName =
        emp.displayName || `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim() || empId;
      const gross = Math.round((emp.ctc || 0) / 12);
      const deductions = 0;
      const net = gross - deductions;

      grossTotal += gross;
      deductionTotal += deductions;
      netTotal += net;

      await payslips.updateOne(
        { workspaceId, payrollRunId: id, employeeId: empId },
        {
          $set: {
            workspaceId,
            payrollRunId: id,
            employeeId: empId,
            employeeName,
            periodLabel,
            gross,
            deductions,
            net,
            status: 'generated' as PayslipStatus,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
    }

    await runs.updateOne(
      { _id: run._id, workspaceId },
      {
        $set: {
          employeeCount: employees.length,
          grossTotal,
          deductionTotal,
          netTotal,
          status: 'computed' as PayrollStatus,
          computedAt: now,
          updatedAt: now,
        },
      },
    );

    const updated = await runs.findOne({ _id: run._id, workspaceId });
    revalidatePath('/sabhrm/payroll-runs');
    revalidatePath(`/sabhrm/payroll-runs/${id}`);
    return { ok: true, data: toRunRow(updated as PayrollRunDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to compute payroll run.' };
  }
}

/* ── approve ─────────────────────────────────────────────────────────── */

export async function approvePayrollRun(id: string): Promise<ActionResult<PayrollRunRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid payroll run id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const runs = db.collection<PayrollRunDoc>(SABHRM_COLLECTIONS.payrollRuns);
    const run = await runs.findOne({ _id: new ObjectId(id), workspaceId });
    if (!run) return { ok: false, error: 'Payroll run not found.' };
    if (run.status !== 'computed') {
      return { ok: false, error: 'Only a computed run can be approved.' };
    }

    const now = new Date();
    await runs.updateOne(
      { _id: run._id, workspaceId },
      { $set: { status: 'approved' as PayrollStatus, approvedAt: now, updatedAt: now } },
    );

    const updated = await runs.findOne({ _id: run._id, workspaceId });
    revalidatePath('/sabhrm/payroll-runs');
    revalidatePath(`/sabhrm/payroll-runs/${id}`);
    return { ok: true, data: toRunRow(updated as PayrollRunDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to approve payroll run.' };
  }
}

/* ── disburse ────────────────────────────────────────────────────────── */

export async function disbursePayrollRun(id: string): Promise<ActionResult<PayrollRunRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid payroll run id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const runs = db.collection<PayrollRunDoc>(SABHRM_COLLECTIONS.payrollRuns);
    const run = await runs.findOne({ _id: new ObjectId(id), workspaceId });
    if (!run) return { ok: false, error: 'Payroll run not found.' };
    if (run.status !== 'approved') {
      return { ok: false, error: 'Only an approved run can be disbursed.' };
    }

    const now = new Date();
    await runs.updateOne(
      { _id: run._id, workspaceId },
      { $set: { status: 'paid' as PayrollStatus, paidAt: now, updatedAt: now } },
    );
    await db
      .collection<PayslipDoc>(SABHRM_COLLECTIONS.payslips)
      .updateMany(
        { workspaceId, payrollRunId: id },
        { $set: { status: 'sent' as PayslipStatus, updatedAt: now } },
      );

    const updated = await runs.findOne({ _id: run._id, workspaceId });
    revalidatePath('/sabhrm/payroll-runs');
    revalidatePath(`/sabhrm/payroll-runs/${id}`);
    return { ok: true, data: toRunRow(updated as PayrollRunDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to disburse payroll run.' };
  }
}

/* ── delete (run + its payslips) ─────────────────────────────────────── */

export async function deletePayrollRun(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid payroll run id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const res = await db
      .collection<PayrollRunDoc>(SABHRM_COLLECTIONS.payrollRuns)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Payroll run not found.' };
    await db
      .collection<PayslipDoc>(SABHRM_COLLECTIONS.payslips)
      .deleteMany({ workspaceId, payrollRunId: id });
    revalidatePath('/sabhrm/payroll-runs');
    revalidatePath('/sabhrm');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete payroll run.' };
  }
}
