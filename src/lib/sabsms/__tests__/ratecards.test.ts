/**
 * V2.13 — reseller rate-card resolution tests (pure).
 *
 *   npx tsx --test src/lib/sabsms/__tests__/ratecards.test.ts
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { creditCostFor } from '../credits/rates';
import {
  creditCostWithCard,
  matchRate,
  pickRateCard,
  type SabsmsRateCardLike,
} from '../ratecards/resolve';

const NOW = new Date('2026-06-12T00:00:00.000Z');
const CHILD = 'aaaaaaaaaaaaaaaaaaaaaaaa';

function card(overrides: Partial<SabsmsRateCardLike>): SabsmsRateCardLike {
  return {
    workspaceId: 'reseller1',
    name: 'test',
    rates: [{ country: 'IN', creditsPerSegment: 2 }],
    childWorkspaceIds: [CHILD],
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('pickRateCard', () => {
  it('returns null when the workspace is not a child of any card', () => {
    assert.equal(pickRateCard([card({ childWorkspaceIds: ['other'] })], CHILD, NOW), null);
  });

  it('latest effectiveFrom <= now wins', () => {
    const older = card({ name: 'old', effectiveFrom: new Date('2026-01-01T00:00:00Z') });
    const newer = card({ name: 'new', effectiveFrom: new Date('2026-06-01T00:00:00Z') });
    const picked = pickRateCard([older, newer], CHILD, NOW);
    assert.equal(picked?.name, 'new');
  });

  it('future (staged) cards are ignored', () => {
    const staged = card({ name: 'staged', effectiveFrom: new Date('2026-07-01T00:00:00Z') });
    const active = card({ name: 'active', effectiveFrom: new Date('2026-01-01T00:00:00Z') });
    const picked = pickRateCard([staged, active], CHILD, NOW);
    assert.equal(picked?.name, 'active');
  });

  it('all cards in the future → null', () => {
    const staged = card({ effectiveFrom: new Date('2027-01-01T00:00:00Z') });
    assert.equal(pickRateCard([staged], CHILD, NOW), null);
  });
});

describe('matchRate precedence', () => {
  const rates = [
    { country: '*', creditsPerSegment: 5 },
    { country: 'IN', creditsPerSegment: 3 },
    { country: 'IN', channel: 'sms' as const, creditsPerSegment: 2 },
    { country: 'IN', channel: 'sms' as const, category: 'otp' as const, creditsPerSegment: 1 },
  ];

  it('most specific row wins', () => {
    assert.equal(
      matchRate(rates, { destinationCountry: 'IN', channel: 'sms', category: 'otp' })
        ?.creditsPerSegment,
      1,
    );
    assert.equal(
      matchRate(rates, { destinationCountry: 'IN', channel: 'sms', category: 'marketing' })
        ?.creditsPerSegment,
      2,
    );
    assert.equal(
      matchRate(rates, { destinationCountry: 'IN', channel: 'mms' })?.creditsPerSegment,
      3,
    );
  });

  it("exact country beats '*'", () => {
    assert.equal(
      matchRate(rates, { destinationCountry: 'US', channel: 'sms' })?.creditsPerSegment,
      5,
    );
  });

  it('constrained rows that do not match are skipped entirely', () => {
    const only = [{ country: 'IN', channel: 'rcs' as const, creditsPerSegment: 9 }];
    assert.equal(matchRate(only, { destinationCountry: 'IN', channel: 'sms' }), null);
  });

  it('case-insensitive country compare', () => {
    assert.equal(
      matchRate(rates, { destinationCountry: 'in', channel: 'mms' })?.creditsPerSegment,
      3,
    );
  });
});

describe('creditCostWithCard', () => {
  it('uses the card rate × segments', () => {
    const c = card({ rates: [{ country: 'IN', creditsPerSegment: 2 }] });
    assert.equal(
      creditCostWithCard(c, { segments: 3, destinationCountry: 'IN', channel: 'sms' }),
      6,
    );
  });

  it('falls back to the default table when no row matches', () => {
    const c = card({ rates: [{ country: 'GB', creditsPerSegment: 7 }] });
    const expected = creditCostFor({ segments: 2, destinationCountry: 'US', channel: 'sms' });
    assert.equal(
      creditCostWithCard(c, { segments: 2, destinationCountry: 'US', channel: 'sms' }),
      expected,
    );
  });

  it('null card = default table (precedence floor)', () => {
    const expected = creditCostFor({ segments: 1, destinationCountry: 'IN', channel: 'sms' });
    assert.equal(
      creditCostWithCard(null, { segments: 1, destinationCountry: 'IN', channel: 'sms' }),
      expected,
    );
  });

  it('RCS is flat per message under a card', () => {
    const c = card({ rates: [{ country: '*', channel: 'rcs', creditsPerSegment: 2 }] });
    assert.equal(
      creditCostWithCard(c, { segments: 5, destinationCountry: 'IN', channel: 'rcs' }),
      2,
    );
  });

  it('fractional card rates round UP and never go below 1 credit', () => {
    const c = card({ rates: [{ country: 'IN', creditsPerSegment: 0.4 }] });
    assert.equal(
      creditCostWithCard(c, { segments: 1, destinationCountry: 'IN', channel: 'sms' }),
      1,
    );
    assert.equal(
      creditCostWithCard(c, { segments: 4, destinationCountry: 'IN', channel: 'sms' }),
      2, // 0.4 × 4 = 1.6 → ceil 2
    );
  });
});
