/**
 * Unit tests for v3.4 cross-tenant SMS-pumping risk scoring.
 *
 *   npx tsx --test src/lib/sabsms/governance/__tests__/pumping-risk.test.ts
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { scorePumpingRisk } from '../pumping-risk';

test('quiet, converting traffic is low risk', () => {
  const v = scorePumpingRisk({
    crossTenantSends: 8,
    distinctTenants: 1,
    crossTenantConversions: 6,
  });
  assert.equal(v.level, 'low');
  assert.ok(v.score < 40);
});

test('high volume across many tenants with zero conversions is high risk', () => {
  const v = scorePumpingRisk({
    crossTenantSends: 60,
    distinctTenants: 5,
    crossTenantConversions: 0,
  });
  assert.equal(v.level, 'high');
  assert.ok(v.score >= 70);
  assert.ok(v.reasons.includes('very_high_volume'));
  assert.ok(v.reasons.includes('multi_tenant_target'));
  assert.ok(v.reasons.includes('zero_conversion'));
});

test('the cross-tenant tell raises risk even at moderate volume', () => {
  const single = scorePumpingRisk({
    crossTenantSends: 22,
    distinctTenants: 1,
    crossTenantConversions: 0,
  });
  const multi = scorePumpingRisk({
    crossTenantSends: 22,
    distinctTenants: 4,
    crossTenantConversions: 0,
  });
  assert.ok(multi.score > single.score, 'multi-tenant targeting must score higher');
});

test('score is clamped to 100', () => {
  const v = scorePumpingRisk({
    crossTenantSends: 500,
    distinctTenants: 50,
    crossTenantConversions: 0,
  });
  assert.equal(v.score, 100);
});
