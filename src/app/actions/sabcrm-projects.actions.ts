'use server';

/**
 * SabCRM — Projects object seeding.
 *
 * Projects is registered as a CUSTOM data-model object (slug `projects`) rather
 * than a hard-coded standard one, so it requires NO Rust change: the Rust object
 * merge always includes DB-persisted custom objects, and record CRUD routes
 * through the generic `sabcrm_records` surface keyed by `{ projectId, object }`.
 *
 * {@link ensureProjectsObjectTw} is idempotent — it checks the merged object
 * list first and only creates the object when it is absent. Creation goes
 * through {@link createObjectTw}, which gates on `edit` (admin); a viewer who
 * lands on the page before an admin has seeded it gets a clean "not ready yet"
 * result instead of a crash.
 */

import type { ActionResult } from '@/lib/sabcrm/types';
import {
  listObjectsTw,
  createObjectTw,
  updateObjectTw,
} from '@/app/actions/sabcrm-objects.actions';
import { PROJECTS_OBJECT, PROJECTS_SLUG } from '@/lib/sabcrm/projects-object';

/** Outcome of an ensure call: whether the object already existed or was created. */
export interface EnsureProjectsResult {
  /** True once the `projects` object exists in the data model. */
  ready: boolean;
  /** True only when THIS call created it (vs. it already being present). */
  created: boolean;
}

/**
 * Idempotently ensure the `projects` object exists for the active project.
 *
 * Returns `{ ready: true }` when the object is present (created now or already
 * there). Returns `{ ok: false }` when the object is missing AND creation failed
 * — most commonly because the caller lacks `edit` rights; the page surfaces this
 * as a calm "ask an admin to enable Projects" state.
 */
export async function ensureProjectsObjectTw(
  projectId?: string,
): Promise<ActionResult<EnsureProjectsResult>> {
  const list = await listObjectsTw(projectId);
  if (!list.ok) return { ok: false, error: list.error };

  const existing = list.data.find((o) => o.slug === PROJECTS_SLUG);
  if (existing) {
    // Idempotent schema reconcile: append any canonical fields the stored
    // object is missing (e.g. the account / contact / deal relations added
    // after this project first seeded). Additive only — existing fields and
    // any user customisations are preserved, and record `data` is untouched.
    const have = new Set(existing.fields.map((f) => f.key));
    const missing = PROJECTS_OBJECT.fields.filter((f) => !have.has(f.key));
    if (missing.length > 0) {
      const patched = await updateObjectTw(
        PROJECTS_SLUG,
        { fields: [...existing.fields, ...missing] },
        projectId,
      );
      if (!patched.ok) return { ok: false, error: patched.error };
    }
    return { ok: true, data: { ready: true, created: false } };
  }

  const created = await createObjectTw(PROJECTS_OBJECT, projectId);
  if (!created.ok) return { ok: false, error: created.error };

  return { ok: true, data: { ready: true, created: true } };
}
