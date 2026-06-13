'use server';

/**
 * SabCRM — formula fields server actions.
 *
 * Gated wrappers over `@/lib/sabcrm/formula.server`. Save provisions the target
 * field on the object (via the existing `addFieldTw` metadata path) and
 * recomputes the object's records so the formula takes effect immediately.
 * Gate/fail copied from `sabcrm-scoring.actions.ts`.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult, FieldMetadata, FieldType } from '@/lib/sabcrm/types';
import {
  listFormulas,
  upsertFormula,
  deleteFormula,
  recomputeFormulasForObject,
  type FormulaField,
  type FormulaFieldInput,
  type FormulaOutputType,
} from '@/lib/sabcrm/formula.server';
import { addFieldTw } from './sabcrm-objects.actions';

const MODULE_KEY = 'sabcrm';

interface SessionUser {
  _id: string;
}
interface GateContext {
  userId: string;
  projectId: string;
}
type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };
  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) return { ok: false, error: 'Permission denied.' };
  if (!(await canServer(MODULE_KEY, action, requested))) {
    return { ok: false, error: 'Permission denied.' };
  }
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }
  return { ok: true, ctx: { userId, projectId: requested } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) return { ok: false, error: e.message || fallback };
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

const OUTPUT_FIELD_TYPE: Record<FormulaOutputType, FieldType> = {
  NUMBER: 'NUMBER',
  TEXT: 'TEXT',
  BOOLEAN: 'BOOLEAN',
};

/** List all formula fields in the active project. Gated on `view`. */
export async function listFormulasTw(
  projectId?: string,
): Promise<ActionResult<FormulaField[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listFormulas(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load formulas.');
  }
}

async function ensureFormulaField(
  f: FormulaField,
  projectId: string,
): Promise<void> {
  const def: FieldMetadata = {
    key: f.fieldKey,
    label: f.name || f.fieldKey,
    type: OUTPUT_FIELD_TYPE[f.outputType] ?? 'NUMBER',
    icon: 'Sigma',
    inTable: true,
    description: `Formula: ${f.expression}`,
  };
  await addFieldTw(f.objectSlug, def, projectId).catch(() => undefined);
}

/** Create or update a formula field. Provisions the field + recomputes. Gated `edit`. */
export async function saveFormulaTw(
  input: FormulaFieldInput,
  projectId?: string,
): Promise<ActionResult<FormulaField>> {
  if (!input?.objectSlug) return { ok: false, error: 'An object is required.' };
  if (!input?.fieldKey?.trim()) return { ok: false, error: 'A field key is required.' };
  if (!input?.expression?.trim()) return { ok: false, error: 'An expression is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const saved = await upsertFormula(g.ctx.projectId, input);
    if (saved.enabled) {
      await ensureFormulaField(saved, g.ctx.projectId);
      await recomputeFormulasForObject(g.ctx.projectId, saved.objectSlug).catch(
        () => undefined,
      );
    }
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e, 'Failed to save formula.');
  }
}

/** Delete a formula field definition. Gated on `edit`. */
export async function deleteFormulaTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A formula id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteFormula(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Formula not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete formula.');
  }
}

/** Manually recompute all formulas for an object. Gated on `edit`. */
export async function recomputeFormulasTw(
  objectSlug: string,
  projectId?: string,
): Promise<ActionResult<{ scanned: number; updated: number }>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await recomputeFormulasForObject(g.ctx.projectId, objectSlug) };
  } catch (e) {
    return fail(e, 'Failed to recompute formulas.');
  }
}
