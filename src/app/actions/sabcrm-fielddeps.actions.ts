'use server';

/**
 * SabCRM — field dependencies (dependent picklists) server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/field-deps.server`. The `gate` / `fail`
 * helpers are copied verbatim from `sabcrm-scoring.actions.ts` (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`. Reads gate
 * `view`; config mutations gate `edit` (there is no `manage` capability —
 * config management is `edit`, same as `addFieldTw`).
 *
 *  - {@link listFieldDependenciesTw} / {@link saveFieldDependencyTw} /
 *    {@link deleteFieldDependencyTw} power the settings editor.
 *  - {@link getAllowedOptionsTw} powers the record form: given the controlling
 *    field's current value, it returns the filtered allow-list per dependent
 *    SELECT so the form can constrain its options live.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  listFieldDependencies,
  upsertFieldDependency,
  deleteFieldDependency,
  allowedOptionsFor,
  type FieldDependency,
  type FieldDependencyInput,
} from '@/lib/sabcrm/field-deps.server';

const MODULE_KEY = 'sabcrm';

interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

/** session → project membership → RBAC → plan (mirrors sabcrm-scoring.actions.ts). */
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
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }

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

/** List every field dependency in the active project. Gated on `view`. */
export async function listFieldDependenciesTw(
  projectId?: string,
): Promise<ActionResult<FieldDependency[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listFieldDependencies(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load field dependencies.');
  }
}

/**
 * Create or update a field dependency. Gated on `edit` (data-model management,
 * same as `addFieldTw`). The controlling/dependent fields must differ.
 */
export async function saveFieldDependencyTw(
  input: FieldDependencyInput,
  projectId?: string,
): Promise<ActionResult<FieldDependency>> {
  if (!input?.objectSlug) return { ok: false, error: 'An object is required.' };
  if (!input.controllingField?.trim()) {
    return { ok: false, error: 'A controlling field is required.' };
  }
  if (!input.dependentField?.trim()) {
    return { ok: false, error: 'A dependent field is required.' };
  }
  if (input.controllingField.trim() === input.dependentField.trim()) {
    return {
      ok: false,
      error: 'The controlling and dependent fields must be different.',
    };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const saved = await upsertFieldDependency(g.ctx.projectId, {
      ...input,
      controllingField: input.controllingField.trim(),
      dependentField: input.dependentField.trim(),
    });
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e, 'Failed to save field dependency.');
  }
}

/** Delete a field dependency by id. Gated on `edit`. */
export async function deleteFieldDependencyTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A dependency id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteFieldDependency(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Dependency not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete field dependency.');
  }
}

/**
 * The dependent values allowed when `controllingField` holds `value` — one
 * entry per dependent SELECT controlled by `controllingField`. The record form
 * calls this on controlling-field change to filter the dependent options live.
 * Gated on `view`.
 */
export async function getAllowedOptionsTw(
  object: string,
  controllingField: string,
  value: unknown,
  projectId?: string,
): Promise<ActionResult<{ dependentField: string; options: string[] }[]>> {
  if (!object) return { ok: false, error: 'An object is required.' };
  if (!controllingField) {
    return { ok: false, error: 'A controlling field is required.' };
  }
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await allowedOptionsFor(
        g.ctx.projectId,
        object,
        controllingField,
        value,
      ),
    };
  } catch (e) {
    return fail(e, 'Failed to load allowed options.');
  }
}
