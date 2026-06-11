'use server';

/**
 * SabSheet charts — server actions.
 *
 * Persists chart specs bound to a workbook/sheet range. Follows the same Mongo +
 * session-scoping pattern as `sabsheet.actions.ts`: every action requires a session
 * and is scoped to `ownerUserId = sessionUserId`.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

import {
  SABSHEET_CHARTS_COLLECTION,
  type SabsheetChart,
  type ChartSpec,
  type ChartRange,
} from '@/lib/sabsheet/charts/types';

async function requireUserOid(): Promise<ObjectId> {
  const session = await getSession();
  if (!session?.user?._id) {
    throw new Error('SabSheet charts: not authenticated');
  }
  return new ObjectId(session.user._id);
}

function toIso(d: unknown): string {
  if (d instanceof Date) return d.toISOString();
  if (d) return String(d);
  return new Date().toISOString();
}

function chartFromDoc(d: any): SabsheetChart {
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
    spec: {
      type: d.spec?.type ?? 'bar',
      title: d.spec?.title ?? undefined,
      headerRow: !!d.spec?.headerRow,
      headerCol: !!d.spec?.headerCol,
    },
    createdAt: toIso(d.createdAt),
  };
}

/** All charts for a workbook owned by the session user, newest first. */
export async function listCharts(workbookId: string): Promise<SabsheetChart[]> {
  const userId = await requireUserOid();
  let wbOid: ObjectId;
  try {
    wbOid = new ObjectId(workbookId);
  } catch {
    return [];
  }
  const { db } = await connectToDatabase();
  const rows = await db
    .collection(SABSHEET_CHARTS_COLLECTION)
    .find({ workbookId: wbOid, ownerUserId: userId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return rows.map(chartFromDoc);
}

export interface CreateChartInput {
  workbookId: string;
  sheetId: string;
  range: ChartRange;
  spec: ChartSpec;
}

/** Persist a new chart spec. */
export async function createChart(input: CreateChartInput): Promise<SabsheetChart> {
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
    spec: {
      type: input.spec.type,
      title: input.spec.title?.trim() || undefined,
      headerRow: !!input.spec.headerRow,
      headerCol: !!input.spec.headerCol,
    },
    createdAt: now,
  };
  const { db } = await connectToDatabase();
  const r = await db.collection(SABSHEET_CHARTS_COLLECTION).insertOne(doc);
  revalidatePath(`/dashboard/sabsheet/${input.workbookId}`);
  return chartFromDoc({ _id: r.insertedId, ...doc });
}

/** Delete a chart owned by the session user. */
export async function deleteChart(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserOid();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return { ok: false };
  }
  const { db } = await connectToDatabase();
  const res = await db
    .collection(SABSHEET_CHARTS_COLLECTION)
    .deleteOne({ _id: oid, ownerUserId: userId });
  return { ok: res.deletedCount > 0 };
}
