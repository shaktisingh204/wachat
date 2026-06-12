/**
 * Unit tests for the SabSMS link-shortener pure core (`../links-core.ts`).
 *
 *   npx tsx --test src/lib/sabsms/__tests__/links.test.ts
 *
 * DB-dependent parts (`../links.ts` — insert/retry, click recording)
 * are exercised against a live stack, not here — same split as the
 * V2.0 suites.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  SLUG_ALPHABET,
  SLUG_LENGTH,
  extractUrls,
  generateSlug,
  hashIp,
  isAlreadyShortened,
  isValidTargetUrl,
  normalizeShortLinkDomain,
  replaceUrls,
  resolveShortLinkBase,
  reuseFilterFor,
} from '../links-core';

// ─── Slug generation ──────────────────────────────────────────────────────

test('slug is 7 chars by default', () => {
  assert.equal(generateSlug().length, SLUG_LENGTH);
  assert.equal(SLUG_LENGTH, 7);
});

test('slug uses only base62 characters', () => {
  assert.equal(SLUG_ALPHABET.length, 62);
  for (let i = 0; i < 200; i++) {
    const slug = generateSlug();
    assert.match(slug, /^[A-Za-z0-9]{7}$/, `bad slug: ${slug}`);
  }
});

test('slug honours a custom length', () => {
  assert.equal(generateSlug(12).length, 12);
  assert.equal(generateSlug(1).length, 1);
});

test('consecutive slugs differ (62^7 space)', () => {
  const a = generateSlug();
  const b = generateSlug();
  assert.notEqual(a, b);
});

// ─── URL validation ───────────────────────────────────────────────────────

test('isValidTargetUrl accepts http and https only', () => {
  assert.equal(isValidTargetUrl('https://example.com/a?b=c'), true);
  assert.equal(isValidTargetUrl('http://localhost:3000/x'), true);
  assert.equal(isValidTargetUrl('ftp://example.com'), false);
  assert.equal(isValidTargetUrl('javascript:alert(1)'), false);
  assert.equal(isValidTargetUrl('example.com/no-scheme'), false);
  assert.equal(isValidTargetUrl(''), false);
});

// ─── URL extraction ───────────────────────────────────────────────────────

test('extracts multiple URLs in order of appearance', () => {
  const urls = extractUrls(
    'Sale at https://shop.example.com/deals and details on http://example.org/info now',
  );
  assert.deepEqual(urls, [
    'https://shop.example.com/deals',
    'http://example.org/info',
  ]);
});

test('keeps query strings and fragments intact', () => {
  const urls = extractUrls(
    'Track: https://t.example.com/p?utm_source=sms&id=42#top',
  );
  assert.deepEqual(urls, ['https://t.example.com/p?utm_source=sms&id=42#top']);
});

test('strips trailing sentence punctuation', () => {
  assert.deepEqual(extractUrls('Go to https://x.example.com/a.'), [
    'https://x.example.com/a',
  ]);
  assert.deepEqual(extractUrls('See (https://x.example.com/a), ok?'), [
    'https://x.example.com/a',
  ]);
  assert.deepEqual(extractUrls('Really? https://x.example.com/a!?'), [
    'https://x.example.com/a',
  ]);
  // A bare trailing "?" is punctuation, not a query string.
  assert.deepEqual(extractUrls('Visit https://x.example.com?'), [
    'https://x.example.com',
  ]);
});

test('inner punctuation survives — only the tail is trimmed', () => {
  assert.deepEqual(extractUrls('https://x.example.com/a,b/c.d?e=f,g.'), [
    'https://x.example.com/a,b/c.d?e=f,g',
  ]);
});

test('deduplicates repeated URLs', () => {
  const urls = extractUrls(
    'https://x.example.com/a then https://x.example.com/a again',
  );
  assert.deepEqual(urls, ['https://x.example.com/a']);
});

test('ignores non-http schemes and plain text', () => {
  assert.deepEqual(extractUrls('mailto:a@b.com ftp://x.com no urls here'), []);
  assert.deepEqual(extractUrls(''), []);
});

// ─── Already-shortened skip ───────────────────────────────────────────────

test('skips URLs under a short-link base', () => {
  const bases = ['https://sab.sm', 'http://localhost:3000/s'];
  assert.equal(isAlreadyShortened('https://sab.sm/Ab3xY9k', bases), true);
  assert.equal(isAlreadyShortened('HTTPS://SAB.SM/Ab3xY9k', bases), true);
  assert.equal(isAlreadyShortened('http://localhost:3000/s/q1W2e3R', bases), true);
  assert.equal(isAlreadyShortened('https://sab.sm', bases), true);
});

test('does not skip lookalike hosts or other paths', () => {
  const bases = ['https://sab.sm', 'http://localhost:3000/s'];
  assert.equal(isAlreadyShortened('https://sab.smx.com/a', bases), false);
  assert.equal(isAlreadyShortened('http://localhost:3000/share/x', bases), false);
  assert.equal(isAlreadyShortened('https://example.com/s/abc', bases), false);
});

test('extraction + skip composes (the shortenUrlsInBody filter)', () => {
  const base = 'https://sab.sm';
  const body =
    'New: https://shop.example.com/x — old link https://sab.sm/q1W2e3R still works';
  const candidates = extractUrls(body).filter(
    (u) => !isAlreadyShortened(u, [base]),
  );
  assert.deepEqual(candidates, ['https://shop.example.com/x']);
});

// ─── Replacement ──────────────────────────────────────────────────────────

test('replaces every occurrence of each URL', () => {
  const out = replaceUrls('a https://x.co/p b https://x.co/p c', [
    { from: 'https://x.co/p', to: 'https://sab.sm/AAAAAAA' },
  ]);
  assert.equal(out, 'a https://sab.sm/AAAAAAA b https://sab.sm/AAAAAAA c');
});

test('longest URL replaces first — prefixes never corrupt longer URLs', () => {
  const out = replaceUrls('root https://x.co and page https://x.co/page', [
    { from: 'https://x.co', to: 'https://sab.sm/SHORT11' },
    { from: 'https://x.co/page', to: 'https://sab.sm/SHORT22' },
  ]);
  assert.equal(
    out,
    'root https://sab.sm/SHORT11 and page https://sab.sm/SHORT22',
  );
});

// ─── Branded-domain normalization ─────────────────────────────────────────

test('normalizeShortLinkDomain strips scheme + trailing slash, lowercases', () => {
  assert.equal(normalizeShortLinkDomain('https://Sab.SM/'), 'sab.sm');
  assert.equal(normalizeShortLinkDomain('http://links.example.co.in'), 'links.example.co.in');
  assert.equal(normalizeShortLinkDomain('  sab.sm  '), 'sab.sm');
});

test('normalizeShortLinkDomain rejects non-hostnames', () => {
  assert.equal(normalizeShortLinkDomain(''), null);
  assert.equal(normalizeShortLinkDomain('sab.sm/path'), null);
  assert.equal(normalizeShortLinkDomain('sab.sm:8080'), null);
  assert.equal(normalizeShortLinkDomain('no-tld'), null);
  assert.equal(normalizeShortLinkDomain('has space.com'), null);
  assert.equal(normalizeShortLinkDomain('-bad.com'), null);
});

// ─── Base resolution ──────────────────────────────────────────────────────

test('workspace branded domain wins', () => {
  const base = resolveShortLinkBase({
    workspaceDomain: 'https://Sab.SM/',
    env: { SABSMS_SHORT_LINK_BASE: 'https://env.example', NEXT_PUBLIC_APP_URL: 'https://app.example' },
  });
  assert.equal(base, 'https://sab.sm');
});

test('SABSMS_SHORT_LINK_BASE is next, trailing slash stripped', () => {
  const base = resolveShortLinkBase({
    env: { SABSMS_SHORT_LINK_BASE: 'https://sab.sm/', NEXT_PUBLIC_APP_URL: 'https://app.example' },
  });
  assert.equal(base, 'https://sab.sm');
});

test('falls back to NEXT_PUBLIC_APP_URL + /s', () => {
  const base = resolveShortLinkBase({
    env: { NEXT_PUBLIC_APP_URL: 'https://app.example.com/' },
  });
  assert.equal(base, 'https://app.example.com/s');
});

test('invalid branded domain falls through to env', () => {
  const base = resolveShortLinkBase({
    workspaceDomain: 'not a domain',
    env: { SABSMS_SHORT_LINK_BASE: 'https://sab.sm' },
  });
  assert.equal(base, 'https://sab.sm');
});

// ─── Idempotent-reuse tuple filter ────────────────────────────────────────

test('reuse filter maps targetUrl → target and normalizes missing ids to null', () => {
  assert.deepEqual(
    reuseFilterFor({ workspaceId: 'w1', targetUrl: 'https://x.co/a' }),
    { workspaceId: 'w1', target: 'https://x.co/a', campaignId: null, contactId: null },
  );
});

test('reuse filter keeps attribution when present', () => {
  assert.deepEqual(
    reuseFilterFor({
      workspaceId: 'w1',
      targetUrl: 'https://x.co/a',
      campaignId: 'c1',
      contactId: 'p1',
    }),
    { workspaceId: 'w1', target: 'https://x.co/a', campaignId: 'c1', contactId: 'p1' },
  );
});

test('identical tuples produce identical filters (reuse), different tuples do not', () => {
  const a = reuseFilterFor({ workspaceId: 'w1', targetUrl: 'https://x.co', campaignId: 'c1' });
  const b = reuseFilterFor({ workspaceId: 'w1', targetUrl: 'https://x.co', campaignId: 'c1' });
  const c = reuseFilterFor({ workspaceId: 'w1', targetUrl: 'https://x.co', campaignId: 'c2' });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

// ─── IP hashing ───────────────────────────────────────────────────────────

test('hashIp is a 16-char hex fingerprint, deterministic, never the raw IP', () => {
  const h = hashIp('203.0.113.7');
  assert.match(h, /^[0-9a-f]{16}$/);
  assert.equal(h, hashIp('203.0.113.7'));
  assert.notEqual(h, hashIp('203.0.113.8'));
  assert.ok(!h.includes('203'));
});
