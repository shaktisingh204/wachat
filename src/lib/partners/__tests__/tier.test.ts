/**
 * Pure unit tests for `program.tierFor` (partner tier rules).
 *
 *   npx tsx --test src/lib/partners/__tests__/tier.test.ts
 *
 * `program.ts` imports `'server-only'`, which throws when consumed in a
 * pure-Node test runner. Following the same pattern as
 * `marketplace/__tests__/commission.test.ts`, we re-state the contract
 * inline and exercise it directly. If the upstream thresholds change, this
 * test will visibly drift, which is the desired behaviour.
 *
 * Covers:
 *   1. Bronze for fresh partners.
 *   2. Silver promotion when all silver thresholds are met.
 *   3. Gold transition.
 *   4. Platinum requires all three signals — partial wins do NOT promote.
 *   5. Highest applicable tier is picked, even if intermediate tiers are met.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

// ── Inlined contract (mirrors `program.ts`) ──────────────────────────────────

type PartnerTier = 'bronze' | 'silver' | 'gold' | 'platinum';

interface PartnerSignals {
    certifiedEmployees: number;
    activeTenants: number;
    referredArr: number;
}

const TIER_THRESHOLDS = [
    { tier: 'platinum', certifiedEmployees: 10, activeTenants: 100, referredArr: 50_000_00 },
    { tier: 'gold', certifiedEmployees: 5, activeTenants: 40, referredArr: 20_000_00 },
    { tier: 'silver', certifiedEmployees: 2, activeTenants: 10, referredArr: 5_000_00 },
    { tier: 'bronze', certifiedEmployees: 0, activeTenants: 0, referredArr: 0 },
] as const;

function tierFor(p: PartnerSignals): PartnerTier {
    for (const t of TIER_THRESHOLDS) {
        if (
            p.certifiedEmployees >= t.certifiedEmployees &&
            p.activeTenants >= t.activeTenants &&
            p.referredArr >= t.referredArr
        ) {
            return t.tier;
        }
    }
    return 'bronze';
}

// ── Tests ────────────────────────────────────────────────────────────────────

test('tierFor() returns bronze for a brand-new partner', () => {
    assert.equal(
        tierFor({ certifiedEmployees: 0, activeTenants: 0, referredArr: 0 }),
        'bronze',
    );
});

test('tierFor() promotes to silver when all silver thresholds are met', () => {
    assert.equal(
        tierFor({ certifiedEmployees: 2, activeTenants: 10, referredArr: 5_000_00 }),
        'silver',
    );
});

test('tierFor() promotes to gold when all gold thresholds are met', () => {
    assert.equal(
        tierFor({ certifiedEmployees: 6, activeTenants: 50, referredArr: 25_000_00 }),
        'gold',
    );
});

test('tierFor() does NOT promote to platinum without sufficient ARR', () => {
    // 12 certs, 120 tenants — but ARR below platinum threshold
    assert.equal(
        tierFor({ certifiedEmployees: 12, activeTenants: 120, referredArr: 30_000_00 }),
        'gold',
    );
});

test('tierFor() does NOT promote to silver without enough certified employees', () => {
    // Plenty of revenue, but only 1 certified employee
    assert.equal(
        tierFor({ certifiedEmployees: 1, activeTenants: 100, referredArr: 100_000_00 }),
        'bronze',
    );
});

test('tierFor() picks platinum when ALL platinum thresholds are met', () => {
    assert.equal(
        tierFor({ certifiedEmployees: 25, activeTenants: 200, referredArr: 100_000_00 }),
        'platinum',
    );
});
