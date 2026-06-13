import 'server-only';

/**
 * SabCRM — formula fields runtime (server-only).
 *
 * Persists formula definitions in `sabcrm_formulas` (projectId-scoped, the
 * native config pattern of `./scoring.server.ts`) and recomputes a record's
 * formula values from sibling fields (pure eval in `./formula.ts`, re-exported
 * here). Values are written DIRECT to `sabcrm_records` as dotted `$set` paths
 * (`data.<fieldKey>` + `data.__formula.<fieldKey>` meta) with NO `updatedAt`
 * bump — same envelope as AI + scoring fields, so it never resets idle clocks
 * or re-triggers record-change workflows. Best-effort throughout.
 */

import { createHash } from 'crypto';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  evaluateFormula,
  formulaVariables,
  type FormulaOutputType,
} from './formula';

export {
  evaluateFormula,
  formulaVariables,
  coerceFormulaOutput,
  type FormulaOutputType,
  type FormulaSpec,
  type FormulaResult,
} from './formula';

const FORMULAS_COLL = 'sabcrm_formulas';
const RECORDS_COLL = 'sabcrm_records';
const MAX_RECORDS_PER_SWEEP = 1000;

/** A persisted formula field. */
export interface FormulaField {
  id: string;
  projectId: string;
  objectSlug: string;
  /** The field key the result is written to (must exist on the object). */
  fieldKey: string;
  name?: string;
  expression: string;
  outputType: FormulaOutputType;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FormulaFieldInput {
  id?: string;
  objectSlug: string;
  fieldKey: string;
  name?: string;
  expression: string;
  outputType: FormulaOutputType;
  enabled: boolean;
}

interface FormulaDoc {
  _id: ObjectId | string;
  projectId: string;
  objectSlug: string;
  fieldKey: string;
  name?: string;
  expression: string;
  outputType?: FormulaOutputType;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function toFormula(doc: FormulaDoc): FormulaField {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    objectSlug: doc.objectSlug,
    fieldKey: doc.fieldKey,
    name: doc.name,
    expression: doc.expression,
    outputType: (doc.outputType as FormulaOutputType) || 'NUMBER',
    enabled: doc.enabled !== false,
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/** sha256 (32 hex) over expression + referenced values — the dirty-check key. */
export function formulaInputsHash(
  formula: FormulaField,
  data: Record<string, unknown>,
): string {
  const values: Record<string, unknown> = {};
  for (const v of formulaVariables(formula.expression)) values[v] = data?.[v];
  return createHash('sha256')
    .update(JSON.stringify({ e: formula.expression, o: formula.outputType, values }))
    .digest('hex')
    .slice(0, 32);
}

/* -------------------------------------------------------------------------- */
/* CRUD                                                                        */
/* -------------------------------------------------------------------------- */

export async function listFormulas(projectId: string): Promise<FormulaField[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(FORMULAS_COLL)
    .find({ projectId })
    .sort({ updatedAt: -1 })
    .limit(300)
    .toArray()) as unknown as FormulaDoc[];
  return docs.map(toFormula);
}

export async function getFormula(
  projectId: string,
  id: string,
): Promise<FormulaField | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(FORMULAS_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as FormulaDoc | null;
  return doc ? toFormula(doc) : null;
}

export async function listEnabledFormulasForObject(
  projectId: string,
  objectSlug: string,
): Promise<FormulaField[]> {
  if (!projectId || !objectSlug) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(FORMULAS_COLL)
    .find({ projectId, objectSlug, enabled: { $ne: false } })
    .limit(100)
    .toArray()) as unknown as FormulaDoc[];
  return docs.map(toFormula);
}

export async function upsertFormula(
  projectId: string,
  input: FormulaFieldInput,
): Promise<FormulaField> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    objectSlug: input.objectSlug,
    fieldKey: input.fieldKey,
    name: input.name?.trim() || input.fieldKey,
    expression: input.expression ?? '',
    outputType: input.outputType || 'NUMBER',
    enabled: input.enabled !== false,
    updatedAt: now,
  };
  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(FORMULAS_COLL)
      .updateOne(
        { _id: new ObjectId(input.id), projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const saved = await getFormula(projectId, input.id);
    if (saved) return saved;
  }
  const res = await db
    .collection(FORMULAS_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toFormula({ _id: res.insertedId, projectId, createdAt: now, ...fields });
}

export async function deleteFormula(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(FORMULAS_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/* Recompute                                                                   */
/* -------------------------------------------------------------------------- */

function buildFormulaSet(
  formulas: FormulaField[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  const meta = (data.__formula ?? {}) as Record<
    string,
    { inputsHash?: string } | undefined
  >;
  for (const f of formulas) {
    const hash = formulaInputsHash(f, data);
    if (meta[f.fieldKey]?.inputsHash === hash) continue;
    const out = evaluateFormula(
      { expression: f.expression, outputType: f.outputType },
      data,
    );
    set[`data.__formula.${f.fieldKey}`] = {
      inputsHash: hash,
      computedAt: new Date().toISOString(),
      status: out.ok ? 'ready' : 'failed',
      error: out.ok ? null : out.error ?? 'error',
    };
    if (out.ok) set[`data.${f.fieldKey}`] = out.value;
  }
  return set;
}

/** Recompute every enabled formula for one record (no updatedAt bump). */
export async function recomputeFormulasForRecord(
  projectId: string,
  objectSlug: string,
  recordId: string,
): Promise<boolean> {
  try {
    if (!projectId || !objectSlug || !recordId || !ObjectId.isValid(recordId)) {
      return false;
    }
    const formulas = await listEnabledFormulasForObject(projectId, objectSlug);
    if (formulas.length === 0) return false;
    const { db } = await connectToDatabase();
    const rec = (await db
      .collection(RECORDS_COLL)
      .findOne({ _id: new ObjectId(recordId), projectId })) as {
      data?: Record<string, unknown>;
      deletedAt?: unknown;
    } | null;
    if (!rec || rec.deletedAt) return false;
    const set = buildFormulaSet(formulas, rec.data ?? {});
    if (Object.keys(set).length === 0) return false;
    await db
      .collection(RECORDS_COLL)
      .updateOne({ _id: new ObjectId(recordId), projectId }, { $set: set });
    return true;
  } catch {
    return false;
  }
}

/** Recompute formulas across up to `limit` records of an object. */
export async function recomputeFormulasForObject(
  projectId: string,
  objectSlug: string,
  limit = MAX_RECORDS_PER_SWEEP,
): Promise<{ scanned: number; updated: number }> {
  try {
    if (!projectId || !objectSlug) return { scanned: 0, updated: 0 };
    const formulas = await listEnabledFormulasForObject(projectId, objectSlug);
    if (formulas.length === 0) return { scanned: 0, updated: 0 };
    const { db } = await connectToDatabase();
    const recs = (await db
      .collection(RECORDS_COLL)
      .find({ projectId, object: objectSlug, deletedAt: { $in: [null] } })
      .limit(Math.min(limit, MAX_RECORDS_PER_SWEEP))
      .toArray()) as unknown as Array<{
      _id: ObjectId;
      data?: Record<string, unknown>;
    }>;
    let updated = 0;
    for (const rec of recs) {
      const set = buildFormulaSet(formulas, rec.data ?? {});
      if (Object.keys(set).length === 0) continue;
      await db
        .collection(RECORDS_COLL)
        .updateOne({ _id: rec._id, projectId }, { $set: set });
      updated += 1;
    }
    return { scanned: recs.length, updated };
  } catch {
    return { scanned: 0, updated: 0 };
  }
}

/** Recompute formulas for every object with enabled formulas in a project. */
export async function recomputeAllProjectFormulas(
  projectId: string,
  perObjectLimit = 500,
): Promise<Array<{ objectSlug: string; scanned: number; updated: number }>> {
  const out: Array<{ objectSlug: string; scanned: number; updated: number }> = [];
  try {
    const formulas = await listFormulas(projectId);
    const objects = [
      ...new Set(formulas.filter((f) => f.enabled).map((f) => f.objectSlug)),
    ];
    for (const objectSlug of objects) {
      out.push({
        objectSlug,
        ...(await recomputeFormulasForObject(projectId, objectSlug, perObjectLimit)),
      });
    }
  } catch {
    /* best-effort */
  }
  return out;
}

/** Used by the scheduler to discover projects with formulas. */
export async function listProjectsWithFormulas(
  db: import('mongodb').Db,
): Promise<string[]> {
  try {
    const ids = (await db
      .collection(FORMULAS_COLL)
      .distinct('projectId', { enabled: { $ne: false } })) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}
