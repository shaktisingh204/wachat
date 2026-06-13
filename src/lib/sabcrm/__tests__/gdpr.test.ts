/**
 * Unit tests for the PURE GDPR helpers (`../gdpr.ts`).
 *
 * Run: `npx tsx --test src/lib/sabcrm/__tests__/gdpr.test.ts`
 *
 * Covers consent validity (incl. deny-by-default / fail-closed cases), the
 * anonymization (erasure) plan (PII nulled, non-PII untouched, injection-safe,
 * audit marker), and the DSAR bundle shape (counts + envelope).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isConsentValid,
  parseIsoMs,
  anonymizationPlan,
  buildErasureMarker,
  dsarBundleShape,
  normalizeSubjectEmail,
  ERASURE_MARKER_KEY,
  type ConsentRecord,
} from '../gdpr';

const NOW = Date.parse('2026-06-13T12:00:00.000Z');

function consent(over: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    id: 'c1',
    projectId: 'p1',
    subjectEmail: 'jane@example.com',
    purpose: 'marketing',
    status: 'granted',
    grantedAt: '2026-01-01T00:00:00.000Z',
    withdrawnAt: null,
    expiresAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

/* -------------------------------------------------------------------------- */
/* parseIsoMs                                                                   */
/* -------------------------------------------------------------------------- */

test('parseIsoMs: valid ISO → millis; junk → null', () => {
  assert.equal(parseIsoMs('2026-01-01T00:00:00.000Z'), Date.parse('2026-01-01T00:00:00.000Z'));
  assert.equal(parseIsoMs('not-a-date'), null);
  assert.equal(parseIsoMs(''), null);
  assert.equal(parseIsoMs(undefined), null);
  assert.equal(parseIsoMs(123 as unknown), null);
});

/* -------------------------------------------------------------------------- */
/* isConsentValid — happy + deny-by-default                                     */
/* -------------------------------------------------------------------------- */

test('isConsentValid: granted, matching purpose, not expired → true', () => {
  assert.equal(isConsentValid(consent(), 'marketing', NOW), true);
});

test('isConsentValid: purpose match is case/space-insensitive', () => {
  assert.equal(isConsentValid(consent({ purpose: 'Marketing' }), '  marketing ', NOW), true);
});

test('isConsentValid DENY: null / undefined consent → false (fail closed)', () => {
  assert.equal(isConsentValid(null, 'marketing', NOW), false);
  assert.equal(isConsentValid(undefined, 'marketing', NOW), false);
});

test('isConsentValid DENY: status withdrawn → false', () => {
  assert.equal(isConsentValid(consent({ status: 'withdrawn' }), 'marketing', NOW), false);
});

test('isConsentValid DENY: withdrawnAt set even if status granted → false', () => {
  assert.equal(
    isConsentValid(consent({ withdrawnAt: '2026-03-01T00:00:00.000Z' }), 'marketing', NOW),
    false,
  );
});

test('isConsentValid DENY: purpose mismatch → false', () => {
  assert.equal(isConsentValid(consent(), 'analytics', NOW), false);
});

test('isConsentValid DENY: empty requested purpose → false', () => {
  assert.equal(isConsentValid(consent(), '', NOW), false);
});

test('isConsentValid DENY: expired (expiresAt <= now) → false', () => {
  assert.equal(
    isConsentValid(consent({ expiresAt: '2026-06-13T11:59:59.000Z' }), 'marketing', NOW),
    false,
  );
});

test('isConsentValid: future expiry → still valid', () => {
  assert.equal(
    isConsentValid(consent({ expiresAt: '2027-01-01T00:00:00.000Z' }), 'marketing', NOW),
    true,
  );
});

test('isConsentValid DENY: unparseable grantedAt → false (fail closed)', () => {
  assert.equal(isConsentValid(consent({ grantedAt: 'nope' }), 'marketing', NOW), false);
});

test('isConsentValid DENY: grantedAt in the future → false', () => {
  assert.equal(
    isConsentValid(consent({ grantedAt: '2027-01-01T00:00:00.000Z' }), 'marketing', NOW),
    false,
  );
});

/* -------------------------------------------------------------------------- */
/* anonymizationPlan                                                            */
/* -------------------------------------------------------------------------- */

test('anonymizationPlan: nulls present PII, leaves non-PII untouched', () => {
  const data = {
    email: 'jane@example.com',
    phone: '+15551234',
    name: 'Jane',
    stage: 'won', // not PII — must NOT appear in the plan
  };
  const plan = anonymizationPlan(data, ['email', 'phone', 'name'], '2026-06-13T12:00:00.000Z');
  assert.equal(plan.hasChanges, true);
  assert.deepEqual(plan.redactedKeys.sort(), ['email', 'name', 'phone']);
  assert.equal(plan.set['data.email'], null);
  assert.equal(plan.set['data.phone'], null);
  assert.equal(plan.set['data.name'], null);
  // non-PII untouched
  assert.equal('data.stage' in plan.set, false);
  // audit marker present
  assert.deepEqual(plan.set[`data.${ERASURE_MARKER_KEY}`], {
    erasedAt: '2026-06-13T12:00:00.000Z',
    redactedKeys: ['email', 'phone', 'name'],
  });
});

test('anonymizationPlan: absent / already-null PII keys are skipped', () => {
  const data = { email: 'jane@example.com', phone: null };
  // `name` absent, `phone` already null → only `email` redacted.
  const plan = anonymizationPlan(data, ['email', 'phone', 'name']);
  assert.deepEqual(plan.redactedKeys, ['email']);
  assert.equal('data.phone' in plan.set, false);
  assert.equal('data.name' in plan.set, false);
});

test('anonymizationPlan: no PII present → hasChanges false, empty set (no marker)', () => {
  const plan = anonymizationPlan({ stage: 'won' }, ['email', 'phone']);
  assert.equal(plan.hasChanges, false);
  assert.deepEqual(plan.set, {});
  assert.deepEqual(plan.redactedKeys, []);
});

test('anonymizationPlan: injection / prototype-pollution keys are rejected', () => {
  const data: Record<string, unknown> = { email: 'x@y.com' };
  // dotted / $-prefixed / proto keys must never produce a $set entry.
  const plan = anonymizationPlan(data, ['email', 'a.b', '$where', '__proto__', 'constructor']);
  assert.deepEqual(plan.redactedKeys, ['email']);
  assert.equal('data.a.b' in plan.set, false);
  assert.equal('data.$where' in plan.set, false);
  assert.equal('data.__proto__' in plan.set, false);
});

test('anonymizationPlan: null/undefined data → no changes', () => {
  assert.equal(anonymizationPlan(null, ['email']).hasChanges, false);
  assert.equal(anonymizationPlan(undefined, ['email']).hasChanges, false);
});

test('buildErasureMarker: copies keys defensively', () => {
  const keys = ['email'];
  const marker = buildErasureMarker('2026-06-13T12:00:00.000Z', keys);
  keys.push('phone');
  assert.deepEqual(marker.redactedKeys, ['email']); // not affected by later mutation
});

/* -------------------------------------------------------------------------- */
/* dsarBundleShape                                                              */
/* -------------------------------------------------------------------------- */

test('dsarBundleShape: builds versioned envelope with correct counts', () => {
  const bundle = dsarBundleShape({
    projectId: 'p1',
    subjectEmail: 'jane@example.com',
    records: [
      { object: 'people', recordId: 'r1', data: { email: 'jane@example.com' } },
      { object: 'companies', recordId: 'r2', data: {} },
    ],
    activities: [{ activityId: 'a1', type: 'EMAIL', targetRecordId: 'r1' }],
    consents: [consent()],
    generatedAt: '2026-06-13T12:00:00.000Z',
  });
  assert.equal(bundle.version, 1);
  assert.equal(bundle.projectId, 'p1');
  assert.equal(bundle.subjectEmail, 'jane@example.com');
  assert.equal(bundle.generatedAt, '2026-06-13T12:00:00.000Z');
  assert.deepEqual(bundle.counts, { records: 2, activities: 1, consents: 1 });
  assert.equal(bundle.records.length, 2);
  assert.equal(bundle.activities.length, 1);
  assert.equal(bundle.consents.length, 1);
});

test('dsarBundleShape: missing arrays default to empty + zero counts', () => {
  const bundle = dsarBundleShape({
    projectId: 'p1',
    subjectEmail: 'x@y.com',
    records: undefined as never,
    activities: undefined as never,
    consents: undefined as never,
  });
  assert.deepEqual(bundle.counts, { records: 0, activities: 0, consents: 0 });
});

/* -------------------------------------------------------------------------- */
/* normalizeSubjectEmail                                                        */
/* -------------------------------------------------------------------------- */

test('normalizeSubjectEmail: trims + lowercases; non-string → ""', () => {
  assert.equal(normalizeSubjectEmail('  Jane@Example.COM '), 'jane@example.com');
  assert.equal(normalizeSubjectEmail(''), '');
  assert.equal(normalizeSubjectEmail(undefined), '');
  assert.equal(normalizeSubjectEmail(42 as unknown), '');
});
