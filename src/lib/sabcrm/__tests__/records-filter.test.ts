/**
 * Unit tests for the pure filter / sort helpers in records-filter.ts.
 *
 * Runs with Node's built-in `node:test` + `tsx` so no extra deps are required:
 *   npx tsx --test src/lib/sabcrm/__tests__/records-filter.test.ts
 *
 * No live Mongo connection is needed — every assertion is against plain JS
 * objects that the helper functions return.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildFilter,
  buildSort,
  clampPage,
  clampPageSize,
  conditionToMongo,
  escapeRegExp,
  fieldPath,
  pickLabelField,
  resolveLabel,
  stringifyValue,
  VALID_OPERATORS,
  OPERATORS_REQUIRING_VALUE,
} from '../records-filter';

import type {
  FilterCondition,
  RecordQueryExtended,
  SortKey,
} from '../records-filter';

import type { ObjectMetadata, CrmRecord } from '../types';

/* -------------------------------------------------------------------------- */
/* Shared fixtures                                                             */
/* -------------------------------------------------------------------------- */

/** Minimal ObjectMetadata with TEXT, NUMBER, SELECT, EMAIL, PHONE fields. */
function makeObject(overrides?: Partial<ObjectMetadata>): ObjectMetadata {
  return {
    slug: 'contacts',
    labelSingular: 'Contact',
    labelPlural: 'Contacts',
    icon: 'user',
    views: ['table'],
    fields: [
      { key: 'name',   label: 'Name',   type: 'TEXT',   isLabel: true,  inTable: true, required: true },
      { key: 'email',  label: 'Email',  type: 'EMAIL',  inTable: true },
      { key: 'phone',  label: 'Phone',  type: 'PHONE',  inTable: false },
      { key: 'score',  label: 'Score',  type: 'NUMBER', inTable: true },
      { key: 'stage',  label: 'Stage',  type: 'SELECT', inTable: true,
        options: [
          { value: 'lead',   label: 'Lead',   color: 'blue' },
          { value: 'active', label: 'Active', color: 'green' },
          { value: 'closed', label: 'Closed', color: 'red' },
        ],
      },
      { key: 'site',   label: 'Site',   type: 'LINK',   inTable: false },
    ],
    ...overrides,
  };
}

function makeRecord(overrides?: Partial<CrmRecord>): CrmRecord {
  return {
    _id: 'aabbccddeeff001122334455',
    object: 'contacts',
    userId: 'u1',
    data: { name: 'Alice', email: 'alice@example.com', score: 42 },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* escapeRegExp                                                               */
/* -------------------------------------------------------------------------- */

describe('escapeRegExp', () => {
  it('leaves plain alphanumeric strings unchanged', () => {
    assert.equal(escapeRegExp('hello123'), 'hello123');
  });

  it('escapes all special regex metacharacters', () => {
    const input = '.*+?^${}()|[]\\';
    const escaped = escapeRegExp(input);
    // Every character in the output must be a literal match in a new RegExp.
    const rx = new RegExp(escaped);
    assert.ok(rx.test(input));
  });

  it('escapes a dot so it only matches a literal dot', () => {
    const escaped = escapeRegExp('acme.io');
    const rx = new RegExp(escaped);
    assert.ok(rx.test('acme.io'));
    assert.ok(!rx.test('acmeXio'));
  });

  it('returns empty string for empty input', () => {
    assert.equal(escapeRegExp(''), '');
  });
});

/* -------------------------------------------------------------------------- */
/* fieldPath                                                                  */
/* -------------------------------------------------------------------------- */

describe('fieldPath', () => {
  it('maps audit columns to themselves', () => {
    assert.equal(fieldPath('createdAt'), 'createdAt');
    assert.equal(fieldPath('updatedAt'), 'updatedAt');
  });

  it('prefixes data fields with "data."', () => {
    assert.equal(fieldPath('name'), 'data.name');
    assert.equal(fieldPath('score'), 'data.score');
    assert.equal(fieldPath('stage'), 'data.stage');
  });
});

/* -------------------------------------------------------------------------- */
/* conditionToMongo — valid operators                                         */
/* -------------------------------------------------------------------------- */

describe('conditionToMongo — eq / neq', () => {
  it('eq returns plain value', () => {
    const result = conditionToMongo({ field: 'stage', op: 'eq', value: 'lead' });
    assert.deepEqual(result, { path: 'data.stage', expr: 'lead' });
  });

  it('neq returns $ne', () => {
    const result = conditionToMongo({ field: 'stage', op: 'neq', value: 'closed' });
    assert.deepEqual(result, { path: 'data.stage', expr: { $ne: 'closed' } });
  });

  it('eq on audit column uses the column directly (no data. prefix)', () => {
    const result = conditionToMongo({ field: 'createdAt', op: 'eq', value: '2024-01-01' });
    assert.deepEqual(result, { path: 'createdAt', expr: '2024-01-01' });
  });
});

describe('conditionToMongo — contains / notContains', () => {
  it('contains produces case-insensitive $regex', () => {
    const result = conditionToMongo({ field: 'name', op: 'contains', value: 'alice' });
    assert.deepEqual(result, {
      path: 'data.name',
      expr: { $regex: 'alice', $options: 'i' },
    });
  });

  it('contains escapes regex metacharacters in value', () => {
    const result = conditionToMongo({ field: 'name', op: 'contains', value: 'a.c' });
    assert.deepEqual(result, {
      path: 'data.name',
      expr: { $regex: 'a\\.c', $options: 'i' },
    });
  });

  it('notContains wraps in $not', () => {
    const result = conditionToMongo({ field: 'name', op: 'notContains', value: 'spam' });
    assert.deepEqual(result, {
      path: 'data.name',
      expr: { $not: { $regex: 'spam', $options: 'i' } },
    });
  });
});

describe('conditionToMongo — numeric comparisons', () => {
  it('gt returns $gt', () => {
    const r = conditionToMongo({ field: 'score', op: 'gt', value: 10 });
    assert.deepEqual(r, { path: 'data.score', expr: { $gt: 10 } });
  });

  it('gte returns $gte', () => {
    const r = conditionToMongo({ field: 'score', op: 'gte', value: 10 });
    assert.deepEqual(r, { path: 'data.score', expr: { $gte: 10 } });
  });

  it('lt returns $lt', () => {
    const r = conditionToMongo({ field: 'score', op: 'lt', value: 100 });
    assert.deepEqual(r, { path: 'data.score', expr: { $lt: 100 } });
  });

  it('lte returns $lte', () => {
    const r = conditionToMongo({ field: 'score', op: 'lte', value: 100 });
    assert.deepEqual(r, { path: 'data.score', expr: { $lte: 100 } });
  });
});

describe('conditionToMongo — in / notIn', () => {
  it('in wraps an array value in $in', () => {
    const r = conditionToMongo({ field: 'stage', op: 'in', value: ['lead', 'active'] });
    assert.deepEqual(r, { path: 'data.stage', expr: { $in: ['lead', 'active'] } });
  });

  it('in wraps a scalar value in a single-element $in array', () => {
    const r = conditionToMongo({ field: 'stage', op: 'in', value: 'lead' });
    assert.deepEqual(r, { path: 'data.stage', expr: { $in: ['lead'] } });
  });

  it('notIn wraps an array in $nin', () => {
    const r = conditionToMongo({ field: 'stage', op: 'notIn', value: ['closed'] });
    assert.deepEqual(r, { path: 'data.stage', expr: { $nin: ['closed'] } });
  });

  it('in with undefined value produces $in with [undefined] (not a no-op)', () => {
    // in/notIn are exempted from the "value-less is a no-op" rule in the source.
    const r = conditionToMongo({ field: 'stage', op: 'in', value: undefined });
    assert.deepEqual(r, { path: 'data.stage', expr: { $in: [undefined] } });
  });
});

describe('conditionToMongo — isEmpty / isNotEmpty', () => {
  it('isEmpty matches null or empty string', () => {
    const r = conditionToMongo({ field: 'name', op: 'isEmpty' });
    assert.deepEqual(r, { path: 'data.name', expr: { $in: [null, ''] } });
  });

  it('isNotEmpty requires existence and non-null non-empty', () => {
    const r = conditionToMongo({ field: 'name', op: 'isNotEmpty' });
    assert.deepEqual(r, {
      path: 'data.name',
      expr: { $exists: true, $nin: [null, ''] },
    });
  });

  it('isEmpty ignores any supplied value (value not needed)', () => {
    const r = conditionToMongo({ field: 'name', op: 'isEmpty', value: 'ignored' });
    assert.deepEqual(r, { path: 'data.name', expr: { $in: [null, ''] } });
  });
});

describe('conditionToMongo — no-op cases', () => {
  it('returns null for an empty field string', () => {
    assert.equal(conditionToMongo({ field: '', op: 'eq', value: 'x' }), null);
  });

  it('returns null for an unknown operator', () => {
    // Cast needed to simulate a caller passing an unrecognised string.
    assert.equal(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditionToMongo({ field: 'name', op: 'fuzzy' as any }),
      null,
    );
  });

  it('returns null when eq has no value', () => {
    assert.equal(conditionToMongo({ field: 'name', op: 'eq' }), null);
  });

  it('returns null when eq has null value', () => {
    assert.equal(conditionToMongo({ field: 'name', op: 'eq', value: null }), null);
  });

  it('returns null when eq has empty-string value', () => {
    assert.equal(conditionToMongo({ field: 'name', op: 'eq', value: '' }), null);
  });

  it('returns null when gt has no value', () => {
    assert.equal(conditionToMongo({ field: 'score', op: 'gt' }), null);
  });

  it('returns null when contains has no value', () => {
    assert.equal(conditionToMongo({ field: 'name', op: 'contains' }), null);
  });
});

/* -------------------------------------------------------------------------- */
/* VALID_OPERATORS / OPERATORS_REQUIRING_VALUE membership                     */
/* -------------------------------------------------------------------------- */

describe('operator sets', () => {
  it('VALID_OPERATORS includes all 12 operators', () => {
    const expected = [
      'eq', 'neq', 'contains', 'notContains',
      'gt', 'gte', 'lt', 'lte',
      'in', 'notIn', 'isEmpty', 'isNotEmpty',
    ];
    for (const op of expected) {
      assert.ok(VALID_OPERATORS.has(op), `${op} should be in VALID_OPERATORS`);
    }
    assert.equal(VALID_OPERATORS.size, expected.length);
  });

  it('OPERATORS_REQUIRING_VALUE includes all value-needing operators', () => {
    for (const op of ['eq', 'neq', 'contains', 'notContains', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn']) {
      assert.ok(OPERATORS_REQUIRING_VALUE.has(op as ReturnType<typeof OPERATORS_REQUIRING_VALUE['values']>['next']['prototype']['value']));
    }
    assert.ok(!OPERATORS_REQUIRING_VALUE.has('isEmpty' as never));
    assert.ok(!OPERATORS_REQUIRING_VALUE.has('isNotEmpty' as never));
  });
});

/* -------------------------------------------------------------------------- */
/* buildFilter — scope clauses                                                */
/* -------------------------------------------------------------------------- */

describe('buildFilter — scope and object slug', () => {
  it('always sets projectId, userId, and object slug', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = { object: 'contacts' };
    const filter = buildFilter('proj1', 'user1', query, obj) as Record<string, unknown>;
    assert.equal(filter['projectId'], 'proj1');
    assert.equal(filter['userId'], 'user1');
    assert.equal(filter['object'], 'contacts');
  });
});

/* -------------------------------------------------------------------------- */
/* buildFilter — legacy exact-match filters                                   */
/* -------------------------------------------------------------------------- */

describe('buildFilter — legacy exact-match filters', () => {
  it('adds data.<key> = value for each filter entry', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      filters: { stage: 'lead', score: 5 },
    };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    assert.equal(filter['data.stage'], 'lead');
    assert.equal(filter['data.score'], 5);
  });

  it('skips null, undefined, and empty-string filter values', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      filters: { stage: null, score: undefined, name: '' },
    };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    assert.equal(filter['data.stage'], undefined);
    assert.equal(filter['data.score'], undefined);
    assert.equal(filter['data.name'], undefined);
  });

  it('does not add $and when only legacy filters are present', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      filters: { stage: 'lead' },
    };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    assert.equal(filter['$and'], undefined);
  });
});

/* -------------------------------------------------------------------------- */
/* buildFilter — typed conditions                                              */
/* -------------------------------------------------------------------------- */

describe('buildFilter — typed conditions', () => {
  it('adds a single $and clause for one condition', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      conditions: [{ field: 'stage', op: 'eq', value: 'lead' }],
    };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    const and = filter['$and'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(and), '$and should be an array');
    assert.equal(and.length, 1);
    assert.deepEqual(and[0], { 'data.stage': 'lead' });
  });

  it('ANDs multiple conditions on different fields', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      conditions: [
        { field: 'stage', op: 'eq', value: 'lead' },
        { field: 'score', op: 'gt', value: 10 },
      ],
    };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    const and = filter['$and'] as Array<Record<string, unknown>>;
    assert.equal(and.length, 2);
    assert.deepEqual(and[0], { 'data.stage': 'lead' });
    assert.deepEqual(and[1], { 'data.score': { $gt: 10 } });
  });

  it('ANDs multiple conditions on the SAME field without clobbering', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      conditions: [
        { field: 'score', op: 'gte', value: 10 },
        { field: 'score', op: 'lte', value: 100 },
      ],
    };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    const and = filter['$and'] as Array<Record<string, unknown>>;
    assert.equal(and.length, 2);
    assert.deepEqual(and[0], { 'data.score': { $gte: 10 } });
    assert.deepEqual(and[1], { 'data.score': { $lte: 100 } });
  });

  it('skips no-op conditions (e.g. eq with no value) from $and', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      conditions: [
        { field: 'stage', op: 'eq' },          // no-op: no value
        { field: 'score', op: 'gt', value: 5 }, // valid
      ],
    };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    const and = filter['$and'] as Array<Record<string, unknown>>;
    assert.equal(and.length, 1);
    assert.deepEqual(and[0], { 'data.score': { $gt: 5 } });
  });

  it('omits $and entirely when all conditions are no-ops', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      conditions: [
        { field: 'stage', op: 'eq' },
        { field: 'name',  op: 'contains' },
      ],
    };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    assert.equal(filter['$and'], undefined);
  });

  it('omits $and when conditions array is empty', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = { object: 'contacts', conditions: [] };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    assert.equal(filter['$and'], undefined);
  });

  it('combines legacy filters AND typed conditions independently', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      filters: { stage: 'lead' },
      conditions: [{ field: 'score', op: 'gt', value: 5 }],
    };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    // Legacy filter is a top-level key.
    assert.equal(filter['data.stage'], 'lead');
    // Typed condition ends up in $and.
    const and = filter['$and'] as Array<Record<string, unknown>>;
    assert.equal(and.length, 1);
    assert.deepEqual(and[0], { 'data.score': { $gt: 5 } });
  });

  it('isEmpty condition produces the right $in expression', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      conditions: [{ field: 'name', op: 'isEmpty' }],
    };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    const and = filter['$and'] as Array<Record<string, unknown>>;
    assert.deepEqual(and[0], { 'data.name': { $in: [null, ''] } });
  });

  it('isNotEmpty condition produces $exists + $nin', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      conditions: [{ field: 'email', op: 'isNotEmpty' }],
    };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    const and = filter['$and'] as Array<Record<string, unknown>>;
    assert.deepEqual(and[0], { 'data.email': { $exists: true, $nin: [null, ''] } });
  });

  it('in condition with array wraps in $in', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      conditions: [{ field: 'stage', op: 'in', value: ['lead', 'active'] }],
    };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    const and = filter['$and'] as Array<Record<string, unknown>>;
    assert.deepEqual(and[0], { 'data.stage': { $in: ['lead', 'active'] } });
  });
});

/* -------------------------------------------------------------------------- */
/* buildFilter — free-text search                                             */
/* -------------------------------------------------------------------------- */

describe('buildFilter — search', () => {
  it('adds $or across TEXT/EMAIL/PHONE/LINK fields when search is present', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = { object: 'contacts', search: 'Alice' };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    const or = filter['$or'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(or), '$or should be an array');
    // name (TEXT), email (EMAIL), phone (PHONE), site (LINK) should all be included.
    const paths = or.map((clause) => Object.keys(clause)[0]);
    assert.ok(paths.includes('data.name'));
    assert.ok(paths.includes('data.email'));
    assert.ok(paths.includes('data.phone'));
    assert.ok(paths.includes('data.site'));
    // score (NUMBER) and stage (SELECT) must NOT be in $or.
    assert.ok(!paths.includes('data.score'));
    assert.ok(!paths.includes('data.stage'));
  });

  it('search regex is case-insensitive and metacharacters are escaped', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = { object: 'contacts', search: 'acme.io' };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    const or = filter['$or'] as Array<Record<string, unknown>>;
    const rx = (or[0] as Record<string, { $regex: string; $options: string }>)['data.name'];
    assert.equal(rx.$regex, 'acme\\.io');
    assert.equal(rx.$options, 'i');
  });

  it('trims leading/trailing whitespace from search', () => {
    const obj = makeObject();
    const query1: RecordQueryExtended = { object: 'contacts', search: '  alice  ' };
    const query2: RecordQueryExtended = { object: 'contacts', search: 'alice' };
    const f1 = buildFilter('p', 'u', query1, obj) as Record<string, unknown>;
    const f2 = buildFilter('p', 'u', query2, obj) as Record<string, unknown>;
    const or1 = f1['$or'] as Array<Record<string, unknown>>;
    const or2 = f2['$or'] as Array<Record<string, unknown>>;
    // The $regex value in each clause should be identical after trimming.
    assert.deepEqual(or1, or2);
  });

  it('omits $or when search is empty/whitespace', () => {
    const obj = makeObject();
    for (const search of ['', '   ', undefined]) {
      const query: RecordQueryExtended = { object: 'contacts', search };
      const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
      assert.equal(filter['$or'], undefined, `$or should be absent for search=${JSON.stringify(search)}`);
    }
  });

  it('falls back to { data: rx } when object has no searchable fields', () => {
    const obj = makeObject({
      fields: [
        { key: 'rank', label: 'Rank', type: 'NUMBER' },
        { key: 'active', label: 'Active', type: 'BOOLEAN' },
      ],
    });
    const query: RecordQueryExtended = { object: 'contacts', search: 'test' };
    const filter = buildFilter('p', 'u', query, obj) as Record<string, unknown>;
    const or = filter['$or'] as Array<Record<string, unknown>>;
    assert.equal(or.length, 1);
    assert.ok('data' in or[0]);
  });
});

/* -------------------------------------------------------------------------- */
/* buildSort — multi-key sort                                                 */
/* -------------------------------------------------------------------------- */

describe('buildSort — multi-key sort array', () => {
  it('maps asc to 1 and desc to -1 in declaration order', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      sort: [
        { field: 'name',  dir: 'asc' },
        { field: 'score', dir: 'desc' },
      ],
    };
    const sort = buildSort(query, obj) as Record<string, number>;
    assert.equal(sort['data.name'], 1);
    assert.equal(sort['data.score'], -1);
  });

  it('routes audit columns to top-level paths (no data. prefix)', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      sort: [{ field: 'createdAt', dir: 'desc' }],
    };
    const sort = buildSort(query, obj) as Record<string, number>;
    assert.equal(sort['createdAt'], -1);
    assert.equal(sort['data.createdAt'], undefined);
  });

  it('silently drops unknown field keys', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      sort: [
        { field: 'hackerField', dir: 'asc' },
        { field: 'score',       dir: 'asc' },
      ],
    };
    const sort = buildSort(query, obj) as Record<string, number>;
    assert.equal(sort['data.hackerField'], undefined);
    assert.equal(sort['data.score'], 1);
  });

  it('preserves declaration order (first sort key takes highest priority)', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      sort: [
        { field: 'score', dir: 'desc' },
        { field: 'name',  dir: 'asc' },
      ],
    };
    const sort = buildSort(query, obj) as Record<string, number>;
    const keys = Object.keys(sort);
    assert.equal(keys[0], 'data.score');
    assert.equal(keys[1], 'data.name');
  });

  it('falls back to legacy single-key sort when multi-key all dropped', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = {
      object: 'contacts',
      sort: [{ field: 'invalid', dir: 'asc' }],
      sortBy: 'score',
      sortDir: 'asc',
    };
    const sort = buildSort(query, obj) as Record<string, number>;
    assert.equal(sort['data.score'], 1);
  });
});

/* -------------------------------------------------------------------------- */
/* buildSort — legacy single-key sort                                         */
/* -------------------------------------------------------------------------- */

describe('buildSort — legacy single-key sort', () => {
  it('asc maps to 1 for a known field', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = { object: 'contacts', sortBy: 'score', sortDir: 'asc' };
    const sort = buildSort(query, obj) as Record<string, number>;
    assert.equal(sort['data.score'], 1);
  });

  it('desc maps to -1 for a known field', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = { object: 'contacts', sortBy: 'name', sortDir: 'desc' };
    const sort = buildSort(query, obj) as Record<string, number>;
    assert.equal(sort['data.name'], -1);
  });

  it('defaults to desc (-1) when sortDir is absent', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = { object: 'contacts', sortBy: 'score' };
    const sort = buildSort(query, obj) as Record<string, number>;
    assert.equal(sort['data.score'], -1);
  });

  it('ignores an unknown sortBy field and falls back to newest-first', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = { object: 'contacts', sortBy: 'nonExistentField' };
    const sort = buildSort(query, obj) as Record<string, number>;
    assert.deepEqual(sort, { createdAt: -1 });
  });

  it('defaults to createdAt:-1 when no sort info is provided', () => {
    const obj = makeObject();
    const query: RecordQueryExtended = { object: 'contacts' };
    const sort = buildSort(query, obj) as Record<string, number>;
    assert.deepEqual(sort, { createdAt: -1 });
  });
});

/* -------------------------------------------------------------------------- */
/* clampPageSize / clampPage                                                  */
/* -------------------------------------------------------------------------- */

describe('clampPageSize', () => {
  it('returns 30 for undefined', () => {
    assert.equal(clampPageSize(undefined), 30);
  });

  it('returns 30 for 0 or negative', () => {
    assert.equal(clampPageSize(0), 30);
    assert.equal(clampPageSize(-5), 30);
  });

  it('caps at 200', () => {
    assert.equal(clampPageSize(500), 200);
    assert.equal(clampPageSize(200), 200);
  });

  it('passes through values within range', () => {
    assert.equal(clampPageSize(50), 50);
    assert.equal(clampPageSize(1), 1);
  });
});

describe('clampPage', () => {
  it('returns 1 for undefined', () => {
    assert.equal(clampPage(undefined), 1);
  });

  it('returns 1 for 0 or negative', () => {
    assert.equal(clampPage(0), 1);
    assert.equal(clampPage(-3), 1);
  });

  it('floors fractional pages', () => {
    assert.equal(clampPage(2.9), 2);
    assert.equal(clampPage(1.1), 1);
  });

  it('passes through positive integers', () => {
    assert.equal(clampPage(3), 3);
    assert.equal(clampPage(100), 100);
  });
});

/* -------------------------------------------------------------------------- */
/* pickLabelField                                                             */
/* -------------------------------------------------------------------------- */

describe('pickLabelField', () => {
  it('prefers the field explicitly marked isLabel', () => {
    const obj = makeObject(); // name is isLabel
    const field = pickLabelField(obj);
    assert.equal(field?.key, 'name');
  });

  it('falls back to the first required TEXT/EMAIL field when none is isLabel', () => {
    const obj = makeObject({
      fields: [
        { key: 'code',  label: 'Code',  type: 'NUMBER' },
        { key: 'email', label: 'Email', type: 'EMAIL',  required: true },
        { key: 'bio',   label: 'Bio',   type: 'TEXT' },
      ],
    });
    const field = pickLabelField(obj);
    assert.equal(field?.key, 'email');
  });

  it('falls back to the first TEXT/EMAIL when none is required', () => {
    const obj = makeObject({
      fields: [
        { key: 'rank',  label: 'Rank',  type: 'NUMBER' },
        { key: 'bio',   label: 'Bio',   type: 'TEXT' },
        { key: 'email', label: 'Email', type: 'EMAIL' },
      ],
    });
    const field = pickLabelField(obj);
    assert.equal(field?.key, 'bio');
  });

  it('falls back to the first field of any type when no TEXT/EMAIL exists', () => {
    const obj = makeObject({
      fields: [
        { key: 'rank',  label: 'Rank',  type: 'NUMBER' },
        { key: 'stage', label: 'Stage', type: 'SELECT', options: [] },
      ],
    });
    const field = pickLabelField(obj);
    assert.equal(field?.key, 'rank');
  });

  it('returns undefined for an object with no fields', () => {
    const obj = makeObject({ fields: [] });
    const field = pickLabelField(obj);
    assert.equal(field, undefined);
  });
});

/* -------------------------------------------------------------------------- */
/* stringifyValue                                                             */
/* -------------------------------------------------------------------------- */

describe('stringifyValue', () => {
  it('returns empty string for null / undefined', () => {
    assert.equal(stringifyValue(null), '');
    assert.equal(stringifyValue(undefined), '');
  });

  it('returns string values unchanged', () => {
    assert.equal(stringifyValue('hello'), 'hello');
    assert.equal(stringifyValue(''), '');
  });

  it('converts numbers and booleans to string', () => {
    assert.equal(stringifyValue(42), '42');
    assert.equal(stringifyValue(true), 'true');
    assert.equal(stringifyValue(false), 'false');
  });

  it('joins arrays with ", " filtering empty items', () => {
    assert.equal(stringifyValue(['a', 'b', 'c']), 'a, b, c');
    assert.equal(stringifyValue(['a', null, 'c']), 'a, c');
    assert.equal(stringifyValue([1, 2]), '1, 2');
  });

  it('picks label/name/title/value/url/text from objects (in that priority order)', () => {
    assert.equal(stringifyValue({ label: 'Lab', name: 'Nam' }), 'Lab');
    assert.equal(stringifyValue({ name: 'Nam', title: 'Tit' }), 'Nam');
    assert.equal(stringifyValue({ url: 'https://example.com' }), 'https://example.com');
    assert.equal(stringifyValue({ text: 'Hi' }), 'Hi');
  });

  it('returns empty string for an object with none of the known sub-fields', () => {
    assert.equal(stringifyValue({ foo: 'bar' }), '');
  });
});

/* -------------------------------------------------------------------------- */
/* resolveLabel                                                               */
/* -------------------------------------------------------------------------- */

describe('resolveLabel', () => {
  it('returns the value of the label field when populated', () => {
    const obj = makeObject();   // name is isLabel
    const record = makeRecord({ data: { name: 'Bob', score: 10 } });
    assert.equal(resolveLabel(record, obj), 'Bob');
  });

  it('falls back to "ObjectLabel <last6 of _id>" when label field is empty', () => {
    const obj = makeObject();
    const id = 'aabbccddeeff001122334455';
    const record = makeRecord({ _id: id, data: { name: '', score: 10 } });
    assert.equal(resolveLabel(record, obj), `Contact ${id.slice(-6)}`);
  });

  it('falls back to "ObjectLabel <last6 of _id>" when label field is missing', () => {
    const obj = makeObject();
    const id = 'aabbccddeeff001122334455';
    const record = makeRecord({ _id: id, data: { score: 10 } });
    assert.equal(resolveLabel(record, obj), `Contact ${id.slice(-6)}`);
  });
});
