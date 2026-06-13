import 'server-only';

/**
 * SabCRM — criteria / ownership sharing rules runtime (server-only).
 *
 * Persists per-project, per-object sharing rules in `sabcrm_sharing_rules` (the
 * native-Mongo config pattern of `./scoring.server.ts`) and resolves a viewer
 * into the ADDITIVE Mongo `$or` clause they GAIN, by:
 *
 *   1. Reading the project's rules for the object.
 *   2. Resolving role / group targets into concrete user-id sets (so the pure
 *      `computeSharedRecordFilter` only ever compares ids).
 *   3. Resolving the viewer's role id from the project's RBAC graph.
 *
 * The pure model + DENY-by-default semantics live in `./sharing-rules.ts`,
 * re-exported here so callers import from one file.
 *
 * ## Enforcement flag (DEFAULT-OFF)
 *
 * Sharing rules only WIDEN access, so authoring + previewing them is safe at all
 * times. But the read-path that OR-extends the accessible-by filter is gated by a
 * per-project flag stored in `sabcrm_access_enforcement` (default OFF). When OFF,
 * `isSharingEnforcementEnabled` returns `false` and the read path must behave
 * EXACTLY as today (add nothing). Turning it ON is a security-significant change
 * (it widens visibility): do it on a running app with a review.
 *
 * NOTE on the two-store gotcha: `buildSharingClause` produces a clause for the
 * NATIVE-TS `records.server` read path only. The Rust read path does NOT consult
 * this — wiring sharing into the Rust crate is a separate, explicit task.
 *
 * Everything is best-effort: a downed DB must never break a read. On any error
 * the safe direction is LESS access, so `buildSharingClause` returns `null`
 * (grant nothing) rather than throwing or widening.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getEffectivePermissionsForProject } from '@/lib/rbac-server';
import { listCrmMembers } from './members.server';
import {
  computeSharedRecordFilter,
  extraAccessFor,
  type SharingRule,
  type SharingViewer,
  type ShareTarget,
} from './sharing-rules';

export {
  computeSharedRecordFilter,
  extraAccessFor,
  viewerInTarget,
  sharingCriteriaFields,
  type SharingRule,
  type SharingRuleType,
  type ShareTarget,
  type SharingViewer,
} from './sharing-rules';

const RULES_COLL = 'sabcrm_sharing_rules';
const ENFORCE_COLL = 'sabcrm_access_enforcement';

/* -------------------------------------------------------------------------- */
/* Persisted shape                                                             */
/* -------------------------------------------------------------------------- */

interface SharingRuleDoc {
  _id: ObjectId | string;
  projectId: string;
  object: string;
  name?: string;
  type?: SharingRule['type'];
  enabled?: boolean;
  shareWith?: ShareTarget;
  ownerScope?: ShareTarget;
  criteria?: SharingRule['criteria'];
  createdAt?: string;
  updatedAt?: string;
}

/** Shape accepted by the save action (server stamps id/timestamps/project). */
export interface SharingRuleInput {
  /** Present → update; absent → insert. */
  id?: string;
  object: string;
  name?: string;
  type: SharingRule['type'];
  enabled: boolean;
  shareWith: ShareTarget;
  ownerScope?: ShareTarget;
  criteria?: SharingRule['criteria'];
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

/** Sanitize a caller-supplied target: drop ids that aren't plain strings. */
function cleanTarget(t: ShareTarget | undefined): ShareTarget | undefined {
  if (!t || (t.kind !== 'role' && t.kind !== 'users' && t.kind !== 'group')) {
    return undefined;
  }
  return {
    kind: t.kind,
    roleId: typeof t.roleId === 'string' ? t.roleId : undefined,
    groupId: typeof t.groupId === 'string' ? t.groupId : undefined,
    userIds: Array.isArray(t.userIds)
      ? t.userIds.filter((u) => typeof u === 'string' && u)
      : undefined,
  };
}

function toRule(doc: SharingRuleDoc): SharingRule {
  return {
    id: idHex(doc._id),
    object: String(doc.object ?? ''),
    name: doc.name?.trim() || undefined,
    type: doc.type === 'criteria' ? 'criteria' : 'owner',
    enabled: doc.enabled !== false,
    shareWith: cleanTarget(doc.shareWith) ?? { kind: 'users', userIds: [] },
    ownerScope: cleanTarget(doc.ownerScope),
    criteria: Array.isArray(doc.criteria) ? doc.criteria : [],
  };
}

/* -------------------------------------------------------------------------- */
/* Config CRUD                                                                 */
/* -------------------------------------------------------------------------- */

/** All sharing rules for a project (optionally one object), newest first. */
export async function listSharingRules(
  projectId: string,
  object?: string,
): Promise<SharingRule[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const query: Record<string, unknown> = { projectId };
  if (object) query.object = object;
  const docs = (await db
    .collection(RULES_COLL)
    .find(query)
    .sort({ updatedAt: -1 })
    .limit(500)
    .toArray()) as unknown as SharingRuleDoc[];
  return docs.map(toRule);
}

/** One sharing rule by id (scoped to the project), or null. */
export async function getSharingRule(
  projectId: string,
  id: string,
): Promise<SharingRule | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(RULES_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as SharingRuleDoc | null;
  return doc ? toRule(doc) : null;
}

/** Insert (no id) or update (valid id) a sharing rule; returns the saved shape. */
export async function upsertSharingRule(
  projectId: string,
  input: SharingRuleInput,
): Promise<SharingRule> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    object: input.object,
    name: input.name?.trim() || undefined,
    type: input.type === 'criteria' ? ('criteria' as const) : ('owner' as const),
    enabled: input.enabled !== false,
    shareWith: cleanTarget(input.shareWith) ?? { kind: 'users', userIds: [] },
    ownerScope: cleanTarget(input.ownerScope),
    criteria: Array.isArray(input.criteria) ? input.criteria : [],
    updatedAt: now,
  };

  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(RULES_COLL)
      .updateOne(
        { _id: new ObjectId(input.id), projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const saved = await getSharingRule(projectId, input.id);
    if (saved) return saved;
    // upsert ran against _id=input.id; if the read-back transiently missed,
    // construct from known fields rather than inserting a DUPLICATE.
    return toRule({ _id: new ObjectId(input.id), projectId, createdAt: now, ...fields });
  }

  const res = await db
    .collection(RULES_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toRule({ _id: res.insertedId, projectId, createdAt: now, ...fields });
}

/** Delete a sharing rule by id. Returns true when a doc was removed. */
export async function deleteSharingRule(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(RULES_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/* Enforcement flag (DEFAULT-OFF)                                              */
/* -------------------------------------------------------------------------- */

interface EnforcementDoc {
  projectId: string;
  /** When true, the native read path may OR-extend with sharing clauses. */
  sharingEnabled?: boolean;
  updatedAt?: string;
}

/**
 * Whether the per-project SHARING enforcement flag is ON. DEFAULT-OFF and
 * fail-OFF: a missing doc or any error yields `false`, so the read path adds
 * NOTHING and behaves exactly as today. Enabling is a deliberate, reviewed act.
 */
export async function isSharingEnforcementEnabled(
  projectId: string,
): Promise<boolean> {
  try {
    if (!projectId) return false;
    const { db } = await connectToDatabase();
    const doc = (await db
      .collection(ENFORCE_COLL)
      .findOne({ projectId })) as EnforcementDoc | null;
    return doc?.sharingEnabled === true;
  } catch {
    return false; // fail toward LESS access
  }
}

/** Set the per-project sharing enforcement flag (security-significant). */
export async function setSharingEnforcementEnabled(
  projectId: string,
  enabled: boolean,
): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection(ENFORCE_COLL)
    .updateOne(
      { projectId },
      {
        $set: { sharingEnabled: enabled === true, updatedAt: new Date().toISOString() },
        $setOnInsert: { projectId },
      },
      { upsert: true },
    );
}

/* -------------------------------------------------------------------------- */
/* Target / viewer resolution                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a target's role/group into concrete member user ids using the
 * project's member roster. `users` targets pass through; `role` targets expand
 * to every member whose CRM role matches; `group` targets keep their declared
 * `userIds` (named-group membership is authored explicitly today). Best-effort.
 */
async function resolveTargetUserIds(
  projectId: string,
  target: ShareTarget | undefined,
): Promise<ShareTarget | undefined> {
  if (!target) return undefined;
  if (target.kind === 'users') return target;
  if (target.kind === 'group') return target; // userIds authored on the rule

  // role → members holding that role. We match against both the raw project
  // role slug and the derived CRM capability so a rule authored against either
  // resolves. listCrmMembers is best-effort and never throws.
  try {
    const members = await listCrmMembers(projectId);
    const want = target.roleId?.toLowerCase();
    const userIds = members
      .filter(
        (m) =>
          m.projectRole.toLowerCase() === want || m.crmRole.toLowerCase() === want,
      )
      .map((m) => m.userId);
    return { ...target, userIds };
  } catch {
    return { ...target, userIds: [] }; // unresolved → shares nothing (DENY)
  }
}

/** Resolve every rule's targets so the pure layer only sees ids. */
async function resolveRuleTargets(
  projectId: string,
  rules: SharingRule[],
): Promise<SharingRule[]> {
  const out: SharingRule[] = [];
  for (const rule of rules) {
    const shareWith = await resolveTargetUserIds(projectId, rule.shareWith);
    const ownerScope =
      rule.type === 'owner'
        ? await resolveTargetUserIds(projectId, rule.ownerScope)
        : undefined;
    out.push({
      ...rule,
      shareWith: shareWith ?? rule.shareWith,
      ownerScope,
    });
  }
  return out;
}

/**
 * Resolve the acting viewer's role id from the project's RBAC graph so `role`
 * targets can match. Returns `{ userId }` with no role on any error (DENY for
 * role targets, which is the safe direction). The viewer's group membership is
 * not modelled in RBAC yet, so `groupIds` is left undefined — `group` targets
 * rely on their authored `userIds`.
 */
async function resolveViewer(
  projectId: string,
  viewerUserId: string,
): Promise<SharingViewer> {
  try {
    const eff = await getEffectivePermissionsForProject();
    const roleId = eff?.isOwner ? 'owner' : eff?.role || undefined;
    return { userId: viewerUserId, roleId };
  } catch {
    return { userId: viewerUserId };
  }
}

/* -------------------------------------------------------------------------- */
/* Read-path clause                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Build the ADDITIVE Mongo clause `viewerUserId` GAINS for `object` — the
 * fragment a caller ORs into the accessible-by filter. Returns `null` (grant
 * NOTHING) when:
 *   - the per-project enforcement flag is OFF (default), OR
 *   - the viewer is in no rule's target / nothing is shareable, OR
 *   - any error occurs (fail toward LESS access).
 *
 * NATIVE-TS read path only — see the two-store note in the module header.
 */
export async function buildSharingClause(
  projectId: string,
  object: string,
  viewerUserId: string,
): Promise<Record<string, unknown> | null> {
  try {
    if (!projectId || !object || !viewerUserId) return null;
    // DEFAULT-OFF: when the flag is off, add nothing (behave as today).
    if (!(await isSharingEnforcementEnabled(projectId))) return null;

    const rules = (await listSharingRules(projectId, object)).filter(
      (r) => r.enabled,
    );
    if (rules.length === 0) return null;

    const [resolvedRules, viewer] = await Promise.all([
      resolveRuleTargets(projectId, rules),
      resolveViewer(projectId, viewerUserId),
    ]);
    return computeSharedRecordFilter(resolvedRules, viewer);
  } catch {
    return null; // fail toward LESS access
  }
}

/** Used to discover which projects have any sharing rules (e.g. admin tooling). */
export async function listProjectsWithSharingRules(): Promise<string[]> {
  try {
    const { db } = await connectToDatabase();
    const ids = (await db
      .collection(RULES_COLL)
      .distinct('projectId', { enabled: { $ne: false } })) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}
