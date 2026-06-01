import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  STANDARD_OBJECTS,
  STANDARD_OBJECT_SLUGS,
  getStandardObject,
} from '../schema';
import type { FieldMetadata, FieldType, ObjectMetadata } from '../types';

const VALID_FIELD_TYPES: Set<string> = new Set([
  'TEXT',
  'NUMBER',
  'CURRENCY',
  'BOOLEAN',
  'DATE',
  'DATE_TIME',
  'EMAIL',
  'PHONE',
  'LINK',
  'SELECT',
  'MULTI_SELECT',
  'RATING',
  'RELATION',
  'FILE',
]);

// Reserved keys that custom fields cannot use
const RESERVED_FIELD_KEYS = new Set([
  '_id',
  'id',
  'object',
  'userId',
  'createdAt',
  'updatedAt',
]);

/** Validate that a field key follows camelCase convention and is not reserved. */
function isValidFieldKey(key: string): boolean {
  return /^[a-z][a-zA-Z0-9_]*$/.test(key) && !RESERVED_FIELD_KEYS.has(key);
}

/** Validate that an object slug follows kebab-case convention. */
function isValidObjectSlug(slug: string): boolean {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug);
}

test('STANDARD_OBJECTS — each object has exactly one isLabel field', () => {
  for (const obj of STANDARD_OBJECTS) {
    const labelFields = obj.fields.filter((f) => f.isLabel === true);
    assert.equal(
      labelFields.length,
      1,
      `Object "${obj.slug}" must have exactly one isLabel field; found ${labelFields.length}. Labels: ${labelFields.map((f) => f.key).join(', ')}`,
    );
  }
});

test('STANDARD_OBJECTS — all fields have valid types', () => {
  for (const obj of STANDARD_OBJECTS) {
    for (const field of obj.fields) {
      assert.ok(
        VALID_FIELD_TYPES.has(field.type),
        `Field "${field.key}" on object "${obj.slug}" has invalid type "${field.type}"`,
      );
    }
  }
});

test('STANDARD_OBJECTS — all object slugs are unique', () => {
  const slugs = STANDARD_OBJECTS.map((o) => o.slug);
  const uniqueSlugs = new Set(slugs);
  assert.equal(
    slugs.length,
    uniqueSlugs.size,
    `Duplicate object slugs detected: ${JSON.stringify(slugs)}`,
  );
});

test('STANDARD_OBJECTS — all object slugs are valid kebab-case', () => {
  for (const obj of STANDARD_OBJECTS) {
    assert.ok(
      isValidObjectSlug(obj.slug),
      `Object slug "${obj.slug}" is not valid kebab-case`,
    );
  }
});

test('STANDARD_OBJECTS — all field keys are valid camelCase and not reserved', () => {
  for (const obj of STANDARD_OBJECTS) {
    for (const field of obj.fields) {
      assert.ok(
        isValidFieldKey(field.key),
        `Field key "${field.key}" on object "${obj.slug}" is invalid or reserved`,
      );
    }
  }
});

test('STANDARD_OBJECTS — no duplicate field keys within an object', () => {
  for (const obj of STANDARD_OBJECTS) {
    const keys = obj.fields.map((f) => f.key);
    const uniqueKeys = new Set(keys);
    assert.equal(
      keys.length,
      uniqueKeys.size,
      `Object "${obj.slug}" has duplicate field keys: ${JSON.stringify(keys)}`,
    );
  }
});

test('STANDARD_OBJECTS — SELECT/MULTI_SELECT fields have options', () => {
  for (const obj of STANDARD_OBJECTS) {
    for (const field of obj.fields) {
      if (field.type === 'SELECT' || field.type === 'MULTI_SELECT') {
        assert.ok(
          Array.isArray(field.options) && field.options.length > 0,
          `Field "${field.key}" on object "${obj.slug}" of type ${field.type} must have at least one option`,
        );
      }
    }
  }
});

test('STANDARD_OBJECTS — RELATION fields have targetObject', () => {
  for (const obj of STANDARD_OBJECTS) {
    for (const field of obj.fields) {
      if (field.type === 'RELATION') {
        assert.ok(
          field.relation?.targetObject,
          `RELATION field "${field.key}" on object "${obj.slug}" must have relation.targetObject`,
        );
      }
    }
  }
});

test('STANDARD_OBJECTS — all required fields are marked', () => {
  // Verify that fields with required: true are marked correctly
  for (const obj of STANDARD_OBJECTS) {
    for (const field of obj.fields) {
      if (field.required === true) {
        assert.ok(field.key, `Required field on object "${obj.slug}" has no key`);
      }
    }
  }
});

test('STANDARD_OBJECTS — board config references valid groupByField', () => {
  for (const obj of STANDARD_OBJECTS) {
    if (obj.board) {
      const field = obj.fields.find((f) => f.key === obj.board.groupByField);
      assert.ok(
        field,
        `Object "${obj.slug}" has board config with invalid groupByField "${obj.board.groupByField}"`,
      );
      assert.ok(
        field.type === 'SELECT' || field.type === 'MULTI_SELECT',
        `Object "${obj.slug}" board groupByField "${obj.board.groupByField}" must be SELECT or MULTI_SELECT, got ${field.type}`,
      );
    }
  }
});

test('STANDARD_OBJECTS — views array contains only valid values', () => {
  const validViews = new Set(['table', 'board']);
  for (const obj of STANDARD_OBJECTS) {
    for (const view of obj.views) {
      assert.ok(
        validViews.has(view),
        `Object "${obj.slug}" has invalid view "${view}"`,
      );
    }
  }
});

test('STANDARD_OBJECT_SLUGS contains all standard object slugs', () => {
  const expectedSlugs = new Set(STANDARD_OBJECTS.map((o) => o.slug));
  assert.deepEqual(
    STANDARD_OBJECT_SLUGS,
    expectedSlugs,
    'STANDARD_OBJECT_SLUGS set does not match STANDARD_OBJECTS slugs',
  );
});

test('getStandardObject returns the correct object by slug', () => {
  for (const obj of STANDARD_OBJECTS) {
    const fetched = getStandardObject(obj.slug);
    assert.deepEqual(
      fetched,
      obj,
      `getStandardObject("${obj.slug}") returned mismatched object`,
    );
  }
});

test('getStandardObject returns undefined for unknown slug', () => {
  const result = getStandardObject('unknown-object');
  assert.equal(
    result,
    undefined,
    'getStandardObject should return undefined for unknown slug',
  );
});

test('STANDARD_OBJECTS — no field has both isLabel and system set to true', () => {
  for (const obj of STANDARD_OBJECTS) {
    for (const field of obj.fields) {
      assert.ok(
        !(field.isLabel === true && field.system === true),
        `Field "${field.key}" on object "${obj.slug}" cannot be both isLabel and system`,
      );
    }
  }
});

test('STANDARD_OBJECTS — companies object is present and valid', () => {
  const companies = getStandardObject('companies');
  assert.ok(companies, 'Standard object "companies" must exist');
  assert.equal(companies.slug, 'companies');
  assert.equal(companies.labelSingular, 'Company');
  assert.equal(companies.labelPlural, 'Companies');
  assert.equal(companies.standard, true);
});

test('STANDARD_OBJECTS — people object is present and valid', () => {
  const people = getStandardObject('people');
  assert.ok(people, 'Standard object "people" must exist');
  assert.equal(people.slug, 'people');
  assert.equal(people.labelSingular, 'Person');
  assert.equal(people.labelPlural, 'People');
  assert.equal(people.standard, true);
});

test('STANDARD_OBJECTS — opportunities object is present and valid', () => {
  const opportunities = getStandardObject('opportunities');
  assert.ok(opportunities, 'Standard object "opportunities" must exist');
  assert.equal(opportunities.slug, 'opportunities');
  assert.equal(opportunities.labelSingular, 'Opportunity');
  assert.equal(opportunities.labelPlural, 'Opportunities');
  assert.equal(opportunities.standard, true);
});

test('STANDARD_OBJECTS — notes object is present and valid', () => {
  const notes = getStandardObject('notes');
  assert.ok(notes, 'Standard object "notes" must exist');
  assert.equal(notes.slug, 'notes');
  assert.equal(notes.labelSingular, 'Note');
  assert.equal(notes.labelPlural, 'Notes');
  assert.equal(notes.standard, true);
});

test('STANDARD_OBJECTS — tasks object is present and valid', () => {
  const tasks = getStandardObject('tasks');
  assert.ok(tasks, 'Standard object "tasks" must exist');
  assert.equal(tasks.slug, 'tasks');
  assert.equal(tasks.labelSingular, 'Task');
  assert.equal(tasks.labelPlural, 'Tasks');
  assert.equal(tasks.standard, true);
});

test('STANDARD_OBJECTS — activities object is present and valid', () => {
  const activities = getStandardObject('activities');
  assert.ok(activities, 'Standard object "activities" must exist');
  assert.equal(activities.slug, 'activities');
  assert.equal(activities.labelSingular, 'Activity');
  assert.equal(activities.labelPlural, 'Activities');
  assert.equal(activities.standard, true);
});

test('STANDARD_OBJECTS — exactly 6 standard objects exist', () => {
  assert.equal(
    STANDARD_OBJECTS.length,
    6,
    'Expected exactly 6 standard objects (companies, people, opportunities, notes, tasks, activities)',
  );
});

test('STANDARD_OBJECTS — all objects have non-empty views array', () => {
  for (const obj of STANDARD_OBJECTS) {
    assert.ok(
      Array.isArray(obj.views) && obj.views.length > 0,
      `Object "${obj.slug}" must have at least one view`,
    );
  }
});
