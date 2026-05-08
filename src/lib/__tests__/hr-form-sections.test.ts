import assert from 'node:assert/strict';
import test from 'node:test';

import { getRemainingFields } from '../hr-form-sections';

test('getRemainingFields excludes fields already assigned to sections', () => {
  const fields = [
    { name: 'title' },
    { name: 'body' },
    { name: 'publishAt' },
  ];
  const sections = [
    { title: 'Content', fieldNames: ['title', 'body'] },
    { title: 'Schedule', fieldNames: ['publishAt'] },
  ];

  assert.deepEqual(getRemainingFields(fields, sections), []);
});

test('getRemainingFields returns only truly unsectioned fields', () => {
  const fields = [
    { name: 'title' },
    { name: 'body' },
    { name: 'internalNote' },
  ];
  const sections = [{ title: 'Content', fieldNames: ['title', 'body'] }];

  assert.deepEqual(getRemainingFields(fields, sections), [{ name: 'internalNote' }]);
});
