/**
 * Unit tests for the territory PURE helpers (`../territory`).
 *
 * Runs with Node's built-in `node:test` + `tsx` (no extra deps):
 *   npx tsx --test src/lib/sabcrm/__tests__/territory.test.ts
 *
 * The impure half (`territory.server.ts` — Mongo, the access roll-up) carries
 * `'server-only'` and is deliberately NOT imported here (gate-security /
 * scoring.test precedent).
 *
 * Security-critical cases covered explicitly:
 *  - deny-by-default: a rule-less or disabled territory NEVER auto-stamps.
 *  - assignment is deterministic (order → name → id) so two reviewers agree.
 *  - the manager roll-up rolls DOWN (parent manager sees children) but an
 *    unrelated user manages NOTHING (no accidental widening).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildTerritoryTree,
  territorySubtree,
  managersForTerritory,
  territoriesManagedByUser,
  territoryMatches,
  assignTerritory,
  assignmentRuleId,
  territorySourceFields,
  type Territory,
} from '../territory';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                     */
/* -------------------------------------------------------------------------- */

function t(partial: Partial<Territory> & { id: string; name: string }): Territory {
  return {
    projectId: 'p1',
    objectSlug: 'accounts',
    parentId: null,
    enabled: true,
    match: 'all',
    rules: [],
    managerUserIds: [],
    order: 0,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

// A small forest:  world ─┬─ us ──── us-west
//                         └─ emea
const world = t({ id: 'world', name: 'World', managerUserIds: ['ceo'], order: 0 });
const us = t({
  id: 'us',
  name: 'United States',
  parentId: 'world',
  managerUserIds: ['us-head'],
  order: 0,
  rules: [{ id: 'r-us', condition: { field: 'country', op: 'eq', value: 'US' } }],
});
const usWest = t({
  id: 'us-west',
  name: 'US West',
  parentId: 'us',
  managerUserIds: ['west-rep'],
  order: 0,
  match: 'all',
  rules: [
    { id: 'r-c', condition: { field: 'country', op: 'eq', value: 'US' } },
    { id: 'r-s', condition: { field: 'state', op: 'in', value: ['CA', 'WA', 'OR'] } },
  ],
});
const emea = t({
  id: 'emea',
  name: 'EMEA',
  parentId: 'world',
  managerUserIds: ['emea-head'],
  order: 1,
  rules: [{ id: 'r-emea', condition: { field: 'region', op: 'eq', value: 'EMEA' } }],
});
const forest = [world, us, usWest, emea];

/* -------------------------------------------------------------------------- */
/* Tree construction                                                           */
/* -------------------------------------------------------------------------- */

describe('buildTerritoryTree', () => {
  it('nests children under parents, ordered deterministically', () => {
    const roots = buildTerritoryTree(forest);
    assert.equal(roots.length, 1);
    assert.equal(roots[0].territory.id, 'world');
    const worldKids = roots[0].children.map((c) => c.territory.id);
    // us (order 0) before emea (order 1)
    assert.deepEqual(worldKids, ['us', 'emea']);
    const usKids = roots[0].children[0].children.map((c) => c.territory.id);
    assert.deepEqual(usKids, ['us-west']);
  });

  it('treats an orphan (missing parent) as a root, never drops it', () => {
    const orphan = t({ id: 'mars', name: 'Mars', parentId: 'no-such-parent' });
    const roots = buildTerritoryTree([world, orphan]);
    const ids = roots.map((r) => r.territory.id).sort();
    assert.deepEqual(ids, ['mars', 'world']);
  });

  it('is cycle-safe (self-parent / mutual cycle does not loop)', () => {
    const a = t({ id: 'a', name: 'A', parentId: 'b' });
    const b = t({ id: 'b', name: 'B', parentId: 'a' });
    const roots = buildTerritoryTree([a, b]);
    // Neither can be a clean root via the other; both surface, no infinite loop.
    assert.ok(roots.length >= 1);
  });
});

/* -------------------------------------------------------------------------- */
/* Subtree                                                                      */
/* -------------------------------------------------------------------------- */

describe('territorySubtree', () => {
  it('returns the root + all descendants', () => {
    assert.deepEqual(territorySubtree(forest, 'world').sort(), [
      'emea',
      'us',
      'us-west',
      'world',
    ]);
    assert.deepEqual(territorySubtree(forest, 'us').sort(), ['us', 'us-west']);
    assert.deepEqual(territorySubtree(forest, 'us-west'), ['us-west']);
  });

  it('returns [] for an unknown id (deny-by-default — no leak)', () => {
    assert.deepEqual(territorySubtree(forest, 'nope'), []);
    assert.deepEqual(territorySubtree(forest, ''), []);
  });
});

/* -------------------------------------------------------------------------- */
/* Managers roll-up                                                            */
/* -------------------------------------------------------------------------- */

describe('managersForTerritory', () => {
  it('includes own managers plus every ancestor manager (rolls DOWN)', () => {
    // us-west: west-rep + us-head + ceo
    assert.deepEqual(managersForTerritory(forest, 'us-west').sort(), [
      'ceo',
      'us-head',
      'west-rep',
    ]);
    // us: us-head + ceo (NOT west-rep — children do not roll up)
    assert.deepEqual(managersForTerritory(forest, 'us').sort(), ['ceo', 'us-head']);
    // world: just ceo
    assert.deepEqual(managersForTerritory(forest, 'world'), ['ceo']);
  });

  it('returns [] for an unknown territory', () => {
    assert.deepEqual(managersForTerritory(forest, 'nope'), []);
  });
});

describe('territoriesManagedByUser', () => {
  it('rolls a parent manager DOWN into all descendants', () => {
    // ceo manages world → everything
    assert.deepEqual(territoriesManagedByUser(forest, 'ceo').sort(), [
      'emea',
      'us',
      'us-west',
      'world',
    ]);
    // us-head manages us → us + us-west only
    assert.deepEqual(territoriesManagedByUser(forest, 'us-head').sort(), [
      'us',
      'us-west',
    ]);
  });

  it('a non-manager / unknown user manages NOTHING (no widening)', () => {
    assert.deepEqual(territoriesManagedByUser(forest, 'random-user'), []);
    assert.deepEqual(territoriesManagedByUser(forest, ''), []);
  });
});

/* -------------------------------------------------------------------------- */
/* Matching + assignment                                                       */
/* -------------------------------------------------------------------------- */

describe('territoryMatches', () => {
  it('all-mode requires every rule; any-mode requires one', () => {
    assert.equal(territoryMatches(usWest, { country: 'US', state: 'CA' }), true);
    assert.equal(territoryMatches(usWest, { country: 'US', state: 'NY' }), false);
    const anyT = { ...usWest, match: 'any' as const };
    assert.equal(territoryMatches(anyT, { country: 'US', state: 'NY' }), true);
  });

  it('DENY-BY-DEFAULT: a rule-less territory never matches', () => {
    assert.equal(territoryMatches(world, { anything: true }), false);
    assert.equal(territoryMatches({ rules: [], match: 'all' }, {}), false);
    assert.equal(territoryMatches({ rules: [], match: 'any' }, {}), false);
  });
});

describe('assignTerritory', () => {
  it('stamps the first matching territory in deterministic order', () => {
    const a = assignTerritory({ data: { country: 'US', state: 'CA' } }, forest);
    // us (order 0) is evaluated before us-west — and us matches on country alone,
    // so the more general territory wins by order. (Authoring orders specifics
    // first when they want them to win.)
    assert.equal(a.territoryId, 'us');
  });

  it('orders specific-first when authored that way', () => {
    const specificFirst = [
      { ...usWest, order: 0 },
      { ...us, order: 1 },
      world,
      emea,
    ];
    const a = assignTerritory({ data: { country: 'US', state: 'WA' } }, specificFirst);
    assert.equal(a.territoryId, 'us-west');
  });

  it('DENY-BY-DEFAULT: returns null when nothing matches', () => {
    const a = assignTerritory({ data: { country: 'JP' } }, forest);
    assert.equal(a.territoryId, null);
    assert.equal(a.territory, null);
  });

  it('skips disabled territories', () => {
    const disabledUs = [{ ...us, enabled: false }, emea, world];
    const a = assignTerritory({ data: { country: 'US' } }, disabledUs);
    assert.equal(a.territoryId, null);
  });

  it('accepts a bare data bag as well as a {data} record', () => {
    const a = assignTerritory({ region: 'EMEA' }, forest);
    assert.equal(a.territoryId, 'emea');
  });
});

describe('assignmentRuleId + territorySourceFields', () => {
  it('reports the rule that fired', () => {
    const data = { country: 'US', state: 'CA' };
    assert.equal(assignmentRuleId(usWest, data), 'r-c');
    assert.equal(assignmentRuleId(null, data), undefined);
  });

  it('collects distinct source fields', () => {
    assert.deepEqual(territorySourceFields(usWest).sort(), ['country', 'state']);
    assert.deepEqual(territorySourceFields({ rules: [] }), []);
  });
});
