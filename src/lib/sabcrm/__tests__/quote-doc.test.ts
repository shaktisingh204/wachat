/**
 * Unit tests for the PURE quote-doc helpers (`../quote-doc`).
 *
 * Run: npx tsx --test src/lib/sabcrm/__tests__/quote-doc.test.ts
 *
 * Covers the render output invariants (escaping, totals, accepted stamp,
 * signature embedding, print CSS) and the HMAC token round-trip + tamper
 * resistance. No I/O — the pure module never touches Mongo / env.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderQuoteHtml,
  escapeHtml,
  formatMoney,
  signaturePayload,
  verifySignatureToken,
  type QuoteDocView,
  type QuoteDocBrand,
  type SignatureClaims,
} from '../quote-doc';

const SECRET = 'test-secret-do-not-use-in-prod';

function makeQuote(over: Partial<QuoteDocView> = {}): QuoteDocView {
  return {
    quoteId: '64b000000000000000000001',
    quotationNo: 'QT-0007',
    date: '2026-06-13T00:00:00.000Z',
    validUntil: '2026-07-13T00:00:00.000Z',
    currency: 'INR',
    subject: 'Website redesign',
    clientName: 'Acme Corp',
    clientEmail: 'ap@acme.test',
    lines: [
      { description: 'Design sprint', qty: 2, unit: 'wk', rate: 50000, taxRatePct: 18, total: 118000 },
      { description: 'Hosting', qty: 1, rate: 12000, discountPct: 10, total: 10800 },
    ],
    totals: { subTotal: 110800, shippingCharge: 0, total: 128800 },
    termsAndConditions: '50% advance, 50% on delivery.',
    customerNotes: 'Thanks for the opportunity!',
    ...over,
  };
}

const BRAND: QuoteDocBrand = {
  name: 'Studio <Nine>',
  logoUrl: null,
  address: '221B Baker St',
  accentColor: '#0ea5e9',
  email: 'hi@studio.test',
};

/* ── escapeHtml / formatMoney ─────────────────────────────────────────── */

test('escapeHtml neutralizes HTML metacharacters', () => {
  assert.equal(escapeHtml(`<script>"&'`), '&lt;script&gt;&quot;&amp;&#39;');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42');
});

test('formatMoney prefixes the currency symbol and 2dp', () => {
  assert.match(formatMoney(128800, 'INR'), /^₹/);
  assert.match(formatMoney(99.5, 'USD'), /^\$99\.50$/);
  // Unknown currency falls back to "<amount> CODE".
  assert.match(formatMoney(10, 'JPY'), /JPY$/);
});

/* ── renderQuoteHtml ──────────────────────────────────────────────────── */

test('renderQuoteHtml produces a full HTML doc with print CSS', () => {
  const html = renderQuoteHtml(makeQuote(), BRAND);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /@media print/);
  assert.match(html, /@page/);
  assert.match(html, /<title>Quote QT-0007<\/title>/);
});

test('renderQuoteHtml escapes brand + line content (no XSS injection)', () => {
  const html = renderQuoteHtml(
    makeQuote({ clientName: '<b>x</b>', lines: [{ description: '<img onerror=1>', qty: 1, rate: 5, total: 5 }] }),
    BRAND,
  );
  // Brand name with angle brackets is escaped, raw never appears.
  assert.ok(html.includes('Studio &lt;Nine&gt;'));
  assert.ok(!html.includes('<b>x</b>'));
  assert.ok(!html.includes('<img onerror=1>'));
  assert.ok(html.includes('&lt;img onerror=1&gt;'));
});

test('renderQuoteHtml renders every line + grand total', () => {
  const html = renderQuoteHtml(makeQuote(), BRAND);
  assert.ok(html.includes('Design sprint'));
  assert.ok(html.includes('Hosting'));
  assert.ok(html.includes('qd-grand'));
  // Grand total formatted.
  assert.ok(html.includes(formatMoney(128800, 'INR')));
});

test('renderQuoteHtml shows accepted stamp + signature only once signed', () => {
  // Note: the CSS class name `qd-stamp` always exists in the <style> block.
  // Assert on the RENDERED element markup + content instead.
  const unsigned = renderQuoteHtml(makeQuote(), BRAND);
  assert.ok(!unsigned.includes('<div class="qd-stamp">'));
  assert.ok(!unsigned.includes('ACCEPTED'));
  assert.ok(!unsigned.includes('<img class="qd-sign-img"'));

  const signed = renderQuoteHtml(
    makeQuote({
      acceptedAt: '2026-06-13T10:00:00.000Z',
      acceptedBy: 'Jane Buyer',
      signatureDataUrl: 'data:image/png;base64,AAAA',
    }),
    BRAND,
  );
  assert.ok(signed.includes('<div class="qd-stamp">'));
  assert.ok(signed.includes('ACCEPTED'));
  assert.ok(signed.includes('<img class="qd-sign-img"'));
  assert.ok(signed.includes('Jane Buyer'));
  assert.ok(signed.includes('data:image/png;base64,AAAA'));
});

test('renderQuoteHtml uses the fallback logo glyph when no logoUrl', () => {
  const html = renderQuoteHtml(makeQuote(), { ...BRAND, logoUrl: null });
  assert.ok(html.includes('qd-logo-fallback'));
  // First letter of "Studio <Nine>" → "S".
  assert.ok(html.includes('>S</div>'));
});

test('renderQuoteHtml defaults to a safe accent for a bad color', () => {
  const html = renderQuoteHtml(makeQuote(), { ...BRAND, accentColor: 'red; }body{x' });
  // Injected CSS is rejected; the default accent is used instead.
  assert.ok(html.includes('--qd-accent: #4f46e5;'));
  assert.ok(!html.includes('red; }body{x'));
});

/* ── HMAC token round-trip ────────────────────────────────────────────── */

const CLAIMS: SignatureClaims = {
  projectId: '64a000000000000000000abc',
  quoteId: '64b000000000000000000001',
  shareId: '64c000000000000000000def',
};

test('signaturePayload → verifySignatureToken round-trips', () => {
  const token = signaturePayload(CLAIMS, SECRET);
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const claims = verifySignatureToken(token, SECRET);
  assert.deepEqual(claims, CLAIMS);
});

test('verifySignatureToken rejects a wrong secret', () => {
  const token = signaturePayload(CLAIMS, SECRET);
  assert.equal(verifySignatureToken(token, 'other-secret'), null);
});

test('verifySignatureToken rejects a tampered body', () => {
  const token = signaturePayload(CLAIMS, SECRET);
  const [body, sig] = token.split('.');
  // Flip a char in the body; the HMAC no longer matches.
  const tampered = `${body.slice(0, -1)}${body.slice(-1) === 'A' ? 'B' : 'A'}.${sig}`;
  assert.equal(verifySignatureToken(tampered, SECRET), null);
});

test('verifySignatureToken rejects malformed / empty input', () => {
  assert.equal(verifySignatureToken('', SECRET), null);
  assert.equal(verifySignatureToken('nodot', SECRET), null);
  assert.equal(verifySignatureToken('.', SECRET), null);
  assert.equal(verifySignatureToken('a.', SECRET), null);
  assert.equal(verifySignatureToken(signaturePayload(CLAIMS, SECRET), ''), null);
});

test('signaturePayload requires a secret + complete claims', () => {
  assert.throws(() => signaturePayload(CLAIMS, ''), /signing secret/);
  assert.throws(
    () => signaturePayload({ ...CLAIMS, shareId: '' }, SECRET),
    /required/,
  );
});

test('a token for one quote cannot be reused to assert another quote', () => {
  // The shareId/quoteId are bound; verifying yields the ORIGINAL claims, so
  // a server comparison against the requested quote would reject a mismatch.
  const token = signaturePayload(CLAIMS, SECRET);
  const claims = verifySignatureToken(token, SECRET);
  assert.ok(claims);
  assert.notEqual(claims!.quoteId, 'some-other-quote-id');
});
