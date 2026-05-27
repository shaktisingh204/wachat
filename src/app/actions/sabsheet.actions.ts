'use server';

/**
 * SabSheet — server actions.
 *
 * Routes Mongo by default, with an opt-in Rust path (`USE_RUST_SABSHEET=true`)
 * for environments running the Rust API gateway. The shapes match the Rust
 * DTOs so the switch is purely transport.
 *
 * Tenancy: every action requires a session (`getSession()`); reads are
 * scoped to `ownerUserId = sessionUserId` or `sharedWithUserIds` contains
 * the session user. Mutations require ownership.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

import type { SabsheetWorkbookDoc } from '@/lib/rust-client/sabsheet-workbooks';
import type { SabsheetSheetDoc } from '@/lib/rust-client/sabsheet-sheets';
import type {
  SabsheetCellDoc,
  SabsheetCellFormat,
  SabsheetEvaluateResponse,
} from '@/lib/rust-client/sabsheet-cells';
import type { SabsheetNamedRangeDoc } from '@/lib/rust-client/sabsheet-named-ranges';
import type {
  SabsheetPivotTableDoc,
  SabsheetPivotConfig,
} from '@/lib/rust-client/sabsheet-pivot-tables';
import type { SabsheetCommentDoc } from '@/lib/rust-client/sabsheet-comments';
import type { SabsheetVersionDoc } from '@/lib/rust-client/sabsheet-versions';

const COLL_WORKBOOKS = 'sabsheet_workbooks';
const COLL_SHEETS = 'sabsheet_sheets';
const COLL_CELLS = 'sabsheet_cells';
const COLL_NAMED_RANGES = 'sabsheet_named_ranges';
const COLL_PIVOTS = 'sabsheet_pivot_tables';
const COLL_COMMENTS = 'sabsheet_comments';
const COLL_VERSIONS = 'sabsheet_versions';

function useRust(): boolean {
  return process.env.USE_RUST_SABSHEET === 'true';
}

async function requireUserOid(): Promise<ObjectId> {
  const session = await getSession();
  if (!session?.user?._id) {
    throw new Error('SabSheet: not authenticated');
  }
  return new ObjectId(session.user._id);
}

function toIso(d: unknown): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

function workbookFromDoc(d: any): SabsheetWorkbookDoc {
  return {
    _id: String(d._id),
    ownerUserId: String(d.ownerUserId),
    title: d.title,
    sharedWithUserIds: (d.sharedWithUserIds ?? []).map((x: ObjectId) => String(x)),
    status: d.status ?? 'active',
    defaultSheetId: d.defaultSheetId ? String(d.defaultSheetId) : undefined,
    version: d.version ?? 1,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

function sheetFromDoc(d: any): SabsheetSheetDoc {
  return {
    _id: String(d._id),
    workbookId: String(d.workbookId),
    ownerUserId: String(d.ownerUserId),
    name: d.name,
    position: d.position ?? 0,
    rowCount: d.rowCount ?? 1000,
    colCount: d.colCount ?? 26,
    frozenRows: d.frozenRows ?? 0,
    frozenCols: d.frozenCols ?? 0,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

function cellFromDoc(d: any): SabsheetCellDoc {
  return {
    _id: String(d._id),
    sheetId: String(d.sheetId),
    workbookId: String(d.workbookId),
    ownerUserId: String(d.ownerUserId),
    row: d.row,
    col: d.col,
    value: d.value,
    formula: d.formula ?? undefined,
    formatJson: d.formatJson ?? undefined,
    dependsOn: (d.dependsOn ?? []).map((r: any) => ({
      sheetId: String(r.sheetId),
      row: r.row,
      col: r.col,
    })),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Workbooks
// ---------------------------------------------------------------------------

export async function listSabsheetWorkbooks(): Promise<SabsheetWorkbookDoc[]> {
  const userId = await requireUserOid();
  if (useRust()) {
    const { listSabsheetWorkbooks: rustList } = await import(
      '@/lib/rust-client/sabsheet-workbooks'
    );
    const r = await rustList({ status: 'active_visible' });
    return r.items;
  }
  const { db } = await connectToDatabase();
  const rows = await db
    .collection(COLL_WORKBOOKS)
    .find({
      status: { $ne: 'archived' },
      $or: [{ ownerUserId: userId }, { sharedWithUserIds: userId }],
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return rows.map(workbookFromDoc);
}

export async function createSabsheetWorkbook(input: {
  title: string;
  sharedWithUserIds?: string[];
}): Promise<SabsheetWorkbookDoc> {
  const userId = await requireUserOid();
  const title = input.title.trim();
  if (!title) throw new Error('title is required');
  const { db } = await connectToDatabase();

  const now = new Date();
  const wbResult = await db.collection(COLL_WORKBOOKS).insertOne({
    ownerUserId: userId,
    title,
    sharedWithUserIds: (input.sharedWithUserIds ?? [])
      .map((s) => {
        try {
          return new ObjectId(s);
        } catch {
          return null;
        }
      })
      .filter((x): x is ObjectId => !!x),
    status: 'active',
    version: 1,
    createdAt: now,
  });
  const workbookId = wbResult.insertedId;
  // Provision a default first sheet.
  const sheetResult = await db.collection(COLL_SHEETS).insertOne({
    workbookId,
    ownerUserId: userId,
    name: 'Sheet1',
    position: 0,
    rowCount: 1000,
    colCount: 26,
    frozenRows: 0,
    frozenCols: 0,
    createdAt: now,
  });
  await db
    .collection(COLL_WORKBOOKS)
    .updateOne({ _id: workbookId }, { $set: { defaultSheetId: sheetResult.insertedId } });

  revalidatePath('/dashboard/sabsheet');
  const fresh = await db.collection(COLL_WORKBOOKS).findOne({ _id: workbookId });
  return workbookFromDoc(fresh);
}

export async function getSabsheetWorkbook(
  workbookId: string,
): Promise<SabsheetWorkbookDoc | null> {
  const userId = await requireUserOid();
  let oid: ObjectId;
  try {
    oid = new ObjectId(workbookId);
  } catch {
    return null;
  }
  const { db } = await connectToDatabase();
  const row = await db.collection(COLL_WORKBOOKS).findOne({
    _id: oid,
    $or: [{ ownerUserId: userId }, { sharedWithUserIds: userId }],
  });
  return row ? workbookFromDoc(row) : null;
}

export async function updateSabsheetWorkbook(
  workbookId: string,
  patch: { title?: string; status?: 'active' | 'archived'; defaultSheetId?: string },
): Promise<SabsheetWorkbookDoc | null> {
  const userId = await requireUserOid();
  const oid = new ObjectId(workbookId);
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title && patch.title.trim()) set.title = patch.title.trim();
  if (patch.status) set.status = patch.status;
  if (patch.defaultSheetId) {
    try {
      set.defaultSheetId = new ObjectId(patch.defaultSheetId);
    } catch {
      /* ignore */
    }
  }
  const { db } = await connectToDatabase();
  await db
    .collection(COLL_WORKBOOKS)
    .updateOne({ _id: oid, ownerUserId: userId }, { $set: set, $inc: { version: 1 } });
  revalidatePath(`/dashboard/sabsheet/${workbookId}`);
  const fresh = await db.collection(COLL_WORKBOOKS).findOne({ _id: oid });
  return fresh ? workbookFromDoc(fresh) : null;
}

export async function archiveSabsheetWorkbook(workbookId: string): Promise<{ ok: boolean }> {
  await updateSabsheetWorkbook(workbookId, { status: 'archived' });
  revalidatePath('/dashboard/sabsheet');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

export async function listSabsheetSheets(workbookId: string): Promise<SabsheetSheetDoc[]> {
  const userId = await requireUserOid();
  let wbOid: ObjectId;
  try {
    wbOid = new ObjectId(workbookId);
  } catch {
    return [];
  }
  const { db } = await connectToDatabase();
  const rows = await db
    .collection(COLL_SHEETS)
    .find({ workbookId: wbOid, ownerUserId: userId })
    .sort({ position: 1, createdAt: 1 })
    .toArray();
  return rows.map(sheetFromDoc);
}

export async function createSabsheetSheet(input: {
  workbookId: string;
  name: string;
  position?: number;
}): Promise<SabsheetSheetDoc> {
  const userId = await requireUserOid();
  const name = input.name.trim();
  if (!name) throw new Error('name is required');
  const { db } = await connectToDatabase();
  const wbOid = new ObjectId(input.workbookId);
  const now = new Date();
  const r = await db.collection(COLL_SHEETS).insertOne({
    workbookId: wbOid,
    ownerUserId: userId,
    name,
    position: input.position ?? 0,
    rowCount: 1000,
    colCount: 26,
    frozenRows: 0,
    frozenCols: 0,
    createdAt: now,
  });
  revalidatePath(`/dashboard/sabsheet/${input.workbookId}`);
  const fresh = await db.collection(COLL_SHEETS).findOne({ _id: r.insertedId });
  return sheetFromDoc(fresh);
}

export async function deleteSabsheetSheet(sheetId: string): Promise<{ ok: boolean }> {
  const userId = await requireUserOid();
  const oid = new ObjectId(sheetId);
  const { db } = await connectToDatabase();
  await db.collection(COLL_SHEETS).deleteOne({ _id: oid, ownerUserId: userId });
  // Cascade — drop cells/comments/presence for this sheet.
  await Promise.all([
    db.collection(COLL_CELLS).deleteMany({ sheetId: oid, ownerUserId: userId }),
    db.collection(COLL_COMMENTS).deleteMany({ sheetId: oid, ownerUserId: userId }),
  ]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

export async function listSabsheetCells(sheetId: string): Promise<SabsheetCellDoc[]> {
  const userId = await requireUserOid();
  let oid: ObjectId;
  try {
    oid = new ObjectId(sheetId);
  } catch {
    return [];
  }
  const { db } = await connectToDatabase();
  const rows = await db
    .collection(COLL_CELLS)
    .find({ sheetId: oid, ownerUserId: userId })
    .toArray();
  return rows.map(cellFromDoc);
}

/**
 * Set a cell value or formula.
 *
 * If `valueOrFormula` starts with `=` we route through the Rust evaluator
 * (when enabled). Otherwise the value is stored as-is — number if numeric,
 * boolean for TRUE/FALSE, text otherwise.
 */
export async function setSabsheetCell(
  sheetId: string,
  row: number,
  col: number,
  valueOrFormula: string | null,
  format?: SabsheetCellFormat,
): Promise<SabsheetCellDoc> {
  const userId = await requireUserOid();
  if (useRust()) {
    const { setSabsheetCellRust } = await import('@/lib/rust-client/sabsheet-cells');
    const r = await setSabsheetCellRust({ sheetId, row, col, valueOrFormula, format });
    return r.entity;
  }
  const { db } = await connectToDatabase();
  const sheetOid = new ObjectId(sheetId);
  const sheet = await db
    .collection(COLL_SHEETS)
    .findOne({ _id: sheetOid, ownerUserId: userId });
  if (!sheet) throw new Error('SabSheet: sheet not found');
  const workbookId = sheet.workbookId as ObjectId;

  let value: number | string | boolean | null = null;
  let formula: string | null = null;
  if (valueOrFormula == null || valueOrFormula === '') {
    value = null;
  } else if (valueOrFormula.startsWith('=')) {
    formula = valueOrFormula.slice(1);
    // TODO(formula): the JS path doesn't yet evaluate formulas — we store
    // the raw text and rely on `recomputeSabsheetFormulas` via the Rust
    // engine once `USE_RUST_SABSHEET=true`. For now, display the formula
    // source as the value placeholder so the grid still shows something.
    value = valueOrFormula;
  } else {
    const trimmed = valueOrFormula.trim();
    const asNum = Number(trimmed);
    if (trimmed !== '' && !Number.isNaN(asNum)) {
      value = asNum;
    } else if (trimmed.toUpperCase() === 'TRUE') {
      value = true;
    } else if (trimmed.toUpperCase() === 'FALSE') {
      value = false;
    } else {
      value = valueOrFormula;
    }
  }

  const now = new Date();
  await db.collection(COLL_CELLS).updateOne(
    { sheetId: sheetOid, ownerUserId: userId, row, col },
    {
      $set: {
        sheetId: sheetOid,
        workbookId,
        ownerUserId: userId,
        row,
        col,
        value,
        formula,
        ...(format ? { formatJson: format } : {}),
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  const fresh = await db
    .collection(COLL_CELLS)
    .findOne({ sheetId: sheetOid, ownerUserId: userId, row, col });
  return cellFromDoc(fresh);
}

export async function evaluateSabsheetFormula(
  workbookId: string,
  formula: string,
): Promise<SabsheetEvaluateResponse> {
  await requireUserOid();
  if (useRust()) {
    const { evaluateSabsheetFormulaRust } = await import('@/lib/rust-client/sabsheet-cells');
    return evaluateSabsheetFormulaRust({ workbookId, formula });
  }
  // TODO(formula): no JS evaluator yet — return a placeholder. The Rust
  // path is the canonical implementation; flip USE_RUST_SABSHEET=true.
  return {
    display: '#TODO(formula)',
    kind: 'error',
    error: 'JS formula evaluator not implemented — set USE_RUST_SABSHEET=true.',
  };
}

export async function recomputeSabsheetFormulas(
  workbookId: string,
): Promise<{ recomputed: number }> {
  await requireUserOid();
  if (useRust()) {
    const { recomputeSabsheetWorkbookRust } = await import('@/lib/rust-client/sabsheet-cells');
    return recomputeSabsheetWorkbookRust(workbookId);
  }
  return { recomputed: 0 };
}

// ---------------------------------------------------------------------------
// Named ranges
// ---------------------------------------------------------------------------

export async function listSabsheetNamedRanges(
  workbookId: string,
): Promise<SabsheetNamedRangeDoc[]> {
  const userId = await requireUserOid();
  const { db } = await connectToDatabase();
  let wbOid: ObjectId;
  try {
    wbOid = new ObjectId(workbookId);
  } catch {
    return [];
  }
  const rows = await db
    .collection(COLL_NAMED_RANGES)
    .find({ workbookId: wbOid, ownerUserId: userId })
    .toArray();
  return rows.map((d: any) => ({
    _id: String(d._id),
    workbookId: String(d.workbookId),
    ownerUserId: String(d.ownerUserId),
    name: d.name,
    sheetId: String(d.sheetId),
    startRow: d.startRow,
    startCol: d.startCol,
    endRow: d.endRow,
    endCol: d.endCol,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  }));
}

export async function createSabsheetNamedRange(input: {
  workbookId: string;
  name: string;
  sheetId: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}): Promise<{ ok: true; id: string }> {
  const userId = await requireUserOid();
  const { db } = await connectToDatabase();
  const r = await db.collection(COLL_NAMED_RANGES).insertOne({
    workbookId: new ObjectId(input.workbookId),
    ownerUserId: userId,
    name: input.name.trim(),
    sheetId: new ObjectId(input.sheetId),
    startRow: input.startRow,
    startCol: input.startCol,
    endRow: input.endRow,
    endCol: input.endCol,
    createdAt: new Date(),
  });
  revalidatePath(`/dashboard/sabsheet/${input.workbookId}`);
  return { ok: true, id: String(r.insertedId) };
}

export async function deleteSabsheetNamedRange(id: string): Promise<{ ok: true }> {
  const userId = await requireUserOid();
  const { db } = await connectToDatabase();
  await db
    .collection(COLL_NAMED_RANGES)
    .deleteOne({ _id: new ObjectId(id), ownerUserId: userId });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pivot tables
// ---------------------------------------------------------------------------

export async function listSabsheetPivotTables(
  workbookId: string,
): Promise<SabsheetPivotTableDoc[]> {
  const userId = await requireUserOid();
  const { db } = await connectToDatabase();
  let wbOid: ObjectId;
  try {
    wbOid = new ObjectId(workbookId);
  } catch {
    return [];
  }
  const rows = await db
    .collection(COLL_PIVOTS)
    .find({ workbookId: wbOid, ownerUserId: userId })
    .toArray();
  return rows.map((d: any) => ({
    _id: String(d._id),
    sheetId: String(d.sheetId),
    workbookId: String(d.workbookId),
    ownerUserId: String(d.ownerUserId),
    name: d.name,
    sourceRange: d.sourceRange,
    configJson: d.configJson,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  }));
}

export async function createSabsheetPivotTable(input: {
  workbookId: string;
  sheetId: string;
  name: string;
  sourceRange: string;
  configJson?: SabsheetPivotConfig;
}): Promise<{ ok: true; id: string }> {
  const userId = await requireUserOid();
  const { db } = await connectToDatabase();
  const r = await db.collection(COLL_PIVOTS).insertOne({
    workbookId: new ObjectId(input.workbookId),
    sheetId: new ObjectId(input.sheetId),
    ownerUserId: userId,
    name: input.name.trim(),
    sourceRange: input.sourceRange,
    configJson: input.configJson ?? {},
    createdAt: new Date(),
  });
  revalidatePath(`/dashboard/sabsheet/${input.workbookId}`);
  return { ok: true, id: String(r.insertedId) };
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function listSabsheetComments(
  workbookId: string,
  opts?: { sheetId?: string; includeResolved?: boolean },
): Promise<SabsheetCommentDoc[]> {
  const userId = await requireUserOid();
  const { db } = await connectToDatabase();
  let wbOid: ObjectId;
  try {
    wbOid = new ObjectId(workbookId);
  } catch {
    return [];
  }
  const filter: Record<string, unknown> = { workbookId: wbOid, ownerUserId: userId };
  if (opts?.sheetId) {
    try {
      filter.sheetId = new ObjectId(opts.sheetId);
    } catch {
      /* ignore */
    }
  }
  if (!opts?.includeResolved) filter.resolved = { $ne: true };
  const rows = await db.collection(COLL_COMMENTS).find(filter).toArray();
  return rows.map((d: any) => ({
    _id: String(d._id),
    sheetId: String(d.sheetId),
    workbookId: String(d.workbookId),
    ownerUserId: String(d.ownerUserId),
    row: d.row,
    col: d.col,
    authorUserId: String(d.authorUserId),
    body: d.body,
    resolved: !!d.resolved,
    parentCommentId: d.parentCommentId ? String(d.parentCommentId) : undefined,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  }));
}

export async function addSabsheetComment(input: {
  workbookId: string;
  sheetId: string;
  row: number;
  col: number;
  body: string;
  parentCommentId?: string;
}): Promise<{ ok: true; id: string }> {
  const userId = await requireUserOid();
  const body = input.body.trim();
  if (!body) throw new Error('body is required');
  const { db } = await connectToDatabase();
  const r = await db.collection(COLL_COMMENTS).insertOne({
    workbookId: new ObjectId(input.workbookId),
    sheetId: new ObjectId(input.sheetId),
    ownerUserId: userId,
    authorUserId: userId,
    row: input.row,
    col: input.col,
    body,
    resolved: false,
    parentCommentId: input.parentCommentId ? new ObjectId(input.parentCommentId) : undefined,
    createdAt: new Date(),
  });
  revalidatePath(`/dashboard/sabsheet/${input.workbookId}`);
  return { ok: true, id: String(r.insertedId) };
}

export async function resolveSabsheetComment(commentId: string): Promise<{ ok: true }> {
  const userId = await requireUserOid();
  const { db } = await connectToDatabase();
  await db
    .collection(COLL_COMMENTS)
    .updateOne(
      { _id: new ObjectId(commentId), ownerUserId: userId },
      { $set: { resolved: true, updatedAt: new Date() } },
    );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export async function listSabsheetVersions(
  workbookId: string,
): Promise<SabsheetVersionDoc[]> {
  const userId = await requireUserOid();
  const { db } = await connectToDatabase();
  let wbOid: ObjectId;
  try {
    wbOid = new ObjectId(workbookId);
  } catch {
    return [];
  }
  const rows = await db
    .collection(COLL_VERSIONS)
    .find({ workbookId: wbOid, ownerUserId: userId })
    .sort({ version: -1 })
    .limit(100)
    .toArray();
  return rows.map((d: any) => ({
    _id: String(d._id),
    workbookId: String(d.workbookId),
    ownerUserId: String(d.ownerUserId),
    version: d.version,
    savedAt: toIso(d.savedAt) ?? new Date().toISOString(),
    savedBy: String(d.savedBy),
    comment: d.comment ?? undefined,
    snapshotFileId: d.snapshotFileId ? String(d.snapshotFileId) : undefined,
  }));
}

export async function saveSabsheetVersion(
  workbookId: string,
  comment?: string,
): Promise<{ ok: true; id: string; version: number }> {
  const userId = await requireUserOid();
  const { db } = await connectToDatabase();
  const wbOid = new ObjectId(workbookId);
  const last = await db
    .collection(COLL_VERSIONS)
    .find({ workbookId: wbOid, ownerUserId: userId })
    .sort({ version: -1 })
    .limit(1)
    .toArray();
  const version = (last[0]?.version ?? 0) + 1;
  // TODO(snapshot): dump the workbook (sheets + cells + named ranges +
  // pivots) to SabFiles and store the resulting fileId here. Until that's
  // wired, we record the metadata only.
  const r = await db.collection(COLL_VERSIONS).insertOne({
    workbookId: wbOid,
    ownerUserId: userId,
    version,
    savedAt: new Date(),
    savedBy: userId,
    comment: comment?.trim() || undefined,
  });
  revalidatePath(`/dashboard/sabsheet/${workbookId}/history`);
  return { ok: true, id: String(r.insertedId), version };
}

export async function restoreSabsheetVersion(versionId: string): Promise<{ ok: true }> {
  await requireUserOid();
  // TODO(snapshot-restore): load snapshotFileId from SabFiles, parse JSON,
  // and replay into cells/sheets. For now this is metadata-only — UI shows
  // the restore as "scheduled".
  return { ok: true };
}
