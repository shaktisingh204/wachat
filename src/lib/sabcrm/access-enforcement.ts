/**
 * SabCRM — permission-ENFORCEMENT decision + clause merge — PURE.
 *
 * `'server-only'`- and I/O-free (unit-testable like `./access-compiler.ts` and
 * `./scoring.ts`). This is the deterministic core that turns a per-project
 * enforcement flag + a set of accessible-set clauses into ONE Mongo filter
 * fragment to AND into a `sabcrm_records` read.
 *
 * ## The safety contract (READ THIS)
 *
 * Enforcement is **default-OFF**. The whole point of this module is that, when
 * the flag is off, the read path behaves EXACTLY as it does today — no extra
 * clause, no projection, nothing. {@link enforcementMode} returns `'off'` for
 * any flag doc that is missing / malformed / not explicitly enabled, and the
 * server caller maps `'off'` to a `null` filter (passthrough). Only when an
 * admin has EXPLICITLY enabled it (after a security review on a running app)
 * does {@link enforcementMode} return `'enforce'`.
 *
 * ## Deny-narrowing only
 *
 * {@link mergeAccessClauses} only ever NARROWS from the owner scope it is given.
 * It composes the supplied clauses with `$and`, so each clause can only remove
 * rows, never add them. When no positive clause is supplied at all in enforce
 * mode the caller is expected to fall back to a DENY-BY-DEFAULT clause (see
 * {@link DENY_ALL_CLAUSE}) so a misconfiguration fails toward LESS access, never
 * more. This module never widens.
 *
 * The Mongo-touching side (reading the flag, resolving the subtree, building the
 * compiled accessible filter) lives in `./access-enforcement.server.ts`, which
 * re-exports the types here.
 */

/** Resolved enforcement decision for one project. */
export type EnforcementMode = 'off' | 'enforce';

/**
 * The persisted per-project enforcement flag document shape (minus the Mongo
 * `_id`). Stored in `sabcrm_access_flags`, keyed by `projectId`. ABSENCE of the
 * doc — or any value other than an explicit `enabled === true` — means OFF.
 */
export interface AccessFlagDoc {
  projectId: string;
  /** The ONLY value that turns enforcement on. Anything else → off. */
  enabled?: boolean;
  /** Audit: who last toggled it + when (set by the server action). */
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * A Mongo filter fragment. Kept as a loose record so it can be `$and`-merged
 * without fighting the driver's `Filter<T>` generic at this pure layer.
 */
export type MongoClause = Record<string, unknown>;

/**
 * A clause that matches NOTHING. Used as the fail-closed fallback in enforce
 * mode when no positive accessible clause is available — so a config error
 * denies access rather than leaking every record. `{ _id: null }` matches no
 * real `sabcrm_records` doc (every record has an ObjectId `_id`).
 */
export const DENY_ALL_CLAUSE: MongoClause = { _id: null };

/**
 * Decide the enforcement mode from a (possibly absent / malformed) flag doc.
 *
 * Default-OFF and conservative: ONLY a doc with an explicit boolean
 * `enabled === true` yields `'enforce'`. `null`/`undefined`, a missing field, a
 * truthy-but-not-`true` value (`1`, `"true"`, `{}`), or any other shape all map
 * to `'off'`. This is the single chokepoint that guarantees the safety
 * contract: if anything about the flag is unclear, we behave exactly as today.
 */
export function enforcementMode(
  flagDoc: AccessFlagDoc | null | undefined,
): EnforcementMode {
  if (!flagDoc || typeof flagDoc !== 'object') return 'off';
  return flagDoc.enabled === true ? 'enforce' : 'off';
}

/** True when an array contains at least one non-empty clause object. */
function hasClause(c: MongoClause | null | undefined): c is MongoClause {
  return !!c && typeof c === 'object' && Object.keys(c).length > 0;
}

/**
 * Merge the owner scope with the role-hierarchy, sharing, and territory clauses
 * into a single accessible Mongo filter, DENY-NARROWING only.
 *
 * Semantics:
 *  - `ownerScope` is the base accessible set (typically the compiled
 *    {@link import('./access-compiler').buildAccessibleByFilter} output, which
 *    already pins `projectId` and, in private mode, the owner `$or`). It is the
 *    starting point and is always applied.
 *  - `roleSubtree`, `sharingClause`, `territoryClause` are each OPTIONAL extra
 *    narrowing predicates. Each present clause is ANDed on, so it can only
 *    remove rows the owner scope already allowed — never add new ones.
 *  - Absent (null / empty) clauses are skipped so we don't emit an empty
 *    `$and` element that would match everything.
 *
 * The result is the intersection of every supplied clause. When ONLY the owner
 * scope is supplied, the owner scope is returned unchanged (so an enforce-mode
 * read with no extra sharing/territory rules behaves like the plain compiled
 * accessible filter). When NOTHING is supplied at all the caller should use
 * {@link DENY_ALL_CLAUSE} instead of calling this with nothing.
 */
export function mergeAccessClauses(
  ownerScope: MongoClause,
  roleSubtree?: MongoClause | null,
  sharingClause?: MongoClause | null,
  territoryClause?: MongoClause | null,
): MongoClause {
  const extras = [roleSubtree, sharingClause, territoryClause].filter(hasClause);

  // Owner scope is the always-applied base. Nothing extra → return it as-is.
  if (extras.length === 0) {
    return hasClause(ownerScope) ? ownerScope : { ...DENY_ALL_CLAUSE };
  }

  // Compose owner scope + every extra clause under a single `$and` so multiple
  // clauses that touch the same path (e.g. two `$or`s) never clobber each other.
  const and: MongoClause[] = [];
  if (hasClause(ownerScope)) and.push(ownerScope);
  for (const c of extras) and.push(c);

  // If somehow nothing survived, fail closed.
  if (and.length === 0) return { ...DENY_ALL_CLAUSE };
  if (and.length === 1) return and[0];
  return { $and: and };
}

/**
 * The clause the caller should AND into a `sabcrm_records` read for a given
 * mode. In `'off'` mode this returns `null` (passthrough — exactly as today).
 * In `'enforce'` mode it returns the merged accessible clause, falling back to
 * {@link DENY_ALL_CLAUSE} when no accessible clause could be built (fail-closed).
 *
 * This is the pure decision the server `accessibleFilterFor` wraps with I/O.
 */
export function enforcementClause(
  mode: EnforcementMode,
  accessible: MongoClause | null | undefined,
): MongoClause | null {
  if (mode === 'off') return null; // passthrough — behave exactly as today.
  return hasClause(accessible) ? accessible : { ...DENY_ALL_CLAUSE };
}
