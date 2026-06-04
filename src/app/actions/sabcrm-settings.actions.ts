'use server';

/**
 * SabCRM — workspace-settings server actions.
 *
 * Thin, gated wrappers over the Rust settings engine
 * ({@link sabcrmSettingsApi} in `@/lib/rust-client/sabcrm-settings`). These
 * power free-form per-project CRM workspace configuration: one settings
 * document per project holding an arbitrary key/value `data` map.
 *
 * Every action follows the SAME pipeline as the sibling
 * `sabcrm-views.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown value
 * is normalised into `{ ok: false, error }` so the UI degrades gracefully.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmSettingsApi,
  SABCRM_TYPED_SETTINGS_SECTIONS,
  type SabcrmTypedSettingsSection,
} from '@/lib/rust-client/sabcrm-settings';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { CrmSettingsPatch } from './sabcrm-settings.actions.types';

/** Sections backed by a typed, server-validated endpoint. */
const TYPED_SECTIONS = new Set<string>(SABCRM_TYPED_SETTINGS_SECTIONS);

/** Narrowing guard for the typed-section union. */
function isTypedSection(s: string): s is SabcrmTypedSettingsSection {
  return TYPED_SECTIONS.has(s);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

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
 * helper in `sabcrm-views.actions.ts` verbatim, including the cross-tenant
 * defense against a client-supplied `explicitProjectId`.
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

  // 2. active project — only accept a projectId that belongs to THIS user.
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
// Settings — via the Rust engine
// ---------------------------------------------------------------------------

/** Reads the project's free-form CRM workspace settings (or `{}`). */
export async function getCrmSettingsTw(
  projectId?: string,
): Promise<ActionResult<Record<string, unknown>>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmSettingsApi.get(g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load settings.');
  }
}

/** Merge-updates the project's CRM workspace settings, returning the merge. */
export async function updateCrmSettingsTw(
  patch: CrmSettingsPatch,
  projectId?: string,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, error: 'A settings patch object is required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmSettingsApi.update(g.ctx.projectId, patch);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update settings.');
  }
}

// ---------------------------------------------------------------------------
// Per-section settings — typed endpoints where they exist, blob otherwise
// ---------------------------------------------------------------------------

/**
 * Reads one named settings section (`general`, `appearance`, …) for the active
 * project. Reads are always done via the free-form blob so NO stored key is
 * ever dropped (a typed `GET` would only echo schema-known fields); the bare
 * section slice is returned (object, array, or `null` when absent).
 */
export async function getCrmSectionTw(
  section: string,
  projectId?: string,
): Promise<ActionResult<unknown>> {
  if (!section || typeof section !== 'string') {
    return { ok: false, error: 'A settings section is required.' };
  }

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const all = await sabcrmSettingsApi.get(g.ctx.projectId);
    const slice = isPlainObject(all) ? (all[section] ?? null) : null;
    return { ok: true, data: slice };
  } catch (e) {
    return fail(e, 'Failed to load settings.');
  }
}

/**
 * Persists one named settings section. Typed sections
 * ({@link SABCRM_TYPED_SETTINGS_SECTIONS}) go through the server-validated
 * `PUT /v1/sabcrm/settings/<section>` endpoint (PATCH-merge of the supplied
 * keys, rejecting invalid values with a `400`); every other section is a
 * whole-slice replace on the free-form blob (`data.<section> = slice`), which
 * is how non-typed slices like `accounts` (an array) and `profile` are stored.
 * Returns the stored slice.
 */
export async function updateCrmSectionTw(
  section: string,
  slice: unknown,
  projectId?: string,
): Promise<ActionResult<unknown>> {
  if (!section || typeof section !== 'string') {
    return { ok: false, error: 'A settings section is required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    if (isTypedSection(section)) {
      if (!isPlainObject(slice)) {
        return { ok: false, error: 'A settings object is required.' };
      }
      const data = await sabcrmSettingsApi.putSection(
        g.ctx.projectId,
        section,
        slice,
      );
      return { ok: true, data };
    }

    // Non-typed section → whole-slice replace on the blob.
    const merged = await sabcrmSettingsApi.update(g.ctx.projectId, {
      [section]: slice,
    });
    const stored = isPlainObject(merged) ? (merged[section] ?? slice) : slice;
    return { ok: true, data: stored };
  } catch (e) {
    return fail(e, 'Failed to update settings.');
  }
}
