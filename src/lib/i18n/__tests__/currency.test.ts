/**
 * Currency catalog + FX conversion tests.
 *
 * Run via:
 *   npx tsx --test src/lib/i18n/__tests__/currency.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    CURRENCIES,
    convert,
    getCurrency,
    getFxSnapshot,
    listCurrencies,
    setFxSnapshot,
} from '../currency';

test('catalog ships at least 50 currencies', () => {
    assert.ok(listCurrencies().length >= 50, `expected >= 50 currencies, got ${listCurrencies().length}`);
});

test('USD → USD is a no-op (rounded to 2 decimals)', () => {
    assert.equal(convert(100, 'USD', 'USD'), 100);
});

test('USD → INR uses the default snapshot rate', () => {
    const inr = convert(100, 'USD', 'INR');
    // Snapshot has INR at 83.2 per USD → 8320.
    assert.equal(inr, 8320);
});

test('round-trip USD → EUR → USD stays within 1 cent', () => {
    const eur = convert(100, 'USD', 'EUR');
    const usd = convert(eur, 'EUR', 'USD');
    assert.ok(Math.abs(usd - 100) < 0.01, `expected ~100, got ${usd}`);
});

test('JPY converts with 0 decimal places', () => {
    const jpy = convert(10, 'USD', 'JPY');
    // 10 USD * 149.5 = 1495 — must be an integer because JPY decimals = 0.
    assert.equal(Number.isInteger(jpy), true);
    assert.equal(jpy, 1495);
});

test('Unknown currency throws', () => {
    assert.throws(() => convert(1, 'USD', 'XYZ'), /Unknown currency/);
});

test('setFxSnapshot replaces the active snapshot', () => {
    const prev = getFxSnapshot();
    try {
        setFxSnapshot({ date: '2099-01-01', rates: { USD: 1, EUR: 0.5 } });
        assert.equal(convert(10, 'USD', 'EUR'), 5);
        assert.equal(getFxSnapshot().date, '2099-01-01');
    } finally {
        setFxSnapshot(prev);
    }
});

test('getCurrency is case-insensitive and exposes decimals/symbol', () => {
    const inr = getCurrency('inr');
    assert.ok(inr);
    assert.equal(inr!.code, 'INR');
    assert.equal(inr!.symbol, '₹');
    assert.equal(inr!.decimals, 2);
    assert.equal(CURRENCIES.JPY.decimals, 0);
});
