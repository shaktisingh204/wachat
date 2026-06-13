import 'server-only';

/**
 * SabCRM — territory management runtime (server-only).
 *
 * Persists the territory forest in `sabcrm_territories` (projectId-scoped, the
 * native-Mongo config pattern of `./scoring.server.ts` / `./sequences.server`)
 * and a per-project enforcement flag in `sabcrm_territory_settings`. Records get
 * stamped with their matched territory via the pure matcher in `./territory.ts`
 * (re-exported here so callers import from one file).
 *
 * ## Write-back envelope (mirrors `./scoring.server.ts` / `./ai-fields.server`)
 *
 * The territory id is written DIRECT to Mongo `sabcrm_records` as dotted `$set`
 * paths only — `data.territoryId` (a string) and the reserved
 * `data.__territory` meta (`{ territoryId, ruleId, matchedAt }`). It deliberately
 * does NOT bump the record's top-level `updatedAt`, so a stamp never resets the
 * idle / rotting clocks or re-triggers record-change workflows (same rationale
 * as the AI-field + scoring designs).
 *
 * Both stores point at the same `sabcrm_records` collection, so a scalar written
 * into `data` here is served by the Rust read path with zero crate change.
 * Object/field METADATA (provisioning a `territoryId` display field) must still
 * go through the Rust path — that provisioning happens in the territory ACTION,
 * not here (two-store gotcha).
 *
 * ## SECURITY — access roll-up is DEFAULT-OFF
 *
 * {@link territoryAccessUserIds} returns the owner user-ids a viewer may see via
 * the territories they manage (territory → owners-in-it). It is a pure data
 * lookup and NEVER enforces on its own. Enforcement (folding these ids into the
 * accessible-owner `$or` on the native-TS records read path) is wired ONLY when
 * {@link isTerritoryEnforcementEnabled} returns true — a per-project flag that
 * is OFF by default. When the flag is off the read path behaves EXACTLY as today
 * (no narrowing, no widening). Enabling it can only ever NARROW a viewer's
 * results (it ANDs an owner `$or`), so it fails toward LESS access — but it must
 * still be enabled deliberately, with a security review on a running app, since
 * a mis-scoped territory tree could hide records a user legitimately owns via a
 * non-owner field. Note: this enforcement attaches to the native-TS read path
 * only; the Rust read path is NOT automatically covered (documented gap).
 *
 * Everything is best-effort: a downed DB must never break the record mutation
 * that triggered a stamp.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  assignTerritory,
  assignmentRuleId,
  territoriesManagedByUser,
  type Territory,
  type TerritoryInput,
  type TerritoryMatchMode,
} from './territory';

export {
  assignTerritory,
  assignmentRuleId,
  territorySubtree,
  managersForTerritory,
  territoriesManagedByUser,
  territoryMatches,
  buildTerritoryTree,
  territorySourceFields,
  type Territory,
  type TerritoryRule,
  type TerritoryInput,
  type TerritoryMatchMode,
  type TerritoryAssignment,
  type TerritoryTreeNode,
} from './territory';

const TERRITORIES_COLL = 'sabcrm_territories';
const SETTINGS_COLL = 'sabcrm_territory_settings';
const RECORDS_COLL = 'sabcrm_records';

/** Field key the matched territory id is written to (fixed — table-friendly). */
export const TERRITORY_FIELD = 'territoryId';

/** Cap on records re-stamped per object in one sweep (mirrors the score pass). */
const MAX_RECORDS_PER_SWEEP = 1000;

/** Cap on territories loaded per project / object. */
const MAX_TERRITORIES = 2000;

/** Raw Mongo doc for a territory. */
interface TerritoryDoc {
  _id: ObjectId | string;
  projectId: string;
  objectSlug: string;
  name: string;
  parentId?: string | null;
  enabled?: boolean;
  match?: string;
  rules?: Territory['rules'];
  managerUserIds?: string[];
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Hex-stringify a Mongo `_id` regardless of stored type. */
function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function normMatch(m: unknown): TerritoryMatchMode {
  return m === 'any' ? 'any' : 'all';
}

/** Normalize a persisted doc into the API {@link Territory} shape. */
function toTerritory(doc: TerritoryDoc): Territory {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    objectSlug: doc.objectSlug,
    name: doc.name,
    parentId: doc.parentId ?? null,
    enabled: doc.enabled !== false,
    match: normMatch(doc.match),
    rules: Array.isArray(doc.rules) ? doc.rules : [],
    managerUserIds: Array.isArray(doc.managerUserIds)
      ? doc.managerUserIds.map(String).filter(Boolean)
      : [],
    order: Number.isFinite(doc.order) ? Number(doc.order) : 0,
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/* -------------------------------------------------------------------------- */
/* Territory CRUD                                                              */
/* -------------------------------------------------------------------------- */

/** All territories for a project (optionally one object), order then newest. */
export async function listTerritories(
  projectId: string,
  objectSlug?: string,
): Promise<Territory[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const query: Record<string, unknown> = { projectId };
  if (objectSlug) query.objectSlug = objectSlug;
  const docs = (await db
    .collection(TERRITORIES_COLL)
    .find(query)
    .sort({ order: 1, updatedAt: -1 })
    .limit(MAX_TERRITORIES)
    .toArray()) as unknown as TerritoryDoc[];
  return docs.map(toTerritory);
}

/** One territory by id (scoped to the project), or null. */
export async function getTerritory(
  projectId: string,
  id: string,
): Promise<Territory | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(TERRITORIES_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as TerritoryDoc | null;
  return doc ? toTerritory(doc) : null;
}

/** Enabled territories that assign over a given object (matcher inputs). */
export async function listEnabledTerritoriesForObject(
  projectId: string,
  objectSlug: string,
): Promise<Territory[]> {
  if (!projectId || !objectSlug) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(TERRITORIES_COLL)
    .find({ projectId, objectSlug, enabled: { $ne: false } })
    .sort({ order: 1 })
    .limit(MAX_TERRITORIES)
    .toArray()) as unknown as TerritoryDoc[];
  return docs.map(toTerritory);
}

/** Insert (no id) or update (valid id) a territory; returns the saved shape. */
export async function upsertTerritory(
  projectId: string,
  input: TerritoryInput,
): Promise<Territory> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  // A territory may not be its own parent (a 1-node cycle); reject silently.
  const parentId =
    input.parentId && input.parentId !== input.id ? String(input.parentId) : null;
  const fields = {
    objectSlug: input.objectSlug,
    name: input.name?.trim() || 'Untitled territory',
    parentId,
    enabled: input.enabled !== false,
    match: normMatch(input.match),
    rules: Array.isArray(input.rules) ? input.rules : [],
    managerUserIds: Array.isArray(input.managerUserIds)
      ? [...new Set(input.managerUserIds.map(String).filter(Boolean))]
      : [],
    order: Number.isFinite(input.order) ? Number(input.order) : 0,
    updatedAt: now,
  };

  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(TERRITORIES_COLL)
      .updateOne(
        { _id: new ObjectId(input.id), projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const saved = await getTerritory(projectId, input.id);
    if (saved) return saved;
  }

  const res = await db
    .collection(TERRITORIES_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toTerritory({ _id: res.insertedId, projectId, createdAt: now, ...fields });
}

/**
 * Delete a territory by id. Re-parents its direct children to the deleted
 * node's parent (collapse, not orphan) so the tree stays connected. Returns
 * true when a doc was removed.
 */
export async function deleteTerritory(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const existing = (await db
    .collection(TERRITORIES_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as TerritoryDoc | null;
  if (!existing) return false;
  const newParent = existing.parentId ?? null;
  await db
    .collection(TERRITORIES_COLL)
    .updateMany(
      { projectId, parentId: id },
      { $set: { parentId: newParent, updatedAt: new Date().toISOString() } },
    );
  const res = await db
    .collection(TERRITORIES_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/* Enforcement flag (DEFAULT-OFF)                                             */
/* -------------------------------------------------------------------------- */

interface SettingsDoc {
  projectId: string;
  enforcementEnabled?: boolean;
}

/**
 * Whether territory ACCESS ENFORCEMENT is enabled for a project. DEFAULT-OFF:
 * absent doc / read error → false (behave exactly as today). The flag only ever
 * gates a NARROWING fold-in on the read path; see the module header.
 */
export async function isTerritoryEnforcementEnabled(
  projectId: string,
): Promise<boolean> {
  try {
    if (!projectId) return false;
    const { db } = await connectToDatabase();
    const doc = (await db
      .collection(SETTINGS_COLL)
      .findOne({ projectId })) as SettingsDoc | null;
    return doc?.enforcementEnabled === true;
  } catch {
    return false; // fail toward today's behaviour (no enforcement)
  }
}

/** Set the per-project enforcement flag. Bumps the settings doc's updatedAt. */
export async function setTerritoryEnforcementEnabled(
  projectId: string,
  enabled: boolean,
): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection(SETTINGS_COLL)
    .updateOne(
      { projectId },
      {
        $set: {
          enforcementEnabled: enabled === true,
          updatedAt: new Date().toISOString(),
        },
        $setOnInsert: { projectId, createdAt: new Date().toISOString() },
      },
      { upsert: true },
    );
}

/* -------------------------------------------------------------------------- */
/* Stamping (write-back)                                                       */
/* -------------------------------------------------------------------------- */

/** Build the dotted `$set` for one record's territory stamp, or `{}` for no-op. */
function buildStampSet(
  territories: Territory[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const { territoryId, territory } = assignTerritory({ data }, territories);
  const current = data[TERRITORY_FIELD];
  const currentStr = current == null ? null : String(current);
  // No change → no write (keeps the AI-fields "skip in-sync" discipline).
  if (currentStr === (territoryId ?? null)) return {};
  const set: Record<string, unknown> = {
    [`data.${TERRITORY_FIELD}`]: territoryId,
    'data.__territory': {
      territoryId,
      ruleId: assignmentRuleId(territory, data) ?? null,
      matchedAt: new Date().toISOString(),
    },
  };
  return set;
}

/**
 * Assign + stamp ONE record's territory from its current data (no `updatedAt`
 * bump). Best-effort — never throws. Called inline from the create/update record
 * actions and from the backstop sweep.
 */
export async function assignTerritoryForRecord(
  projectId: string,
  objectSlug: string,
  recordId: string,
): Promise<boolean> {
  try {
    if (!projectId || !objectSlug || !recordId || !ObjectId.isValid(recordId)) {
      return false;
    }
    const territories = await listEnabledTerritoriesForObject(projectId, objectSlug);
    if (territories.length === 0) return false;
    const { db } = await connectToDatabase();
    const rec = (await db
      .collection(RECORDS_COLL)
      .findOne({ _id: new ObjectId(recordId), projectId })) as {
      data?: Record<string, unknown>;
      deletedAt?: unknown;
    } | null;
    if (!rec || rec.deletedAt) return false;
    const set = buildStampSet(territories, rec.data ?? {});
    if (Object.keys(set).length === 0) return false;
    await db
      .collection(RECORDS_COLL)
      .updateOne({ _id: new ObjectId(recordId), projectId }, { $set: set });
    return true;
  } catch {
    return false; // best-effort
  }
}

/**
 * Re-stamp up to {@link MAX_RECORDS_PER_SWEEP} live records of an object. Used
 * after the territory tree is edited (re-stamp the existing book) and by a
 * backstop. Returns a small report. Best-effort.
 */
export async function assignTerritoriesForObject(
  projectId: string,
  objectSlug: string,
  limit = MAX_RECORDS_PER_SWEEP,
): Promise<{ scanned: number; updated: number }> {
  try {
    if (!projectId || !objectSlug) return { scanned: 0, updated: 0 };
    const territories = await listEnabledTerritoriesForObject(projectId, objectSlug);
    if (territories.length === 0) return { scanned: 0, updated: 0 };
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
      const set = buildStampSet(territories, rec.data ?? {});
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

/* -------------------------------------------------------------------------- */
/* Access roll-up (read-path input — gated by the DEFAULT-OFF flag)            */
/* -------------------------------------------------------------------------- */

/**
 * The set of OWNER user-ids a viewer may see via the territories they manage:
 * for every territory `viewerUserId` manages (own + descendants, via
 * `territoriesManagedByUser`), the distinct owners (`userId` / `data.assignedTo`
 * / `data.owner` / `data.ownerId`) of records STAMPED into that territory.
 *
 * Returns `[]` when the viewer manages no territory (deny-by-default — no
 * widening). The viewer's OWN id is intentionally NOT injected here; the read
 * path already includes self via the existing `visibleUserIds` set, and the
 * caller (snippet in the action header) UNIONs this set into that — so a
 * territory manager sees self ∪ subtree-owners ∪ territory-owners.
 *
 * This is a pure DATA lookup; it does not enforce anything. It is only consumed
 * by the read path when {@link isTerritoryEnforcementEnabled} is true.
 */
export async function territoryAccessUserIds(
  projectId: string,
  viewerUserId: string,
): Promise<string[]> {
  try {
    if (!projectId || !viewerUserId) return [];
    const territories = await listTerritories(projectId);
    if (territories.length === 0) return [];
    const managed = territoriesManagedByUser(territories, viewerUserId);
    if (managed.length === 0) return [];

    const { db } = await connectToDatabase();
    const recs = (await db
      .collection(RECORDS_COLL)
      .find({
        projectId,
        [`data.${TERRITORY_FIELD}`]: { $in: managed },
        deletedAt: { $in: [null] },
      })
      .project({
        userId: 1,
        'data.assignedTo': 1,
        'data.owner': 1,
        'data.ownerId': 1,
      })
      .limit(20_000)
      .toArray()) as Array<{
      userId?: unknown;
      data?: { assignedTo?: unknown; owner?: unknown; ownerId?: unknown };
    }>;

    const owners = new Set<string>();
    for (const r of recs) {
      if (r.userId != null) owners.add(String(r.userId));
      const d = r.data ?? {};
      for (const v of [d.assignedTo, d.owner, d.ownerId]) {
        if (v != null && v !== '') owners.add(String(v));
      }
    }
    return [...owners];
  } catch {
    return []; // best-effort; empty = no extra access granted
  }
}
