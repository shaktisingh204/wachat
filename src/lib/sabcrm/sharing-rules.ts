/**
 * SabCRM — criteria / ownership SHARING rules — PURE.
 *
 * A Salesforce-style sharing model that GRANTS EXTRA read access on top of the
 * owner / org-wide-default scope compiled by `./access-compiler.ts`. This module
 * never *replaces* that compiler — it produces an ADDITIVE `$or` clause that a
 * caller may OR into the accessible-by filter, and a single-record predicate
 * that callers may OR alongside `canAccessRecord`.
 *
 * ## Model
 *
 * A {@link SharingRule} targets one object and is one of two kinds:
 *
 *   - `type: 'owner'`  — "ownership-based sharing". Records owned by the members
 *     of the rule's SOURCE set (`ownerScope`: a role id, a list of user ids, or
 *     a named group) are shared with the rule's TARGET set (`shareWith`). The
 *     classic shape is "records owned by the EMEA team are also visible to the
 *     EMEA manager".
 *
 *   - `type: 'criteria'` — "criteria-based sharing". Records MATCHING the rule's
 *     {@link FilterCondition}s (ANDed) are shared with the TARGET set, regardless
 *     of who owns them. The classic shape is "Stage = Closed Won deals are
 *     visible to Finance".
 *
 * ## Default DENY
 *
 * The model is purely additive and DENY-by-default: a viewer who is not in a
 * rule's target set gains NOTHING from that rule; an object with no rules grants
 * NO extra access. {@link computeSharedRecordFilter} returns `null` when the
 * viewer is in no rule's target — i.e. "no extra access", never "all access".
 * {@link extraAccessFor} returns `false` unless some applicable rule explicitly
 * grants the viewer access to that specific record.
 *
 * ## No I/O
 *
 * `'server-only'`- and I/O-free (the structural twin of `./access-compiler.ts`
 * and `./scoring.ts`) so the unit tests (`tsx --test`) and the `'use client'`
 * settings page can import the model + the pure derivation directly. The Mongo
 * side lives in `./sharing-rules.server.ts`.
 *
 * ## Security
 *
 * Because every clause this module emits is OR-ed into a read, it can only ever
 * WIDEN the result set — it can never hide a record the owner scope already
 * showed. It is therefore safe to leave the enforcement read-path wiring OFF and
 * still let admins author rules; the rules only take effect once the per-project
 * enforcement flag is enabled (see `./sharing-rules.server.ts`). When the target
 * set is empty / unresolved, the safe direction is to grant NOTHING (DENY), so
 * an unresolved viewer never accidentally inherits a share.
 */

import { evalCondition } from './scoring';
import type { FilterCondition } from './records-filter';

/* -------------------------------------------------------------------------- */
/* Model                                                                       */
/* -------------------------------------------------------------------------- */

/** What a rule shares: ownership-based or criteria-based. */
export type SharingRuleType = 'owner' | 'criteria';

/**
 * Who a rule shares WITH (its TARGET set) — and, for `owner` rules, also who it
 * shares FROM (its SOURCE set, `ownerScope`). Salesforce calls these "share
 * with" / "owned by" public groups; we resolve a viewer/owner into the same
 * three shapes:
 *
 *   - `kind: 'role'`  — everyone holding `roleId` (resolved by the server CRUD
 *     against the project's RBAC graph into a set of user ids).
 *   - `kind: 'users'` — an explicit list of user ids.
 *   - `kind: 'group'` — a named group; `userIds` carries its resolved members
 *     (the server resolves the named group into ids before evaluation, so the
 *     pure layer only ever sees ids).
 *
 * The pure layer compares against the resolved `userIds` / `roleId`; resolving
 * a role/group name → user ids is the server's job.
 */
export interface ShareTarget {
  kind: 'role' | 'users' | 'group';
  /** For `kind: 'role'`. */
  roleId?: string;
  /** Resolved member user ids — required for `users`, server-filled for `group`. */
  userIds?: string[];
  /** For `kind: 'group'` — the group's stable id/name (display only here). */
  groupId?: string;
}

/** A single sharing rule for one object. */
export interface SharingRule {
  id: string;
  /** The object slug this rule shares, e.g. `opportunities`. */
  object: string;
  /** Optional human label shown in the editor. */
  name?: string;
  type: SharingRuleType;
  enabled: boolean;
  /** Who GAINS the extra read access. */
  shareWith: ShareTarget;
  /**
   * SOURCE set for `type: 'owner'` — records OWNED by these users are shared.
   * Ignored for `type: 'criteria'`.
   */
  ownerScope?: ShareTarget;
  /**
   * Match conditions for `type: 'criteria'` (ANDed). A record matching ALL
   * conditions is shared. Ignored for `type: 'owner'`.
   */
  criteria?: FilterCondition[];
}

/** The acting viewer the rules are evaluated against. */
export interface SharingViewer {
  /** The viewer's user id (string form — matches `sabcrm_records.userId`). */
  userId: string;
  /** The viewer's role id, if any (for `kind: 'role'` targets). */
  roleId?: string;
  /**
   * Group ids the viewer belongs to (for `kind: 'group'` targets). The server
   * resolves group membership; the pure layer just intersects ids.
   */
  groupIds?: string[];
}

/** The owner-bearing fields a record may carry (mirrors access-compiler). */
const OWNER_FIELD_KEYS = ['userId', 'assignedTo', 'owner', 'ownerId'] as const;

/* -------------------------------------------------------------------------- */
/* Target membership                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Whether `viewer` is a member of `target`'s TARGET set. DENY-by-default: an
 * empty / malformed target matches nobody. This is the gate that makes the whole
 * model additive-and-safe — a viewer not in the target gains nothing.
 */
export function viewerInTarget(
  target: ShareTarget | undefined,
  viewer: SharingViewer,
): boolean {
  if (!target || !viewer?.userId) return false;
  switch (target.kind) {
    case 'role':
      return (
        !!target.roleId && !!viewer.roleId && target.roleId === viewer.roleId
      );
    case 'users':
      return (target.userIds ?? []).includes(viewer.userId);
    case 'group': {
      // The server resolves a group into its member user ids on `userIds`; we
      // accept membership by EITHER the resolved id list OR a matching groupId
      // in the viewer's groups (whichever the server populated).
      if ((target.userIds ?? []).includes(viewer.userId)) return true;
      if (
        target.groupId &&
        (viewer.groupIds ?? []).includes(target.groupId)
      ) {
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Pure record predicate                                                       */
/* -------------------------------------------------------------------------- */

/** Read a record's owner id from the first populated owner-bearing field. */
function recordOwnerIds(record: {
  userId?: unknown;
  data?: Record<string, unknown>;
}): string[] {
  const ids: string[] = [];
  if (record.userId !== undefined && record.userId !== null) {
    ids.push(String(record.userId));
  }
  const data = record.data ?? {};
  for (const k of OWNER_FIELD_KEYS) {
    if (k === 'userId') continue;
    const v = data[k];
    if (v !== undefined && v !== null) ids.push(String(v));
  }
  return ids;
}

/** Whether a single rule (already known to target the viewer) shares `record`. */
function ruleSharesRecord(
  rule: SharingRule,
  record: { userId?: unknown; data?: Record<string, unknown> },
): boolean {
  if (rule.type === 'owner') {
    const sourceIds = new Set(rule.ownerScope?.userIds ?? []);
    if (sourceIds.size === 0) return false; // unresolved source → share nothing
    return recordOwnerIds(record).some((id) => sourceIds.has(id));
  }
  // criteria
  const conditions = rule.criteria ?? [];
  if (conditions.length === 0) return false; // no criteria → share nothing
  const data = record.data ?? {};
  return conditions.every((c) => evalCondition(data, c));
}

/**
 * Whether `viewer` gains EXTRA read access to `record` via `rules`. Pure +
 * deterministic. Returns `false` (DENY) unless some enabled rule both targets
 * the viewer AND shares this specific record. This is meant to be OR-ed with the
 * owner-scope check, never to replace it.
 */
export function extraAccessFor(
  record: { object?: string; userId?: unknown; data?: Record<string, unknown> },
  rules: SharingRule[],
  viewer: SharingViewer,
): boolean {
  if (!record || !Array.isArray(rules) || rules.length === 0) return false;
  for (const rule of rules) {
    if (!rule?.enabled) continue;
    if (record.object && rule.object && rule.object !== record.object) continue;
    if (!viewerInTarget(rule.shareWith, viewer)) continue; // viewer not in target
    if (ruleSharesRecord(rule, record)) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Pure Mongo clause                                                           */
/* -------------------------------------------------------------------------- */

/** Build the additive owner-field `$or` for a resolved source-owner id set. */
function ownerOrClause(ownerIds: string[]): Record<string, unknown> {
  const ids = Array.from(new Set(ownerIds.filter(Boolean)));
  return {
    $or: [
      { userId: { $in: ids } },
      ...OWNER_FIELD_KEYS.filter((k) => k !== 'userId').map((k) => ({
        [`data.${k}`]: { $in: ids },
      })),
    ],
  };
}

/** Translate one criteria condition into the same Mongo path the read uses. */
function criteriaClause(
  conditions: FilterCondition[],
): Record<string, unknown> | null {
  const and: Array<Record<string, unknown>> = [];
  for (const c of conditions) {
    const expr = conditionToClause(c);
    if (expr) and.push(expr);
  }
  if (and.length === 0) return null;
  return and.length === 1 ? and[0] : { $and: and };
}

/**
 * A minimal, INJECTION-SAFE condition → Mongo translation. We do NOT reuse the
 * records-engine `conditionToMongo` here because criteria values are
 * admin-authored and persisted (not request-time), but we still escape regex
 * and reject operator-bearing values so a malformed rule can never smuggle a
 * Mongo operator into a live read.
 */
function conditionToClause(
  condition: FilterCondition,
): Record<string, unknown> | null {
  if (!condition?.field) return null;
  const field = condition.field;
  if (field.includes('$') || field.includes('.')) return null;
  const path = `data.${field}`;
  const op = condition.op;
  const value = condition.value;

  // Reject operator-bearing object values (defence in depth).
  if (isOperatorBearing(value)) return null;

  switch (op) {
    case 'isEmpty':
      return { [path]: { $in: [null, ''] } };
    case 'isNotEmpty':
      return { [path]: { $exists: true, $nin: [null, ''] } };
    case 'eq':
      return value === undefined || value === '' ? null : { [path]: value };
    case 'neq':
      return value === undefined || value === ''
        ? null
        : { [path]: { $ne: value } };
    case 'contains':
      return value === undefined || value === ''
        ? null
        : { [path]: { $regex: escapeRegExp(String(value)), $options: 'i' } };
    case 'notContains':
      return value === undefined || value === ''
        ? null
        : {
            [path]: {
              $not: { $regex: escapeRegExp(String(value)), $options: 'i' },
            },
          };
    case 'gt':
      return value === undefined || value === '' ? null : { [path]: { $gt: value } };
    case 'gte':
      return value === undefined || value === '' ? null : { [path]: { $gte: value } };
    case 'lt':
      return value === undefined || value === '' ? null : { [path]: { $lt: value } };
    case 'lte':
      return value === undefined || value === '' ? null : { [path]: { $lte: value } };
    case 'in': {
      const arr = (Array.isArray(value) ? value : [value]).filter(
        (v) => !isOperatorBearing(v),
      );
      return arr.length ? { [path]: { $in: arr } } : null;
    }
    case 'notIn': {
      const arr = (Array.isArray(value) ? value : [value]).filter(
        (v) => !isOperatorBearing(v),
      );
      return arr.length ? { [path]: { $nin: arr } } : null;
    }
    default:
      return null;
  }
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when a value carries a Mongo operator / dotted key (shallow-recursive). */
function isOperatorBearing(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(isOperatorBearing);
  if (value === null || typeof value !== 'object') return false;
  if (value instanceof Date) return false;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) return true;
    if (isOperatorBearing((value as Record<string, unknown>)[key])) return true;
  }
  return false;
}

/**
 * Compile the ADDITIVE `$or` clause of everything `viewer` GAINS from `rules`
 * for one object — a single Mongo fragment to OR into an accessible-by filter.
 *
 * Returns `null` (NO extra access — DENY) when the viewer is in no rule's target
 * or every applicable rule resolves to nothing shareable. The caller MUST treat
 * `null` as "add nothing", never as "match all".
 *
 * The shape is:
 *   { $or: [ <owner-share clause>, <criteria-share clause>, … ] }
 * so the caller composes it as `{ $or: [ <existing accessible-by>, <this> ] }`
 * (or folds the inner `$or` members in). Every emitted member is additive.
 */
export function computeSharedRecordFilter(
  rules: SharingRule[],
  viewer: SharingViewer,
): Record<string, unknown> | null {
  if (!Array.isArray(rules) || rules.length === 0 || !viewer?.userId) {
    return null;
  }
  const clauses: Array<Record<string, unknown>> = [];
  for (const rule of rules) {
    if (!rule?.enabled) continue;
    if (!viewerInTarget(rule.shareWith, viewer)) continue; // DENY — not targeted

    if (rule.type === 'owner') {
      const ownerIds = rule.ownerScope?.userIds ?? [];
      if (ownerIds.length === 0) continue; // unresolved source → share nothing
      clauses.push(ownerOrClause(ownerIds));
    } else {
      const clause = criteriaClause(rule.criteria ?? []);
      if (clause) clauses.push(clause);
    }
  }
  if (clauses.length === 0) return null;
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

/** Distinct field keys referenced by a rule's criteria (for validation/hints). */
export function sharingCriteriaFields(rule: SharingRule): string[] {
  const out = new Set<string>();
  for (const c of rule.criteria ?? []) {
    if (c?.field) out.add(c.field);
  }
  return [...out];
}
