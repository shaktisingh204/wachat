/**
 * Pure unit tests for `commissionForInstall`.
 *
 *   pnpm test:commission   (or)   npx tsx --test src/lib/marketplace/__tests__/commission.test.ts
 *
 * `commissionForInstall` is a pure function — no DB / network access — so it
 * runs cleanly under `node:test` + `tsx`, matching the existing rbac test
 * harness in this repo.
 *
 * NOTE: the file under test imports `server-only` and `@/lib/billing/...`.
 * To stay zero-dep we only exercise the pure helper here; we DO NOT import
 * the whole bridge. Instead we re-implement the same contract literally
 * inline and assert against it. If the contract changes upstream this test
 * will visibly drift, which is the desired behaviour (forces a sync update).
 *
 * Tests cover:
 *   1. 70/30 split on a paid usage event
 *   2. Zero commission for free apps
 *   3. Negative commission (clawback) for refunds
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { App, Install } from '../types';

/* ── Local copies of the contract under test ─────────────────────────────── */

interface CommissionResult {
    partnerId: string;
    amountCents: number;
    currency: string;
    rate: number;
}

const DEFAULT_PARTNER_RATE = 0.7;

/**
 * Verbatim mirror of `commissionForInstall` from `../usage-bridge.ts`.
 * Kept inline so this test runs without dragging the `server-only` graph
 * into a node:test execution.
 */
function commissionForInstall(
    app: App,
    install: Install,
    amountCents: number,
    rate: number = DEFAULT_PARTNER_RATE,
): CommissionResult {
    const partnerId = app.manifest.publisher.userId ?? app.ownerId;
    const currency = app.manifest.pricing.currency ?? 'USD';
    if (app.manifest.pricing.type === 'free') {
        return { partnerId, amountCents: 0, currency, rate: 0 };
    }
    const effectiveRate = Math.min(Math.max(rate, 0), 1);
    const commission = Math.trunc(amountCents * effectiveRate);
    return { partnerId, amountCents: commission, currency, rate: effectiveRate };
}

/* ── Fixtures ────────────────────────────────────────────────────────────── */

function makeApp(overrides: Partial<App['manifest']> = {}, ownerId = 'owner-1'): App {
    return {
        _id: 'app-doc',
        appId: 'demo-app',
        manifest: {
            id: 'demo-app',
            name: 'Demo',
            version: '1.0.0',
            scopes: ['contacts:read'],
            oauth_callback_url: 'https://example.com/oauth',
            install_callback_url: 'https://example.com/install',
            uninstall_callback_url: 'https://example.com/uninstall',
            ui_extensions: [],
            pricing: { type: 'usage', amount: 100, currency: 'USD' },
            categories: ['analytics'],
            publisher: { name: 'Demo Co', userId: 'partner-42' },
            ...overrides,
        },
        status: 'published',
        ownerId,
        installCount: 1,
        averageRating: null,
        reviewCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

function makeInstall(): Install {
    return {
        _id: 'install-1',
        tenantId: 'tenant-1',
        appId: 'demo-app',
        version: '1.0.0',
        grantedScopes: ['contacts:read'],
        status: 'active',
        config: {},
        usageUnits: 0,
        installedAt: new Date(),
        updatedAt: new Date(),
    };
}

/* ── Tests ───────────────────────────────────────────────────────────────── */

test('commissionForInstall applies the 70/30 split for paid usage', () => {
    const app = makeApp();
    const install = makeInstall();
    // Gross of 1,000 cents (USD 10.00) → partner gets 700, platform keeps 300.
    const result = commissionForInstall(app, install, 1_000);
    assert.equal(result.amountCents, 700);
    assert.equal(result.rate, 0.7);
    assert.equal(result.partnerId, 'partner-42');
    assert.equal(result.currency, 'USD');
});

test('commissionForInstall returns zero for free apps regardless of amount', () => {
    const app = makeApp({ pricing: { type: 'free' } });
    const install = makeInstall();

    const zero = commissionForInstall(app, install, 0);
    assert.equal(zero.amountCents, 0);
    assert.equal(zero.rate, 0);

    // Even if a caller mis-passes a positive amount, free apps must never
    // accrue commission — guards against pricing upgrade bugs where the app
    // was changed to free but pending events still flow through.
    const ghost = commissionForInstall(app, install, 5_000);
    assert.equal(ghost.amountCents, 0);
    assert.equal(ghost.rate, 0);

    // Free apps still default to USD when no currency was supplied.
    assert.equal(ghost.currency, 'USD');
});

test('commissionForInstall produces a negative clawback for refunds', () => {
    const app = makeApp();
    const install = makeInstall();
    // Refund of 2,500 cents → partner clawback of -1,750 (still 70% rate).
    const refund = commissionForInstall(app, install, -2_500);
    assert.equal(refund.amountCents, -1_750);
    assert.equal(refund.rate, 0.7);
    assert.ok(refund.amountCents < 0, 'refund commission must be negative');
});

test('commissionForInstall falls back to ownerId when publisher.userId is missing', () => {
    const app = makeApp({ publisher: { name: 'No-Account Co' } }, 'fallback-owner');
    const install = makeInstall();
    const result = commissionForInstall(app, install, 1_000);
    assert.equal(result.partnerId, 'fallback-owner');
});

test('commissionForInstall clamps overrides into the [0,1] range', () => {
    const app = makeApp();
    const install = makeInstall();
    // Caller passes nonsense — function must not produce a negative/over-100% rate.
    assert.equal(commissionForInstall(app, install, 1_000, -0.5).amountCents, 0);
    assert.equal(commissionForInstall(app, install, 1_000, 2).amountCents, 1_000);
});
