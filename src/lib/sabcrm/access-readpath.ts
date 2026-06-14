/**
 * SabCRM — read-path access-enforcement COMPOSITION — PURE.
 *
 * `'server-only'`- and I/O-free (unit-testable like `./access-enforcement.ts`,
 * `./access-compiler.ts`, `./scoring.ts`). This is the deterministic core that
 * the server wrapper `./access-readpath.server.ts` delegates to: given a base
 * `sabcrm_records` read filter plus the THREE independently-flag-gated
 * enforcement inputs (the compiled accessible clause, the additive sharing
 * clause, and the territory owner-id union), it produces ONE composed Mongo
 * filter to feed the native-TS read.
 *
 * ## The safety contract (READ THIS)
 *
 * Every enforcement source is **default-OFF** and resolved INDEPENDENTLY by the
 * server wrapper. This pure core receives `null` for any source that is off /
 * unreadable, and a non-null clause only when that source's flag is explicitly
 * on. The single invariant it guarantees:
 *
 *   when ALL three inputs are absent (every flag off) → it returns the
 *   `baseFilter` REFERENCE UNCHANGED. The read is byte-for-byte today's read.
 *
 * ## Narrowing-only, deny-by-default, fail-closed
 *
 *  - The compiled accessible clause is AND-ed onto the base (it can only remove
 *    rows the base already allowed — never add).
 *  - The sharing clause is layered ADDITIVELY: it OR-widens the *owner scope*
 *    inside the accessible clause (a manual/criteria share lets a viewer see a
 *    record they don't own), but only WITHIN the tenant the accessible clause
 *    already pins — it can never cross `projectId`.
 *  - The territory owner-id union folds the territory-manager's visible owners
 *    into the same owner `$or` (self ∪ subtree ∪ territory-owners), again only
 *    within the pinned tenant.
 *  - When at least one flag is on but no positive accessible clause survives,
 *    the result is {@link DENY_SENTINEL} (matches nothing) so a
 *    misconfiguration fails toward LESS access, never more.
 *
 * The I/O side (reading the three flags, resolving the clauses) lives in
 * `./access-readpath.server.ts`, which re-exports the types here.
 */

import type { MongoClause } from './access-enforcement';
import { mergeAccessClauses, DENY_ALL_CLAUSE } from './access-enforcement';
import { OWNER_FIELD_KEYS } from './access-compiler';

export type { MongoClause } from './access-enforcement';

/**
 * A clause that matches NOTHING — the fail-closed sentinel for the read path.
 * Re-exported (not re-derived) from {@link DENY_ALL_CLAUSE} so the deny shape
 * stays in one place. `{ _id: null }` matches no real `sabcrm_records` doc.
 */
export const DENY_SENTINEL: MongoClause = { ...DENY_ALL_CLAUSE };

/**
 * The independently-resolved enforcement inputs for one read. Each is `null`
 * when its source flag is OFF / unreadable (the default), and non-null only
 * when that source's per-project flag is explicitly enabled.
 *
 * The server wrapper resolves these from three separate engines:
 *   - `accessible` ← `accessibleFilterFor`        (`sabcrm_access_flags`)
 *   - `sharing`    ← `buildSharingClause`          (`sabcrm_access_enforcement`)
 *   - `territoryOwnerIds` ← `territoryAccessUserIds`(`sabcrm_territory_settings`)
 */
export interface ReadEnforcementInputs {
  /**
   * The compiled accessible-by Mongo clause (OWD + role subtree), or `null` when
   * the access-enforcement flag is off. May already carry a `$or` over owner
   * fields. A NON-null clause that matches nothing signals fail-closed.
   */
  accessible: MongoClause | null;
  /**
   * The additive sharing clause the viewer GAINS (manual / criteria shares), or
   * `null` when the sharing flag is off / nothing is shared. OR-merged into the
   * accessible owner scope.
   */
  sharing: MongoClause | null;
  /**
   * Owner user-ids the viewer may additionally see via territories they manage,
   * or `null`/`[]` when the territory flag is off / they manage none. Unioned
   * into the accessible owner `$or`.
   */
  territoryOwnerIds: string[] | null;
  /**
   * True when AT LEAST ONE enforcement flag is on. This is the explicit "are we
   * enforcing at all" switch: when false, the base filter passes through
   * UNCHANGED regardless of the (then-irrelevant) clause inputs. When true and
   * no positive clause survives, the result is the deny sentinel (fail-closed).
   */
  anyFlagOn: boolean;
}

/** True for a non-empty plain clause object. */
function hasClause(c: MongoClause | null | undefined): c is MongoClause {
  return !!c && typeof c === 'object' && Object.keys(c).length > 0;
}

/**
 * Build the OR clause that grants visibility of records owned by any id in
 * `ids` — mirrors the owner `$or` shape `buildAccessibleByFilter` emits
 * (`userId` plus the `data.<ownerField>` keys). Returns `null` for an empty set.
 */
function ownerIdsClause(ids: string[]): MongoClause | null {
  const clean = Array.from(new Set(ids.filter((u) => typeof u === 'string' && u)));
  if (clean.length === 0) return null;
  const or: MongoClause[] = [
    { userId: { $in: clean } },
    ...OWNER_FIELD_KEYS.filter((k) => k !== 'userId').map((k) => ({
      [`data.${k}`]: { $in: clean },
    })),
  ];
  return { $or: or };
}

/**
 * Compose the base read filter with the resolved enforcement inputs.
 *
 * CRITICAL invariant: `inputs.anyFlagOn === false` → returns the SAME
 * `baseFilter` reference (no clone, no new keys). This is the security-critical
 * passthrough that guarantees a disabled project reads byte-for-byte as today.
 *
 * When enforcing:
 *   1. The accessible clause is the narrowing base. Absent / empty while
 *      enforcing → DENY (fail-closed).
 *   2. The sharing clause and the territory owner-id union are layered
 *      ADDITIVELY onto the accessible OWNER scope (they OR-widen WITHIN the
 *      tenant the accessible clause already pins), producing one effective
 *      accessible clause.
 *   3. That effective accessible clause is AND-merged onto the base filter so it
 *      can only NARROW the rows the base already selected.
 */
export function composeReadFilter(
  baseFilter: MongoClause,
  inputs: ReadEnforcementInputs,
): MongoClause {
  // ── SECURITY-CRITICAL passthrough ──────────────────────────────────────────
  // Every flag off → identical read. Return the exact same reference so there is
  // provably no change to the query the driver sees.
  if (!inputs.anyFlagOn) return baseFilter;

  // Enforcing. The accessible clause is the narrowing base. If it is absent or
  // empty while we are enforcing, fail CLOSED (deny everything).
  if (!hasClause(inputs.accessible)) {
    return { ...baseFilter, ...DENY_SENTINEL };
  }

  // Layer the ADDITIVE sources (sharing + territory owners) onto the accessible
  // clause as ORed alternatives. The accessible clause already pins `projectId`,
  // so OR-ing extra owner predicates can only widen WITHIN that tenant.
  const additive: MongoClause[] = [];
  if (hasClause(inputs.sharing)) additive.push(inputs.sharing);
  const territory = ownerIdsClause(inputs.territoryOwnerIds ?? []);
  if (territory) additive.push(territory);

  let effectiveAccessible: MongoClause = inputs.accessible;
  if (additive.length > 0) {
    // The accessible clause is `{ projectId, $or?: [...] }`. We widen its owner
    // alternatives by OR-ing in the additive predicates while KEEPING the
    // tenant pin AND-ed in front, so the union can never escape the project.
    const { projectId, $or: baseOr, ...rest } = inputs.accessible as {
      projectId?: unknown;
      $or?: MongoClause[];
      [k: string]: unknown;
    };
    const unionOr: MongoClause[] = [
      ...(Array.isArray(baseOr) && baseOr.length > 0
        ? baseOr
        : // No owner $or means the accessible clause was full-tenant (read/elevated
          // OWD); there is nothing to widen, so the additive sources are subsumed.
          []),
      ...additive,
    ];
    if (Array.isArray(baseOr) && baseOr.length > 0 && unionOr.length > 0) {
      effectiveAccessible = {
        ...(projectId !== undefined ? { projectId } : {}),
        ...rest,
        $or: unionOr,
      };
    }
    // else: full-tenant accessible clause already allows everything the additive
    // sources would — leave it unchanged (cannot widen past the whole tenant).
  }

  // AND the effective accessible clause onto the base — narrowing only.
  return mergeAccessClauses(baseFilter, effectiveAccessible);
}
