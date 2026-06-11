'use server';

/**
 * SabSheet pivots — server actions.
 *
 * Persists pivot configs bound to a workbook/sheet range. Follows the same Mongo +
 * session-scoping pattern as `sabsheet-charts.actions.ts`: every action requires a
 * session and is scoped to `ownerUserId = sessionUserId`.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

import {
  SABSHEET_PIVOTS_COLLECTION,
  type SabsheetPivot,
  type PivotConfigPersisted,
  type PivotRange,
  type PivotAgg,
} from '@/lib/sabsheet/pivot/types';

async function requireUserOid(): Promise<ObjectId> {
  const session = await getSession();
  if (!session?.user?._id) {
    throw new Error('SabSheet pivots: not authenticated');
  }
  return new ObjectId(session.user._id);
}

function toIso(d: unknown): string {
  if (d instanceof Date) return d.toISOString();
  if (d) return String(d);
  return new Date().toISOString();
}

const ALLOWED_AGGS: PivotAgg[] = ['sum', 'count', 'average', 'min', 'max'];

function normalizeAgg(a: unknown): PivotAgg {
  return ALLOWED_AGGS.includes(a as PivotAgg) ? (a as PivotAgg) : 'sum';
}

function normalizeColField(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pivotFromDoc(d: any): SabsheetPivot {
  return {
    _id: String(d._id),
    ownerUserId: String(d.ownerUserId),
    workbookId: String(d.workbookId),
    sheetId: String(d.sheetId),
    range: {
      top: d.range?.top ?? 1,
      left: d.range?.left ?? 1,
      bottom: d.range?.bottom ?? 1,
      right: d.range?.right ?? 1,
    },
    config: {
      rowField: Number(d.config?.rowField ?? 0),
      colField: normalizeColField(d.config?.colField),
      valueField: Number(d.config?.valueField ?? 0),
      agg: normalizeAgg(d.config?.agg),
    },
    createdAt: toIso(d.createdAt),
  };
}

/** All pivots for a workbook owned by the session user, newest first. */
export async function listPivots(workbookId: string): Promise<SabsheetPivot[]> {
  const userId = await requireUserOid();
  let wbOid: ObjectId;
  try {
    wbOid = new ObjectId(workbookId);
  } catch {
    return [];
  }
  const { db } = await connectToDatabase();
  const rows = await db
    .collection(SABSHEET_PIVOTS_COLLECTION)
    .find({ workbookId: wbOid, ownerUserId: userId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return rows.map(pivotFromDoc);
}

export interface CreatePivotInput {
  workbookId: string;
  sheetId: string;
  range: PivotRange;
  config: PivotConfigPersisted;
}

/** Persist a new pivot config. */
export async function createPivot(input: CreatePivotInput): Promise<SabsheetPivot> {
  const userId = await requireUserOid();
  const wbOid = new ObjectId(input.workbookId);
  const sheetOid = new ObjectId(input.sheetId);

  const now = new Date();
  const doc = {
    ownerUserId: userId,
    workbookId: wbOid,
    sheetId: sheetOid,
    range: {
      top: input.range.top,
      left: input.range.left,
      bottom: input.range.bottom,
      right: input.range.right,
    },
    config: {
      rowField: Number(input.config.rowField),
      colField: normalizeColField(input.config.colField),
      valueField: Number(input.config.valueField),
      agg: normalizeAgg(input.config.agg),
    },
    createdAt: now,
  };
  const { db } = await connectToDatabase();
  const r = await db.collection(SABSHEET_PIVOTS_COLLECTION).insertOne(doc);
  revalidatePath(`/dashboard/sabsheet/${input.workbookId}`);
  return pivotFromDoc({ _id: r.insertedId, ...doc });
}

/** Delete a pivot owned by the session user. */
export async function deletePivot(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserOid();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return { ok: false };
  }
  const { db } = await connectToDatabase();
  const res = await db
    .collection(SABSHEET_PIVOTS_COLLECTION)
    .deleteOne({ _id: oid, ownerUserId: userId });
  return { ok: res.deletedCount > 0 };
}
