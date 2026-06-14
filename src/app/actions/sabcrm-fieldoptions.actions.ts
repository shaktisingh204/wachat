'use server';

/**
 * SabCRM — value-set-backed field options server action.
 *
 * A SELECT / MULTI_SELECT field opts into a reusable global value-set by
 * storing the set id under its metadata `settings.valueSetId` (see
 * `@/lib/sabcrm/value-sets.server`). The record create/edit form renders a
 * field's options from `field.options`, which is unaware of that reference — so
 * this action resolves the EFFECTIVE options for one field:
 *
 *   - a field WITH `settings.valueSetId` → the set's ACTIVE values (deprecated
 *     values are excluded, so they stop appearing in new picks while existing
 *     records keep their stored scalar);
 *   - a field WITHOUT a reference → its own inline `field.options` unchanged.
 *
 * `resolveOptionsForFieldMetadata` is server-only, so it cannot be called from
 * the client surfaces directly; this thin gated wrapper exposes it. Field
 * metadata is read via the Rust object path (the two-store gotcha: object/field
 * metadata must come from the Rust engine, never native Mongo, or the
 * `settings` blob silently vanishes).
 *
 * The `gate` / `fail` helpers are copied from `sabcrm-scoring.actions.ts`
 * (session → project membership → RBAC `canServer('sabcrm', 'view')` → plan,
 * including the cross-tenant defense against a client-supplied `projectId`).
 *
 * Failure is non-fatal by design: the caller degrades to the field's own inline
 * options, so a missing set / engine outage never breaks the form.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult, FieldOption } from '@/lib/sabcrm/types';
import { sabcrmObjectsApi } from '@/lib/rust-client/sabcrm-objects';
import { resolveOptionsForFieldMetadata } from '@/lib/sabcrm/value-sets.server';

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

/**
 * Resolve the effective options for one field on one object. Gated on `view`.
 *
 * Returns the referenced value-set's ACTIVE options when the field carries a
 * `settings.valueSetId`, otherwise the field's own inline `options`. An unknown
 * `objectSlug` / `fieldKey` resolves to `[]` (the caller degrades to its own
 * static options).
 */
export async function getFieldOptionsTw(
  objectSlug: string,
  fieldKey: string,
  projectId?: string,
): Promise<ActionResult<FieldOption[]>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };
  if (!fieldKey) return { ok: false, error: 'A field is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    // Two-store gotcha: object/field metadata (incl. the `settings` blob that
    // carries `valueSetId`) MUST come from the Rust object path.
    const object = await sabcrmObjectsApi.get(objectSlug, g.ctx.projectId);
    const field = object.fields.find((f) => f.key === fieldKey);
    if (!field) return { ok: true, data: [] };
    const options = await resolveOptionsForFieldMetadata(g.ctx.projectId, field);
    return { ok: true, data: options };
  } catch (e) {
    return fail(e, 'Failed to load field options.');
  }
}
