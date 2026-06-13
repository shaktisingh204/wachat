import 'server-only';

/**
 * SabCRM — permission-ENFORCEMENT server resolver (server-only).
 *
 * The I/O layer over the pure `./access-enforcement` core. It:
 *  1. reads the per-project enforcement flag from `sabcrm_access_flags`
 *     (DEFAULT OFF — absence/malformed → off), and
 *  2. ONLY when on, builds the combined accessible Mongo filter from the
 *     existing access-compiler / access-resolver (OWD + role hierarchy subtree)
 *     plus best-effort sharing + territory clauses, and merges them
 *     deny-narrowing via {@link mergeAccessClauses}.
 *
 * ## Safety contract (mirrors the pure core)
 *
 * `accessibleFilterFor` returns `null` whenever enforcement is OFF, the inputs
 * are missing, or anything throws — so a caller that does
 * `{ ...baseFilter, ...(extra ?? {}) }` behaves EXACTLY as today. Enforcement
 * can ONLY narrow. Enabling it requires a security review on a running app (see
 * `getEnforcementFlag` doc + the settings page warning).
 *
 * ## Two-store gotcha (IMPORTANT)
 *
 * This wires enforcement onto the NATIVE-TS read path only (the
 * `sabcrm_records` Mongo reads in `records.server.ts`). The Rust read path is
 * NOT covered by this and needs a parallel change there before the flag can be
 * trusted as a hard boundary. The settings UI and the reviewer checklist both
 * call this gap out.
 */

import { connectToDatabase } from '@/lib/mongodb';
import {
  buildAccessibleByFilter,
  type AccessContext,
} from './access-compiler';
import {
  getObjectOwd,
  resolveManagedSubtree,
} from './access-resolver.server';
import {
  enforcementMode,
  mergeAccessClauses,
  enforcementClause,
  type AccessFlagDoc,
  type EnforcementMode,
  type MongoClause,
} from './access-enforcement';

export {
  enforcementMode,
  mergeAccessClauses,
  enforcementClause,
  DENY_ALL_CLAUSE,
  type AccessFlagDoc,
  type EnforcementMode,
  type MongoClause,
} from './access-enforcement';

const FLAGS_COLL = 'sabcrm_access_flags';
const SHARING_COLL = 'sabcrm_sharing';

/* -------------------------------------------------------------------------- */
/* Per-project flag (DEFAULT OFF)                                             */
/* -------------------------------------------------------------------------- */

/**
 * Read the per-project enforcement flag. DEFAULT OFF: a missing collection /
 * doc, a malformed value, or any thrown error all resolve to a doc that
 * {@link enforcementMode} treats as `'off'`. There is no way to accidentally
 * end up enabled — only an explicit `enabled: true` written by
 * `setAccessFlagTw` (after a security review) turns it on.
 */
export async function getEnforcementFlag(
  projectId: string,
): Promise<AccessFlagDoc> {
  const offDoc: AccessFlagDoc = { projectId, enabled: false };
  try {
    if (!projectId) return offDoc;
    const { db } = await connectToDatabase();
    const doc = (await db
      .collection(FLAGS_COLL)
      .findOne({ projectId })) as AccessFlagDoc | null;
    if (!doc) return offDoc;
    // Normalise to a strict shape so a stray truthy value can't leak through.
    return {
      projectId,
      enabled: doc.enabled === true,
      updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : undefined,
      updatedBy: typeof doc.updatedBy === 'string' ? doc.updatedBy : undefined,
    };
  } catch {
    return offDoc; // fail toward LESS enforcement (= today's behaviour).
  }
}

/**
 * Persist the per-project enforcement flag. Default is off; this is the ONLY
 * path that can set `enabled: true`, and it is gated to `edit` by the action
 * wrapper. Bumps its OWN `updatedAt` (it is a config collection, not a record).
 */
export async function setEnforcementFlag(
  projectId: string,
  enabled: boolean,
  updatedBy: string,
): Promise<AccessFlagDoc> {
  const { db } = await connectToDatabase();
  const doc: AccessFlagDoc = {
    projectId,
    enabled: enabled === true,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  await db
    .collection(FLAGS_COLL)
    .updateOne({ projectId }, { $set: doc }, { upsert: true });
  return doc;
}

/* -------------------------------------------------------------------------- */
/* Best-effort sharing + territory clauses                                    */
/* -------------------------------------------------------------------------- */

interface SharingExtras {
  /** Field key on the record holding a territory tag (e.g. `region`). */
  territoryField?: string;
  /** Territory values the actor may see. */
  territories?: string[];
  /** Explicit record ids shared TO this actor (manual sharing). */
  sharedRecordIds?: string[];
}

/**
 * Load any optional per-object sharing/territory config for this actor. This is
 * intentionally best-effort and additive-narrowing: when there is no config (the
 * common case) it returns `{}` and the merge degrades to the compiled OWD +
 * subtree scope. The config rides the SAME `sabcrm_sharing` doc the OWD lives on
 * so there is no new collection to provision.
 *
 * Returns `null` clauses for anything not configured so {@link mergeAccessClauses}
 * skips them.
 */
async function loadSharingExtras(
  projectId: string,
  objectSlug: string,
): Promise<SharingExtras> {
  try {
    const { db } = await connectToDatabase();
    const doc = (await db
      .collection(SHARING_COLL)
      .findOne({ projectId, objectSlug })) as
      | { territoryField?: unknown; territoryMap?: unknown }
      | null;
    const territoryField =
      typeof doc?.territoryField === 'string' && doc.territoryField
        ? doc.territoryField
        : undefined;
    return { territoryField };
  } catch {
    return {};
  }
}

/** Build the territory narrowing clause, or `null` when not configured. */
function territoryClauseFor(
  extras: SharingExtras,
  visibleTerritories: string[],
): MongoClause | null {
  if (!extras.territoryField || visibleTerritories.length === 0) return null;
  return { [`data.${extras.territoryField}`]: { $in: visibleTerritories } };
}

/** Build the manual-sharing widening-as-OR clause merged into owner scope. */
function sharingClauseFor(extras: SharingExtras): MongoClause | null {
  if (!extras.sharedRecordIds || extras.sharedRecordIds.length === 0) {
    return null;
  }
  // Manual shares are an ADDITIVE allowance, but at the deny-narrowing merge
  // layer we still keep them as a positive clause; the owner-scope already
  // pins the project so this can only widen WITHIN the tenant, never across it.
  return { _id: { $in: extras.sharedRecordIds } };
}

/* -------------------------------------------------------------------------- */
/* Public: the combined accessible filter (null when OFF / passthrough)       */
/* -------------------------------------------------------------------------- */

export interface AccessibleFilterArgs {
  projectId: string;
  viewerUserId: string;
  /** The object slug being read (drives OWD + territory lookups). */
  object: string;
  /** Owner/admin bypass — supplied by the caller's RBAC resolution. */
  elevated?: boolean;
  /** Record field keys the actor's role hides (FLS), if any. */
  hiddenFields?: string[];
}

/**
 * Build the combined accessible Mongo filter for one actor + object, ONLY when
 * the per-project flag is on.
 *
 * - Flag OFF (default) → returns `null`. The caller MUST treat `null` as
 *   "add nothing" so the read is byte-for-byte what it is today.
 * - Flag ON → resolves the {@link AccessContext} (OWD from `sabcrm_sharing`,
 *   subtree from `workspaceMembers`), compiles the base accessible filter via
 *   `buildAccessibleByFilter`, layers best-effort sharing + territory clauses,
 *   and merges them deny-narrowing. On ANY internal error it FAILS CLOSED to a
 *   deny-all clause (never falls back to passthrough while enabled).
 *
 * NOTE: this covers the native-TS `records.server` reads only — the Rust read
 * path needs a parallel change (two-store gotcha).
 */
export async function accessibleFilterFor(
  args: AccessibleFilterArgs,
): Promise<MongoClause | null> {
  const { projectId, viewerUserId, object, elevated = false, hiddenFields } =
    args;
  if (!projectId || !object) return null;

  // 1. Flag gate — default OFF → passthrough.
  const flag = await getEnforcementFlag(projectId);
  const mode: EnforcementMode = enforcementMode(flag);
  if (mode === 'off') return null;

  // 2. Enforce mode. From here on we MUST NOT silently return passthrough — any
  //    failure fails CLOSED via enforcementClause's deny-all fallback.
  try {
    const owd = elevated
      ? 'read'
      : await getObjectOwd(projectId, object);
    const visibleUserIds = elevated
      ? [viewerUserId]
      : await resolveManagedSubtree(projectId, viewerUserId);

    const ctx: AccessContext = {
      projectId,
      selfId: viewerUserId,
      elevated,
      owd,
      visibleUserIds,
      hiddenFields,
    };
    const compiled = buildAccessibleByFilter(ctx);

    // Best-effort sharing + territory. Territories the actor may see are, for
    // now, the same as their visible-user subtree is conceptually scoped to —
    // until a dedicated territory-membership store lands, we only apply a
    // territory clause when the object declares a territory field AND the actor
    // is elevated (elevated → all territories, so no narrowing). Non-elevated
    // actors get no territory narrowing here (degrades to OWD + subtree), which
    // is the conservative choice (territory can only narrow further, so omitting
    // it cannot widen beyond the subtree scope).
    const extras = await loadSharingExtras(projectId, object);
    const territory = elevated
      ? null
      : territoryClauseFor(extras, []); // no territory membership yet → null
    const sharing = sharingClauseFor(extras);

    const accessible = mergeAccessClauses(
      compiled.filter as MongoClause,
      null, // role-subtree is already folded into the compiled owner $or
      sharing,
      territory,
    );

    // enforcementClause guarantees a deny-all fallback if `accessible` came back
    // empty for any reason.
    return enforcementClause(mode, accessible);
  } catch {
    // Fail CLOSED while enabled: deny everything rather than leak.
    return enforcementClause('enforce', null);
  }
}

/**
 * Convenience for single-record fetch guards: build the same accessible clause
 * to AND alongside `{ _id, projectId }`. Returns `null` when OFF (passthrough).
 */
export async function accessibleByIdFilterFor(
  args: AccessibleFilterArgs,
): Promise<MongoClause | null> {
  // Identical accessible set — the `_id` pin is supplied by the caller.
  return accessibleFilterFor(args);
}

/* -------------------------------------------------------------------------- */
/* Dry-run preview (counts what the viewer WOULD lose if enabled)             */
/* -------------------------------------------------------------------------- */

export interface DryRunResult {
  /** Total `sabcrm_records` in the project the viewer sees TODAY (no filter). */
  totalVisibleToday: number;
  /**
   * How many of those the viewer would still see if enforcement were enabled
   * for the WHOLE project right now.
   */
  visibleIfEnforced: number;
  /** `totalVisibleToday - visibleIfEnforced` — the records that would vanish. */
  wouldLose: number;
  /** True when the actor is elevated (owner/admin) — they lose nothing. */
  elevated: boolean;
  /** Per-object breakdown so the UI can show where the loss lands. */
  perObject: Array<{
    object: string;
    today: number;
    ifEnforced: number;
    wouldLose: number;
  }>;
}

/**
 * Simulate enabling enforcement WITHOUT touching the flag: for every object,
 * count the viewer's current project-scoped rows vs the rows the compiled
 * accessible filter would keep. This is the "scary preview" the settings page
 * renders before an admin flips the switch.
 *
 * Crucially it computes the accessible filter as if the flag were ON (it builds
 * the {@link AccessContext} directly rather than going through
 * {@link accessibleFilterFor}, which would short-circuit to `null` while OFF).
 * It NEVER mutates anything.
 */
export async function dryRunForViewer(args: {
  projectId: string;
  viewerUserId: string;
  /** Object slugs to evaluate (caller passes the project's object list). */
  objectSlugs: string[];
  elevated?: boolean;
  hiddenFields?: string[];
}): Promise<DryRunResult> {
  const { projectId, viewerUserId, objectSlugs, elevated = false, hiddenFields } =
    args;
  const empty: DryRunResult = {
    totalVisibleToday: 0,
    visibleIfEnforced: 0,
    wouldLose: 0,
    elevated,
    perObject: [],
  };
  if (!projectId || objectSlugs.length === 0) return empty;

  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_records');
  const perObject: DryRunResult['perObject'] = [];
  let totalToday = 0;
  let totalEnforced = 0;

  for (const object of objectSlugs) {
    // TODAY: the native read path scopes by { projectId, userId, object }.
    // The viewer's "today" baseline is the project-scoped owner read; we use
    // projectId + object (the broadest the page could surface for this actor).
    const todayFilter: MongoClause = { projectId, object };
    const today = await col.countDocuments(
      todayFilter as Parameters<typeof col.countDocuments>[0],
    );

    // IF ENFORCED: build the accessible filter for this object as if ON.
    const owd = elevated ? 'read' : await getObjectOwd(projectId, object);
    const visibleUserIds = elevated
      ? [viewerUserId]
      : await resolveManagedSubtree(projectId, viewerUserId);
    const ctx: AccessContext = {
      projectId,
      selfId: viewerUserId,
      elevated,
      owd,
      visibleUserIds,
      hiddenFields,
    };
    const compiled = buildAccessibleByFilter(ctx);
    const enforcedFilter = mergeAccessClauses(
      { ...(compiled.filter as MongoClause), object },
    );
    const ifEnforced = await col.countDocuments(
      enforcedFilter as Parameters<typeof col.countDocuments>[0],
    );

    totalToday += today;
    totalEnforced += ifEnforced;
    perObject.push({
      object,
      today,
      ifEnforced,
      wouldLose: Math.max(0, today - ifEnforced),
    });
  }

  return {
    totalVisibleToday: totalToday,
    visibleIfEnforced: totalEnforced,
    wouldLose: Math.max(0, totalToday - totalEnforced),
    elevated,
    perObject,
  };
}
