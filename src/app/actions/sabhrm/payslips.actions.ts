'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  ListParams,
  Paginated,
  PayslipRow,
  PayslipStatus,
} from '@/lib/sabhrm/types';

/* ── doc shape (server-internal) ─────────────────────────────────────── */

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
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

function toRow(d: PayslipDoc): PayslipRow {
  return {
    id: String(d._id),
    payrollRunId: d.payrollRunId,
    employeeId: d.employeeId,
    employeeName: d.employeeName,
    periodLabel: d.periodLabel,
    gross: typeof d.gross === 'number' ? d.gross : 0,
    deductions: typeof d.deductions === 'number' ? d.deductions : 0,
    net: typeof d.net === 'number' ? d.net : 0,
    status: d.status,
  };
}

/* ── list ────────────────────────────────────────────────────────────── */

export async function listPayslips(
  params: ListParams = {},
): Promise<ActionResult<Paginated<PayslipRow>>> {
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
      filter.$or = [{ employeeName: rx }, { periodLabel: rx }];
    }

    const col = db.collection<PayslipDoc>(SABHRM_COLLECTIONS.payslips);
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
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load payslips.' };
  }
}

/* ── mark sent ───────────────────────────────────────────────────────── */

export async function markPayslipSent(id: string): Promise<ActionResult<PayslipRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid payslip id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const col = db.collection<PayslipDoc>(SABHRM_COLLECTIONS.payslips);
    const existing = await col.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Payslip not found.' };

    await col.updateOne(
      { _id: existing._id, workspaceId },
      { $set: { status: 'sent', sentAt: new Date(), updatedAt: new Date() } },
    );
    const updated = await col.findOne({ _id: existing._id, workspaceId });
    revalidatePath('/sabhrm/payslips');
    return { ok: true, data: toRow(updated as PayslipDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to mark payslip sent.' };
  }
}

/* ── delete ──────────────────────────────────────────────────────────── */

export async function deletePayslip(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid payslip id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const res = await db
      .collection<PayslipDoc>(SABHRM_COLLECTIONS.payslips)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Payslip not found.' };
    revalidatePath('/sabhrm/payslips');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete payslip.' };
  }
}
