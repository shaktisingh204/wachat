'use server';

/**
 * SabCRM — Twenty UI slice server actions.
 *
 * Thin, gated wrappers over the Rust records engine
 * ({@link sabcrmRecordsApi} in `@/lib/rust-client/sabcrm-records`). These power
 * the Twenty-faithful index + detail pages under `/sabcrm/[objectSlug]`.
 *
 * Every action follows the SAME pipeline as the native `sabcrm.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *      (defense-in-depth against the fail-open RBAC resolver)
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown value
 * is normalised into `{ ok: false, error }` so the UI can degrade gracefully
 * (empty/error states) and never crashes.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import {
  getCachedSession,
  getCachedProjects,
  invalidateProjectsCache,
} from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmRecordsApi } from '@/lib/rust-client/sabcrm-records';
import { sabcrmObjectsApi } from '@/lib/rust-client/sabcrm-objects';
import { sabcrmActivitiesApi } from '@/lib/rust-client/sabcrm-activities';
import { sabcrmFavoritesApi } from '@/lib/rust-client/sabcrm-favorites';
import {
  recordAudit,
  maybeNotifyAssignment,
  runWorkflowsForEvent,
  runRecordChangeWorkflows,
  patchTouchesChangeFields,
} from '@/lib/sabcrm/runtime';
import { recomputeScoresForRecord } from '@/lib/sabcrm/scoring.server';
import { recomputeFormulasForRecord } from '@/lib/sabcrm/formula.server';
import {
  indexEmbeddingForRecord,
  deleteEmbeddingForRecord,
} from '@/lib/sabcrm/embeddings.server';
import { recomputeRollupsAround } from '@/lib/sabcrm/rollup.server';
import { scoreWinForRecord } from '@/lib/sabcrm/predictive-scoring.server';
import {
  validateRecordWrite,
  reparentInboundRelations,
} from '@/lib/sabcrm/data-quality.server';
import type {
  SabcrmRustActivity,
  SabcrmComment,
} from '@/lib/rust-client/sabcrm-activities';
import type { SabcrmRustFavorite } from '@/lib/rust-client/sabcrm-favorites';
import { ensureStandardObjects, getObject } from '@/lib/sabcrm/objects.server';
import { sabcrmRecordLabel } from '@/lib/sabcrm/record-label';
import { normalizePhoneFields } from '@/lib/sabcrm/phone';
import type { ActionResult, ObjectMetadata } from '@/lib/sabcrm/types';
import type {
  ListSabcrmRecordsTwParams,
  CountSabcrmRecordsTwParams,
  AggregateSabcrmRecordsTwParams,
  SabcrmRecordsTwPage,
  SabcrmRecordOption,
  SabcrmRecordTwGroups,
  SabcrmRecordTwAggregate,
  SabcrmRecordDuplicateGroup,
  SabcrmRustRecord,
  RecordRelation,
  ListSabcrmActivitiesTwParams,
  CreateSabcrmActivityTwInput,
  UpdateSabcrmActivityTwPatch,
} from './sabcrm-twenty.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Base path revalidated after mutations so the Twenty UI re-fetches. */
const TW_BASE_PATH = '/sabcrm';

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `sabcrm.actions.ts` verbatim, including the cross-tenant defense
 * against a client-supplied `explicitProjectId`.
 */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — only accept a projectId that belongs to THIS user
  // (the shared RBAC resolver fails open for non-members; deny instead).
  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }
  const projectId = requested;

  // 3. RBAC
  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/** Normalises a thrown value (incl. {@link RustApiError}) into an error result. */
function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

// ---------------------------------------------------------------------------
// Object metadata
// ---------------------------------------------------------------------------

/**
 * Lists the standard + custom objects for the active project.
 *
 * Reads the catalogue from the Rust objects engine
 * ({@link sabcrmObjectsApi.list}), which merges the Twenty-parity standard
 * objects — including the `workspaceMembers` member-directory object that backs
 * the `accountOwner` / `owner` / `assignee` RELATION targets — with the
 * project's custom objects + extension fields. The native seed
 * ({@link ensureStandardObjects}) still runs first so the custom-object docs
 * exist for the merge, but `workspaceMembers` is only present in the Rust
 * standard set, so it is surfaced here as a first-class selectable object.
 *
 * The Rust client's `ObjectMetadata` is a superset of the native
 * {@link ObjectMetadata} (`@/lib/sabcrm/types`), so the result is assignable to
 * the same envelope the Twenty pages already consume.
 */
export async function listSabcrmObjectsTw(
  projectId?: string,
): Promise<ActionResult<ObjectMetadata[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    // Idempotent seed so the custom-object docs exist before the Rust merge.
    await ensureStandardObjects(g.ctx.projectId);
    const data = await sabcrmObjectsApi.list(g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list objects.');
  }
}

// ---------------------------------------------------------------------------
// Records — via the Rust engine
// ---------------------------------------------------------------------------

/**
 * Lists / searches / paginates records of an object through the Rust engine.
 *
 * When `enrich` is `true`, the engine's `?enrich=relations` pass runs and every
 * returned record gains parallel top-level `__relations` (MANY_TO_ONE RELATION
 * fieldKey → `{ id, label, avatarUrl? }`) + `__actors` (`createdBy` → the same
 * hint) maps, so list cells can render resolved relation labels/avatars + the
 * creator's name without N extra round-trips. Omitted / `false` → raw ids only
 * (legacy shape), so existing callers are unaffected.
 */
export async function listSabcrmRecordsTw(
  object: string,
  params: ListSabcrmRecordsTwParams = {},
  projectId?: string,
  enrich?: boolean,
): Promise<ActionResult<SabcrmRecordsTwPage>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.list(object, {
      projectId: g.ctx.projectId,
      q: params.q,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
      page: params.page,
      limit: params.limit,
      filters: params.filters,
      enrich,
    });
    return { ok: true, data: { records: res.records, total: res.total } };
  } catch (e) {
    return fail(e, 'Failed to list records.');
  }
}

/**
 * Relation-picker search over the Rust records engine.
 *
 * Returns lightweight `{ id, label }` options for an object (people, companies,
 * leads, workspaceMembers, …), with the label computed server-side via
 * {@link sabcrmRecordLabel} so a raw record id never reaches the client. This is
 * the SAME store + label path {@link listSabcrmRecordsTw} (and RecordSurface's
 * relation resolver) use — deliberately NOT the native-Mongo
 * `searchRecordsForPickerAction`, which is `userId`-scoped and can miss
 * teammates' records (the two-store gotcha). Reusable for every CRM relation
 * picker (Tasks / Notes / Projects).
 */
export async function searchSabcrmRecordOptionsTw(
  object: string,
  q: string,
  limit = 20,
  projectId?: string,
): Promise<ActionResult<SabcrmRecordOption[]>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const objectMeta = await getObject(g.ctx.projectId, object);
    if (!objectMeta) return { ok: false, error: `Unknown object: ${object}` };

    const res = await sabcrmRecordsApi.list(object, {
      projectId: g.ctx.projectId,
      q: q?.trim() || undefined,
      limit: Math.min(50, Math.max(1, limit)),
      sortBy: 'updatedAt',
      sortDir: 'desc',
    });

    return {
      ok: true,
      data: res.records.map((r) => ({
        id: r.id,
        label: sabcrmRecordLabel(objectMeta, r),
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search records.');
  }
}

/**
 * Counts records of an object matching the active `q` + `filters` predicate
 * (the SAME filter {@link listSabcrmRecordsTw} builds, minus pagination/sort).
 * Gated on `view`, mirroring the list action's pipeline.
 */
export async function countSabcrmRecordsTw(
  object: string,
  params: CountSabcrmRecordsTwParams = {},
  projectId?: string,
): Promise<ActionResult<{ count: number }>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.count(object, {
      projectId: g.ctx.projectId,
      q: params.q,
      filters: params.filters,
    });
    return { ok: true, data: { count: res.count } };
  } catch (e) {
    return fail(e, 'Failed to count records.');
  }
}

/**
 * Lists records of `object` whose `data.<fieldKey>` equals `value`. A thin
 * convenience over {@link listSabcrmRecordsTw} for relations panels (e.g. the
 * people linked to a company by their `companyId`). Equality is expressed via
 * the engine's structured `filters` capability.
 */
export async function listRelatedSabcrmRecordsTw(
  object: string,
  fieldKey: string,
  value: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRecordsTwPage>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!fieldKey) return { ok: false, error: 'A field key is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.list(object, {
      projectId: g.ctx.projectId,
      filters: { [fieldKey]: value },
    });
    return { ok: true, data: { records: res.records, total: res.total } };
  } catch (e) {
    return fail(e, 'Failed to list related records.');
  }
}

/**
 * Fetches a single record by id through the Rust engine. When `enrich` is
 * `true`, the record carries the parallel `__relations` + `__actors` hint maps
 * (resolved RELATION labels/avatars + the `createdBy` ACTOR name) described on
 * {@link listSabcrmRecordsTw}; omitted / `false` → raw ids only.
 */
export async function getSabcrmRecordTw(
  object: string,
  id: string,
  projectId?: string,
  enrich?: boolean,
): Promise<ActionResult<SabcrmRustRecord>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!id) return { ok: false, error: 'Record id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmRecordsApi.get(object, id, g.ctx.projectId, enrich);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load record.');
  }
}

/** A minimal display reference for a record (used by the client name resolver). */
export interface SabcrmRecordRefDto {
  id: string;
  label: string;
  avatarUrl?: string;
}

/** Slug-based person detection (mirrors the directory resolver). */
function isPersonSlugTw(slug: string): boolean {
  return /people|person|contact/i.test(slug) || /member|workspace/i.test(slug);
}

/** First non-empty trimmed string among candidates. */
function firstStrTw(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/**
 * Resolves a batch of record ids (of ONE object) to minimal display refs
 * `{ id, label, avatarUrl }` — people as their FULL name. Powers the client
 * record resolver's ON-DEMAND path, so relation ids render as names regardless
 * of how many records the workspace holds (no pre-load cap). The relation ids
 * actually referenced on a page are resolved in one batched call; the server
 * fans out to the Rust engine in parallel.
 */
export async function resolveSabcrmRefsTw(
  object: string,
  ids: string[],
  projectId?: string,
): Promise<ActionResult<SabcrmRecordRefDto[]>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  const unique = [...new Set((ids ?? []).filter(Boolean))].slice(0, 100);
  if (unique.length === 0) return { ok: true, data: [] };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const person = isPersonSlugTw(object);
  const avatarKey = /compan/i.test(object) ? 'logoUrl' : person ? 'avatarUrl' : null;

  try {
    const results = await Promise.all(
      unique.map((id) =>
        sabcrmRecordsApi
          .get(object, id, g.ctx.projectId)
          .then((rec): SabcrmRecordRefDto | null => {
            const data = (rec?.data ?? {}) as Record<string, unknown>;
            const label = person
              ? firstStrTw(
                  [firstStrTw(data.firstName), firstStrTw(data.lastName)]
                    .filter(Boolean)
                    .join(' '),
                  data.name,
                  data.email,
                )
              : firstStrTw(data.name, data.title, data.firstName, data.email);
            if (!label) return null;
            const avatarUrl = avatarKey ? firstStrTw(data[avatarKey]) : '';
            return { id, label, avatarUrl: avatarUrl || undefined };
          })
          .catch(() => null),
      ),
    );
    return {
      ok: true,
      data: results.filter((r): r is SabcrmRecordRefDto => r !== null),
    };
  } catch (e) {
    return fail(e, 'Failed to resolve records.');
  }
}

/**
 * Loads every related record for a single record in one call — across all of
 * the object's RELATION fields (MANY_TO_ONE parents + ONE_TO_MANY children).
 * Powers a record detail page's relations rail without N round-trips.
 */
export async function getRecordRelationsTw(
  object: string,
  recordId: string,
  projectId?: string,
): Promise<ActionResult<RecordRelation[]>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!recordId) return { ok: false, error: 'Record id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.relations(
      object,
      recordId,
      g.ctx.projectId,
    );
    return { ok: true, data: res.relations };
  } catch (e) {
    return fail(e, 'Failed to load related records.');
  }
}

/**
 * Write-time E.164 normalization for plain-string PHONE fields. OPT-IN via
 * `SABCRM_NORMALIZE_PHONES=1` (default OFF — normalizing changes the stored
 * data shape, which could break automations/segments filtering on formatted
 * phone strings). Best-effort: unreadable metadata leaves the patch untouched.
 */
async function maybeNormalizePhones(
  object: string,
  projectId: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (process.env.SABCRM_NORMALIZE_PHONES !== '1') return data;
  try {
    const meta = await sabcrmObjectsApi.get(object, projectId);
    return normalizePhoneFields(meta?.fields, data);
  } catch {
    return data;
  }
}

/** Creates a new record on the given object. */
export async function createSabcrmRecordTw(
  object: string,
  data: Record<string, unknown>,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRecord>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    data = await maybeNormalizePhones(object, g.ctx.projectId, data ?? {});
    // Data-quality: block the create when a `block` validation rule fires.
    const vCreate = await validateRecordWrite(g.ctx.projectId, object, data ?? {});
    if (!vCreate.ok) {
      return { ok: false, error: vCreate.blocked.map((b) => b.message).join(' ') };
    }
    // Stamp Twenty-style ACTOR metadata (who created/updated this record).
    // No display name is exposed by the gate/session, so fall back to the
    // userId for `name`. Only fill fields the caller didn't already supply.
    const actor = {
      source: 'MANUAL' as const,
      workspaceMemberId: g.ctx.userId,
      name: g.ctx.userId,
    };
    const stampedData: Record<string, unknown> = { ...(data ?? {}) };
    if (stampedData.createdBy === undefined) stampedData.createdBy = actor;
    if (stampedData.updatedBy === undefined) stampedData.updatedBy = actor;

    const record = await sabcrmRecordsApi.create(object, {
      projectId: g.ctx.projectId,
      data: stampedData,
      createdBy: g.ctx.userId,
    });

    // Fire the stored engines inline (best-effort; never throws).
    await recordAudit(g.ctx.projectId, {
      actorId: g.ctx.userId,
      action: 'create',
      object,
      recordId: record.id,
      summary: `Created ${object} record`,
    });
    await maybeNotifyAssignment(
      g.ctx.projectId,
      object,
      record.id,
      data ?? {},
      g.ctx.userId,
    );
    await runWorkflowsForEvent(
      g.ctx.projectId,
      'record.created',
      object,
      record.id,
      data ?? {},
      g.ctx.userId,
    );
    // Rule-based scoring: recompute this record's score from the full record
    // (best-effort; writes data.score/scoreTier without bumping updatedAt).
    await recomputeScoresForRecord(g.ctx.projectId, object, record.id);
    await recomputeFormulasForRecord(g.ctx.projectId, object, record.id);
    await indexEmbeddingForRecord(g.ctx.projectId, object, record.id);
    await recomputeRollupsAround(g.ctx.projectId, object, record.id);
    await scoreWinForRecord(g.ctx.projectId, object, record.id);

    revalidatePath(`${TW_BASE_PATH}/${object}`);
    return { ok: true, data: record };
  } catch (e) {
    return fail(e, 'Failed to create record.');
  }
}

/** Merge-updates a record's `data` (used by inline edit). */
export async function updateSabcrmRecordTw(
  object: string,
  id: string,
  data: Record<string, unknown>,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRecord>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!id) return { ok: false, error: 'Record id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    data = await maybeNormalizePhones(object, g.ctx.projectId, data ?? {});
    // Data-quality: validate the MERGED record (existing + patch) and block on
    // a `block` rule. Best-effort fetch; if unreadable, validate the patch alone.
    {
      const currentForValidation = await sabcrmRecordsApi
        .get(object, id, g.ctx.projectId)
        .catch(() => null);
      const mergedForValidation = {
        ...(currentForValidation?.data ?? {}),
        ...(data ?? {}),
      };
      const vUpdate = await validateRecordWrite(
        g.ctx.projectId,
        object,
        mergedForValidation,
      );
      if (!vUpdate.ok) {
        return { ok: false, error: vUpdate.blocked.map((b) => b.message).join(' ') };
      }
    }
    // Stamp Twenty-style ACTOR metadata on the update (who last touched it).
    // Fall back to the userId for `name` (no display name in the gate/session);
    // don't clobber an `updatedBy` the caller explicitly supplied.
    const stampedData: Record<string, unknown> = { ...(data ?? {}) };
    if (stampedData.updatedBy === undefined) {
      stampedData.updatedBy = {
        source: 'MANUAL' as const,
        workspaceMemberId: g.ctx.userId,
        name: g.ctx.userId,
      };
    }

    // Capture the pre-update snapshot ONLY when the patch touches a field
    // watched by the `record.stage_changed` / `record.status_changed`
    // workflow events — the old vs new diff is computed off this snapshot.
    // Best-effort: an unreadable snapshot must not block the update.
    let beforeData: Record<string, unknown> | undefined;
    if (patchTouchesChangeFields(data ?? {})) {
      try {
        const before = await sabcrmRecordsApi.get(object, id, g.ctx.projectId);
        beforeData = before?.data ?? {};
      } catch {
        beforeData = undefined;
      }
    }

    const record = await sabcrmRecordsApi.update(object, id, {
      projectId: g.ctx.projectId,
      data: stampedData,
    });

    // Fire the stored engines inline (best-effort; never throws).
    await recordAudit(g.ctx.projectId, {
      actorId: g.ctx.userId,
      action: 'update',
      object,
      recordId: id,
      summary: `Updated ${object} record`,
    });
    // Only notify when this patch actually touched the assignee.
    const patch = data ?? {};
    const assigneeChanged =
      Object.prototype.hasOwnProperty.call(patch, 'assigneeId') ||
      Object.prototype.hasOwnProperty.call(patch, 'assignee');
    if (assigneeChanged) {
      await maybeNotifyAssignment(
        g.ctx.projectId,
        object,
        id,
        patch,
        g.ctx.userId,
      );
    }
    await runWorkflowsForEvent(
      g.ctx.projectId,
      'record.updated',
      object,
      id,
      patch,
      g.ctx.userId,
    );
    // Fire the ported legacy-CRM change events (`record.stage_changed` /
    // `record.status_changed`) when the patch flipped a watched field.
    if (patchTouchesChangeFields(patch)) {
      await runRecordChangeWorkflows(
        g.ctx.projectId,
        object,
        id,
        beforeData,
        patch,
        g.ctx.userId,
      );
    }
    // Rule-based scoring: re-score from the full record after the patch lands
    // (best-effort; reads the merged record, skips when inputs are unchanged).
    await recomputeScoresForRecord(g.ctx.projectId, object, id);
    await recomputeFormulasForRecord(g.ctx.projectId, object, id);
    await indexEmbeddingForRecord(g.ctx.projectId, object, id);
    await recomputeRollupsAround(g.ctx.projectId, object, id);
    await scoreWinForRecord(g.ctx.projectId, object, id);

    revalidatePath(`${TW_BASE_PATH}/${object}`);
    revalidatePath(`${TW_BASE_PATH}/${object}/${id}`);
    return { ok: true, data: record };
  } catch (e) {
    return fail(e, 'Failed to update record.');
  }
}

/**
 * Merges two records of the same object into the surviving `primaryId`. The
 * optional `data` map (winning field values chosen by the caller) is `$set`
 * on the primary, the secondary's activities are re-pointed onto the primary,
 * then the secondary is deleted. Returns the merged primary record. Gated on
 * `edit`.
 */
export async function mergeSabcrmRecordsTw(
  object: string,
  primaryId: string,
  secondaryId: string,
  data?: Record<string, unknown>,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRecord>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!primaryId) return { ok: false, error: 'A primary record id is required.' };
  if (!secondaryId) {
    return { ok: false, error: 'A secondary record id is required.' };
  }
  if (primaryId === secondaryId) {
    return { ok: false, error: 'Cannot merge a record into itself.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    // Data-quality: re-point every INBOUND relation from the loser onto the
    // survivor BEFORE the Rust merge hard-deletes the secondary (the Rust
    // merge re-points activities + survivorship but leaves relations dangling).
    await reparentInboundRelations(g.ctx.projectId, object, secondaryId, primaryId);
    const record = await sabcrmRecordsApi.merge(object, {
      projectId: g.ctx.projectId,
      primaryId,
      secondaryId,
      data,
    });
    // Re-score + re-evaluate formulas + re-embed the survivor; drop the loser's
    // vector (its record was hard-deleted by the merge).
    await recomputeScoresForRecord(g.ctx.projectId, object, primaryId);
    await recomputeFormulasForRecord(g.ctx.projectId, object, primaryId);
    await indexEmbeddingForRecord(g.ctx.projectId, object, primaryId);
    await deleteEmbeddingForRecord(g.ctx.projectId, object, secondaryId);
    revalidatePath(`${TW_BASE_PATH}/${object}`);
    revalidatePath(`${TW_BASE_PATH}/${object}/${primaryId}`);
    return { ok: true, data: record };
  } catch (e) {
    return fail(e, 'Failed to merge records.');
  }
}

/** Deletes a record by id. */
export async function deleteSabcrmRecordTw(
  object: string,
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!id) return { ok: false, error: 'Record id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.remove(object, id, g.ctx.projectId);

    // Fire the stored engines inline (best-effort; never throws).
    await recordAudit(g.ctx.projectId, {
      actorId: g.ctx.userId,
      action: 'delete',
      object,
      recordId: id,
      summary: `Deleted ${object} record`,
    });
    await runWorkflowsForEvent(
      g.ctx.projectId,
      'record.deleted',
      object,
      id,
      {},
      g.ctx.userId,
    );
    // Drop the record's embedding so semantic search can't surface a ghost.
    await deleteEmbeddingForRecord(g.ctx.projectId, object, id);

    revalidatePath(`${TW_BASE_PATH}/${object}`);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete record.');
  }
}

/**
 * Soft-deletes (trashes) a record by id — sets `deletedAt` server-side so the
 * record is hidden from normal views but recoverable via
 * {@link restoreSabcrmRecordTw}. Gated on `edit` (a recoverable action, unlike
 * the irreversible {@link permanentDeleteSabcrmRecordTw} which gates on
 * `delete`). Returns the now-trashed record.
 */
export async function trashSabcrmRecordTw(
  object: string,
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRecord>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!id) return { ok: false, error: 'Record id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const record = await sabcrmRecordsApi.trash(object, id, g.ctx.projectId);

    // Fire the stored engines inline (best-effort; never throws).
    await recordAudit(g.ctx.projectId, {
      actorId: g.ctx.userId,
      action: 'delete',
      object,
      recordId: id,
      summary: `Trashed ${object} record`,
    });
    await runWorkflowsForEvent(
      g.ctx.projectId,
      'record.deleted',
      object,
      id,
      {},
      g.ctx.userId,
    );

    revalidatePath(`${TW_BASE_PATH}/${object}`);
    revalidatePath(`${TW_BASE_PATH}/${object}/${id}`);
    return { ok: true, data: record };
  } catch (e) {
    return fail(e, 'Failed to trash record.');
  }
}

/**
 * Lists the soft-deleted (trashed) records of an object, newest-deleted first.
 * `limit` defaults to 50 (clamped at 100 server-side). Gated on `view`.
 */
export async function listSabcrmTrashTw(
  object: string,
  limit?: number,
  projectId?: string,
): Promise<ActionResult<SabcrmRecordsTwPage>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.listTrash(
      object,
      g.ctx.projectId,
      limit,
    );
    return { ok: true, data: { records: res.records, total: res.total } };
  } catch (e) {
    return fail(e, 'Failed to list trashed records.');
  }
}

/**
 * Restores a soft-deleted (trashed) record by id — unsets `deletedAt` so it
 * returns to normal views. Gated on `edit`. Returns the restored record.
 */
export async function restoreSabcrmRecordTw(
  object: string,
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRecord>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!id) return { ok: false, error: 'Record id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const record = await sabcrmRecordsApi.restore(object, id, g.ctx.projectId);
    revalidatePath(`${TW_BASE_PATH}/${object}`);
    revalidatePath(`${TW_BASE_PATH}/${object}/${id}`);
    return { ok: true, data: record };
  } catch (e) {
    return fail(e, 'Failed to restore record.');
  }
}

/**
 * Permanently (hard) deletes a record by id — irreversible, removes it from
 * Mongo entirely (works on live or trashed records). Gated on `delete`.
 */
export async function permanentDeleteSabcrmRecordTw(
  object: string,
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!id) return { ok: false, error: 'Record id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.permanentDelete(
      object,
      id,
      g.ctx.projectId,
    );
    revalidatePath(`${TW_BASE_PATH}/${object}`);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to permanently delete record.');
  }
}

/** Groups records of an object by a SELECT field (kanban board). */
export async function groupSabcrmRecordsTw(
  object: string,
  groupByField: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRecordTwGroups>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!groupByField) return { ok: false, error: 'A group-by field is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.group(
      object,
      g.ctx.projectId,
      groupByField,
    );
    return { ok: true, data: { groups: res.groups } };
  } catch (e) {
    return fail(e, 'Failed to group records.');
  }
}

/**
 * Aggregates records of an object — buckets by `params.groupByField` and
 * reduces `params.metric` (count|sum|avg|min|max) over `params.metricField`
 * (required for every metric except `count`), respecting the optional
 * structured `filters`. Returns per-bucket metrics plus an overall `total`.
 * Gated on `view`, mirroring the list/count pipeline.
 */
export async function aggregateSabcrmRecordsTw(
  object: string,
  params: AggregateSabcrmRecordsTwParams,
  projectId?: string,
): Promise<ActionResult<SabcrmRecordTwAggregate>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!params?.groupByField) {
    return { ok: false, error: 'A group-by field is required.' };
  }
  if (!params.metric) return { ok: false, error: 'A metric is required.' };
  if (params.metric !== 'count' && !params.metricField) {
    return { ok: false, error: 'This metric requires a metric field.' };
  }

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.aggregate(object, {
      projectId: g.ctx.projectId,
      groupByField: params.groupByField,
      metric: params.metric,
      metricField: params.metricField,
      filters: params.filters,
    });
    return { ok: true, data: { groups: res.groups, total: res.total } };
  } catch (e) {
    return fail(e, 'Failed to aggregate records.');
  }
}

/**
 * Lists the distinct `data.<field>` values for an object (null/empty dropped,
 * capped at 200 server-side) — e.g. to populate a filter/facet dropdown.
 * Gated on `view`.
 */
export async function distinctSabcrmRecordValuesTw(
  object: string,
  field: string,
  projectId?: string,
): Promise<ActionResult<unknown[]>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!field) return { ok: false, error: 'A field is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.distinct(object, field, g.ctx.projectId);
    return { ok: true, data: res.values };
  } catch (e) {
    return fail(e, 'Failed to load distinct values.');
  }
}

/**
 * Finds groups of records that share the same `data.<field>` value (the
 * duplicate key) for an object — e.g. to surface duplicate emails or names
 * for a merge workflow. Each group carries the shared `value`, the true
 * `count`, and up to 10 of the matching records (groups capped at 100
 * server-side). Gated on `view`, mirroring the distinct/aggregate pipeline.
 */
export async function findDuplicateRecordsTw(
  object: string,
  field: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRecordDuplicateGroup[]>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!field) return { ok: false, error: 'A field is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.duplicates(
      object,
      field,
      g.ctx.projectId,
    );
    return { ok: true, data: res.groups };
  } catch (e) {
    return fail(e, 'Failed to find duplicate records.');
  }
}

// ---------------------------------------------------------------------------
// Activities (timeline) — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists a record's timeline activities (newest first) through the engine. */
export async function listSabcrmActivitiesTw(
  targetObject: string,
  recordId: string,
  opts: ListSabcrmActivitiesTwParams = {},
  projectId?: string,
): Promise<ActionResult<SabcrmRustActivity[]>> {
  if (!targetObject) return { ok: false, error: 'Object is required.' };
  if (!recordId) return { ok: false, error: 'Record id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const activities = await sabcrmActivitiesApi.list({
      projectId: g.ctx.projectId,
      targetObject,
      targetRecordId: recordId,
      type: opts.type,
      limit: opts.limit,
    });
    return { ok: true, data: activities };
  } catch (e) {
    return fail(e, 'Failed to load timeline.');
  }
}

/** Creates a timeline activity; `authorId` is the current user. */
export async function createSabcrmActivityTw(
  input: CreateSabcrmActivityTwInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustActivity>> {
  if (!input.targetObject) return { ok: false, error: 'Object is required.' };
  if (!input.targetRecordId) {
    return { ok: false, error: 'Record id is required.' };
  }
  if (!input.type?.trim()) return { ok: false, error: 'A type is required.' };
  if (!input.title?.trim()) return { ok: false, error: 'A title is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const activity = await sabcrmActivitiesApi.create({
      projectId: g.ctx.projectId,
      type: input.type.trim(),
      title: input.title.trim(),
      body: input.body,
      targetObject: input.targetObject,
      targetRecordId: input.targetRecordId,
      authorId: g.ctx.userId,
      status: input.status,
      assigneeId: input.assigneeId,
      dueAt: input.dueAt,
      attachments: input.attachments,
    });
    revalidatePath(
      `${TW_BASE_PATH}/${input.targetObject}/${input.targetRecordId}`,
    );
    return { ok: true, data: activity };
  } catch (e) {
    return fail(e, 'Failed to add activity.');
  }
}

/** Partial-updates a timeline activity (e.g. task status). */
export async function updateSabcrmActivityTw(
  id: string,
  patch: UpdateSabcrmActivityTwPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmRustActivity>> {
  if (!id) return { ok: false, error: 'Activity id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const activity = await sabcrmActivitiesApi.update(id, {
      projectId: g.ctx.projectId,
      ...patch,
    });
    return { ok: true, data: activity };
  } catch (e) {
    return fail(e, 'Failed to update activity.');
  }
}

/** Deletes a timeline activity by id. */
export async function deleteSabcrmActivityTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Activity id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmActivitiesApi.remove(id, g.ctx.projectId);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete activity.');
  }
}

// ---------------------------------------------------------------------------
// Activity comment threads — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists the comment thread on an activity (chronological, as stored). */
export async function listActivityCommentsTw(
  activityId: string,
  projectId?: string,
): Promise<ActionResult<SabcrmComment[]>> {
  if (!activityId) return { ok: false, error: 'Activity id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const comments = await sabcrmActivitiesApi.listComments(
      activityId,
      g.ctx.projectId,
    );
    return { ok: true, data: comments };
  } catch (e) {
    return fail(e, 'Failed to load comments.');
  }
}

/** Appends a comment to an activity; `authorId` is the current user. */
export async function addActivityCommentTw(
  activityId: string,
  body: string,
  projectId?: string,
): Promise<ActionResult<SabcrmComment>> {
  if (!activityId) return { ok: false, error: 'Activity id is required.' };
  if (!body?.trim()) return { ok: false, error: 'A comment is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const comment = await sabcrmActivitiesApi.addComment(
      activityId,
      g.ctx.projectId,
      body.trim(),
      g.ctx.userId,
    );
    return { ok: true, data: comment };
  } catch (e) {
    return fail(e, 'Failed to add comment.');
  }
}

/** Removes a comment from an activity's thread by comment id. */
export async function deleteActivityCommentTw(
  activityId: string,
  commentId: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!activityId) return { ok: false, error: 'Activity id is required.' };
  if (!commentId) return { ok: false, error: 'Comment id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmActivitiesApi.deleteComment(
      activityId,
      commentId,
      g.ctx.projectId,
    );
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete comment.');
  }
}

// ---------------------------------------------------------------------------
// Favorites — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists the caller's favorites for the active project (newest first). */
export async function listSabcrmFavoritesTw(
  projectId?: string,
): Promise<ActionResult<SabcrmRustFavorite[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const favorites = await sabcrmFavoritesApi.list(g.ctx.projectId);
    return { ok: true, data: favorites };
  } catch (e) {
    return fail(e, 'Failed to load favorites.');
  }
}

/** Adds (upserts) a favorite for the caller. Idempotent. */
export async function addSabcrmFavoriteTw(
  object: string,
  recordId: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustFavorite>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!recordId) return { ok: false, error: 'Record id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const favorite = await sabcrmFavoritesApi.add(
      g.ctx.projectId,
      object,
      recordId,
    );
    return { ok: true, data: favorite };
  } catch (e) {
    return fail(e, 'Failed to add favorite.');
  }
}

/** Removes a favorite for the caller. Idempotent. */
export async function removeSabcrmFavoriteTw(
  object: string,
  recordId: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!recordId) return { ok: false, error: 'Record id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmFavoritesApi.remove(
      g.ctx.projectId,
      object,
      recordId,
    );
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to remove favorite.');
  }
}

// ---------------------------------------------------------------------------
// Projects (workspace creation)
// ---------------------------------------------------------------------------

/**
 * Create a brand-new project to host a SabCRM workspace — the SabNode
 * analogue of Twenty's "Create Workspace" flow (signUpInNewWorkspace).
 *
 * Unlike every other action in this file it does NOT go through `gate()`,
 * because no project exists yet to scope against; it only requires an
 * authenticated session. The new project carries `kind: 'crm'` (empty Meta
 * credentials) so the WhatsApp/Facebook pickers skip it, while the shared
 * `projects` collection keeps RBAC / plan / agent plumbing intact. Standard
 * CRM objects (Companies, People, …) are seeded immediately so the freshly
 * selected workspace is usable without an extra round-trip.
 */
/** A CRM project (with its profile) as listed for the standalone switcher. */
export interface SabcrmProjectListItem {
  id: string;
  name: string;
  logoUrl?: string;
  description?: string;
  industry?: string;
  website?: string;
}

/**
 * Lists the caller's standalone CRM projects (`kind: 'crm'`) directly from
 * Mongo, including each project's `sabcrm` profile (logo + details). Read from
 * Mongo rather than the Rust projects list so the CRM-only `sabcrm` sub-document
 * is always surfaced regardless of the Rust DTO's field set.
 */
export async function listSabcrmProjectsTw(): Promise<
  ActionResult<SabcrmProjectListItem[]>
> {
  const session = await getCachedSession();
  const userIdStr = (session?.user as SessionUser | undefined)?._id;
  if (!userIdStr) return { ok: false, error: 'Not authenticated.' };

  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(userIdStr);
    const docs = await db
      .collection('projects')
      .find({ userId, kind: 'crm' })
      .project({ name: 1, sabcrm: 1, createdAt: 1 })
      .sort({ createdAt: 1 })
      .toArray();

    const data: SabcrmProjectListItem[] = docs.map((d) => {
      const p = (d.sabcrm ?? {}) as Partial<SabcrmProjectProfileInput>;
      return {
        id: d._id.toString(),
        name: typeof d.name === 'string' ? d.name : 'Untitled',
        logoUrl: p.logoUrl || undefined,
        description: p.description || undefined,
        industry: p.industry || undefined,
        website: p.website || undefined,
      };
    });
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list CRM projects.');
  }
}

/** The editable CRM-project profile (logo + descriptive metadata). */
export interface SabcrmProjectProfileInput {
  logoUrl?: string;
  description?: string;
  industry?: string;
  website?: string;
}

/** Trim + drop empty profile fields; returns `undefined` when nothing is set. */
function sanitizeProjectProfile(
  profile?: SabcrmProjectProfileInput,
): SabcrmProjectProfileInput | undefined {
  if (!profile) return undefined;
  const out: SabcrmProjectProfileInput = {};
  const put = (k: keyof SabcrmProjectProfileInput, max = 2000) => {
    const v = profile[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, max);
  };
  put('logoUrl');
  put('description');
  put('industry', 120);
  put('website', 300);
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function createSabcrmProjectTw(
  name: string,
  profile?: SabcrmProjectProfileInput,
): Promise<ActionResult<{ projectId: string; name: string }>> {
  const trimmed = name?.trim();
  if (!trimmed) return { ok: false, error: 'Project name is required.' };
  if (trimmed.length > 120) {
    return { ok: false, error: 'Project name is too long (max 120 chars).' };
  }

  const session = await getCachedSession();
  const userIdStr = (session?.user as SessionUser | undefined)?._id;
  if (!userIdStr) return { ok: false, error: 'Not authenticated.' };

  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(userIdStr);

    // Soft duplicate guard — same owner + same name.
    const existing = await db
      .collection('projects')
      .findOne({ userId, name: trimmed }, { projection: { _id: 1 } });
    if (existing) {
      return {
        ok: false,
        error: 'You already have a project with that name.',
      };
    }

    const sabcrm = sanitizeProjectProfile(profile);
    const ins = await db.collection('projects').insertOne({
      userId,
      name: trimmed,
      accessToken: '',
      phoneNumbers: [],
      kind: 'crm',
      ...(sabcrm ? { sabcrm } : null),
      createdAt: new Date(),
    });

    const projectId = ins.insertedId.toString();

    // Seed the standard CRM objects so the new workspace is usable at once.
    await ensureStandardObjects(projectId);

    // Bust the cross-request projects cache for this user; otherwise `gate()`
    // (which reads `getCachedProjects`) would reject the brand-new project as
    // "not a member" until the TTL expires.
    invalidateProjectsCache(userIdStr);

    revalidatePath(TW_BASE_PATH);
    return { ok: true, data: { projectId, name: trimmed } };
  } catch (e) {
    return fail(e, 'Failed to create project.');
  }
}

/**
 * Edit an existing CRM project: rename and/or update its profile (logo,
 * description, industry, website). Gated like every other write — the caller
 * must be a member with `edit` permission on the project. Profile fields are
 * merged (only the provided keys change); an empty string clears that key.
 */
export async function updateSabcrmProjectTw(
  projectId: string,
  patch: { name?: string; profile?: SabcrmProjectProfileInput },
): Promise<ActionResult<{ projectId: string }>> {
  if (!projectId) return { ok: false, error: 'Project id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const session = await getCachedSession();
  const userIdStr = (session?.user as SessionUser | undefined)?._id;
  if (!userIdStr) return { ok: false, error: 'Not authenticated.' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(userIdStr);

    const set: Record<string, unknown> = {};

    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) return { ok: false, error: 'Project name is required.' };
      if (trimmed.length > 120) {
        return { ok: false, error: 'Project name is too long (max 120 chars).' };
      }
      // Reject a rename that collides with another of the user's projects.
      const clash = await db.collection('projects').findOne(
        { userId, name: trimmed, _id: { $ne: new ObjectId(projectId) } },
        { projection: { _id: 1 } },
      );
      if (clash) {
        return { ok: false, error: 'You already have a project with that name.' };
      }
      set.name = trimmed;
    }

    if (patch.profile) {
      // Per-key merge: a provided empty string clears the field.
      for (const key of ['logoUrl', 'description', 'industry', 'website'] as const) {
        const v = patch.profile[key];
        if (v === undefined) continue;
        const trimmed = v.trim();
        if (trimmed) set[`sabcrm.${key}`] = trimmed;
        else set[`sabcrm.${key}`] = '';
      }
    }

    if (Object.keys(set).length === 0) {
      return { ok: true, data: { projectId } };
    }

    await db
      .collection('projects')
      .updateOne({ _id: new ObjectId(projectId), userId }, { $set: set });

    invalidateProjectsCache(userIdStr);
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data: { projectId } };
  } catch (e) {
    return fail(e, 'Failed to update project.');
  }
}
