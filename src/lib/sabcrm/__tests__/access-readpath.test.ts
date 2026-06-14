/**
 * Unit tests for the read-path access-enforcement COMPOSITION pure core
 * (`../access-readpath`).
 *
 *   npx tsx --test src/lib/sabcrm/__tests__/access-readpath.test.ts
 *
 * Covers the SECURITY-CRITICAL safety contract of the native-TS read-path seam:
 *   - all flags off  → byte-for-byte passthrough (the SAME reference)
 *   - enabled        → AND-narrows the base with the accessible clause
 *   - enabled, no accessible clause → DENY (fail-closed)
 *   - sharing OR-widens the accessible owner scope WITHIN the tenant
 *   - territory owner-ids union into the accessible owner $or
 *   - full-tenant accessible clause subsumes the additive sources (no widening
 *     past the whole tenant)
 *
 * Pure: no Mongo, no `server-only` — the server orchestrator
 * (`../access-readpath.server.ts`) is NOT imported here (it would pull
 * `server-only`); these tests exercise the composition the wrapper delegates to.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  composeReadFilter,
  DENY_SENTINEL,
  type MongoClause,
  type ReadEnforcementInputs,
} from '../access-readpath';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const PROJECT = 'proj1';

/** A realistic base read filter (tenant + owner + object), as records.server builds. */
function baseFilter(): MongoClause {
  return { projectId: PROJECT, userId: 'u1', object: 'contacts' };
}

/** The compiled accessible clause for a PRIVATE object (owner $or pinned to tenant). */
function privateAccessible(ids: string[]): MongoClause {
  return {
    projectId: PROJECT,
    $or: [
      { userId: { $in: ids } },
      { 'data.assignedTo': { $in: ids } },
      { 'data.owner': { $in: ids } },
      { 'data.ownerId': { $in: ids } },
    ],
  };
}

/** Inputs with everything off (the default for every project today). */
function allOff(): ReadEnforcementInputs {
  return { accessible: null, sharing: null, territoryOwnerIds: null, anyFlagOn: false };
}

/* -------------------------------------------------------------------------- */
/* CRITICAL invariant: all flags off → identical passthrough                  */
/* -------------------------------------------------------------------------- */

describe('composeReadFilter — all flags off (the security-critical invariant)', () => {
  it('returns the SAME base filter reference (no clone, no new keys)', () => {
    const base = baseFilter();
    const out = composeReadFilter(base, allOff());
    // Identity, not just deep-equality: provably nothing was added.
    assert.equal(out, base);
  });

  it('passthrough even if stray clause inputs are present but anyFlagOn=false', () => {
    // Defensive: if a flag is off, its (then-irrelevant) clause must be ignored.
    const base = baseFilter();
    const out = composeReadFilter(base, {
      accessible: privateAccessible(['u1']),
      sharing: { _id: { $in: ['x'] } },
      territoryOwnerIds: ['u9'],
      anyFlagOn: false,
    });
    assert.equal(out, base);
  });

  it('deep-equals today\'s query for the all-off case', () => {
    const base = baseFilter();
    assert.deepEqual(composeReadFilter(base, allOff()), {
      projectId: PROJECT,
      userId: 'u1',
      object: 'contacts',
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Enabled → narrows                                                          */
/* -------------------------------------------------------------------------- */

describe('composeReadFilter — enabled narrows', () => {
  it('ANDs the accessible clause onto the base (narrowing only)', () => {
    const base = baseFilter();
    const accessible = privateAccessible(['u1', 'u2']);
    const out = composeReadFilter(base, {
      accessible,
      sharing: null,
      territoryOwnerIds: null,
      anyFlagOn: true,
    });
    // mergeAccessClauses composes base + accessible under a single $and.
    assert.deepEqual(out, { $and: [base, accessible] });
  });

  it('the base tenant/owner pins survive the narrowing', () => {
    const base = baseFilter();
    const out = composeReadFilter(base, {
      accessible: privateAccessible(['u1']),
      sharing: null,
      territoryOwnerIds: null,
      anyFlagOn: true,
    });
    const and = (out as { $and: MongoClause[] }).$and;
    assert.ok(and.some((c) => c.projectId === PROJECT && c.userId === 'u1'));
  });
});

/* -------------------------------------------------------------------------- */
/* Error-while-enabled (no accessible clause) → DENY                          */
/* -------------------------------------------------------------------------- */

describe('composeReadFilter — fail-closed while enabled', () => {
  it('enabled with a null accessible clause → deny sentinel merged onto base', () => {
    const base = baseFilter();
    const out = composeReadFilter(base, {
      accessible: null, // wrapper would pass null when accessibleFilterFor failed/denied
      sharing: null,
      territoryOwnerIds: null,
      anyFlagOn: true,
    });
    assert.deepEqual(out, { ...base, ...DENY_SENTINEL });
    // _id:null matches no real record → nothing leaks.
    assert.equal((out as { _id: unknown })._id, null);
  });

  it('enabled with an EMPTY accessible clause → deny sentinel (fail-closed)', () => {
    const base = baseFilter();
    const out = composeReadFilter(base, {
      accessible: {},
      sharing: null,
      territoryOwnerIds: null,
      anyFlagOn: true,
    });
    assert.deepEqual(out, { ...base, ...DENY_SENTINEL });
  });

  it('enabled with a non-empty accessible clause does NOT deny', () => {
    const base = baseFilter();
    const out = composeReadFilter(base, {
      accessible: privateAccessible(['u1']),
      sharing: null,
      territoryOwnerIds: null,
      anyFlagOn: true,
    });
    assert.ok(!('_id' in out));
  });
});

/* -------------------------------------------------------------------------- */
/* Additive sharing — OR-widens the owner scope WITHIN the tenant             */
/* -------------------------------------------------------------------------- */

describe('composeReadFilter — additive sharing', () => {
  it('OR-merges the sharing clause into the accessible owner $or', () => {
    const base = baseFilter();
    const accessible = privateAccessible(['u1']);
    const sharing: MongoClause = { _id: { $in: ['shared1', 'shared2'] } };
    const out = composeReadFilter(base, {
      accessible,
      sharing,
      territoryOwnerIds: null,
      anyFlagOn: true,
    });
    // Effective accessible = { projectId, $or: [...ownerFields, sharing] }.
    const and = (out as { $and: MongoClause[] }).$and;
    const eff = and[1] as { projectId: string; $or: MongoClause[] };
    assert.equal(eff.projectId, PROJECT, 'tenant pin preserved');
    assert.ok(
      eff.$or.some((c) => JSON.stringify(c) === JSON.stringify(sharing)),
      'sharing clause OR-ed into the owner alternatives',
    );
    // The original owner alternatives are still present (widening, not replacing).
    assert.ok(eff.$or.some((c) => 'userId' in c));
  });
});

/* -------------------------------------------------------------------------- */
/* Territory owner-id union                                                   */
/* -------------------------------------------------------------------------- */

describe('composeReadFilter — territory owner-id union', () => {
  it('unions territory owners into the accessible owner $or (as owner-field predicates)', () => {
    const base = baseFilter();
    const accessible = privateAccessible(['u1']);
    const out = composeReadFilter(base, {
      accessible,
      sharing: null,
      territoryOwnerIds: ['mgr-owned-a', 'mgr-owned-b'],
      anyFlagOn: true,
    });
    const and = (out as { $and: MongoClause[] }).$and;
    const eff = and[1] as { projectId: string; $or: MongoClause[] };
    // The territory union appears as a sub-$or over owner fields.
    const territoryAlt = eff.$or.find(
      (c) => '$or' in c,
    ) as { $or: MongoClause[] } | undefined;
    assert.ok(territoryAlt, 'territory owner-id clause OR-ed in');
    const flat = JSON.stringify(territoryAlt);
    assert.ok(flat.includes('mgr-owned-a') && flat.includes('mgr-owned-b'));
  });

  it('empty / null territory owner-ids add nothing', () => {
    const base = baseFilter();
    const accessible = privateAccessible(['u1']);
    const withNull = composeReadFilter(base, {
      accessible,
      sharing: null,
      territoryOwnerIds: null,
      anyFlagOn: true,
    });
    const withEmpty = composeReadFilter(base, {
      accessible,
      sharing: null,
      territoryOwnerIds: [],
      anyFlagOn: true,
    });
    assert.deepEqual(withNull, { $and: [base, accessible] });
    assert.deepEqual(withEmpty, { $and: [base, accessible] });
  });
});

/* -------------------------------------------------------------------------- */
/* Full-tenant accessible clause subsumes additive sources                    */
/* -------------------------------------------------------------------------- */

describe('composeReadFilter — full-tenant accessible (read/elevated OWD)', () => {
  it('a full-tenant accessible clause (no owner $or) is not widened by additives', () => {
    const base = baseFilter();
    const fullTenant: MongoClause = { projectId: PROJECT };
    const out = composeReadFilter(base, {
      accessible: fullTenant,
      sharing: { _id: { $in: ['s'] } },
      territoryOwnerIds: ['t'],
      anyFlagOn: true,
    });
    // Nothing to widen past the whole tenant → accessible stays as-is, AND base.
    assert.deepEqual(out, { $and: [base, fullTenant] });
  });
});

/* -------------------------------------------------------------------------- */
/* Tenant cannot be crossed                                                   */
/* -------------------------------------------------------------------------- */

describe('composeReadFilter — additive sources never cross the tenant', () => {
  it('the projectId pin is always AND-ed in front of the widened $or', () => {
    const base = baseFilter();
    const accessible = privateAccessible(['u1']);
    const out = composeReadFilter(base, {
      accessible,
      sharing: { _id: { $in: ['x'] } },
      territoryOwnerIds: ['y'],
      anyFlagOn: true,
    });
    const and = (out as { $and: MongoClause[] }).$and;
    const eff = and[1] as { projectId: string };
    // Even after widening the owner $or, the tenant pin remains on the clause.
    assert.equal(eff.projectId, PROJECT);
    // And the base (which also pins projectId + userId) is still AND-ed.
    assert.ok(and.some((c) => c.projectId === PROJECT && c.userId === 'u1'));
  });
});
