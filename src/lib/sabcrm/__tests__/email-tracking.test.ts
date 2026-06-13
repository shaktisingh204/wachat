/**
 * Unit tests for email-tracking PURE helpers (`../email-tracking`).
 *   npx tsx --test src/lib/sabcrm/__tests__/email-tracking.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  injectTracking,
  rewriteLinks,
  pixelTag,
  signToken,
  verifyToken,
  encodeBase64Url,
  decodeBase64Url,
  openUrl,
  clickUrl,
  CLICK_URL_PARAM,
  type TrackingToken,
} from '../email-tracking';

const SECRET = 'unit-test-secret-key';
const BASE = 'https://app.example.com';
const TOKEN: TrackingToken = { mid: 'msg_123', pid: 'proj_abc', iat: 1_700_000_000_000 };

describe('base64url codec', () => {
  it('round-trips utf-8 incl. characters needing +/ replacement', () => {
    const s = 'héllo+/?=&<>"world ~ ünïcödé';
    assert.equal(decodeBase64Url(encodeBase64Url(s)), s);
  });
  it('emits url-safe alphabet only (no +, /, or =)', () => {
    const enc = encodeBase64Url('a'.repeat(40) + '???>>>');
    assert.doesNotMatch(enc, /[+/=]/);
  });
});

describe('signToken / verifyToken', () => {
  it('round-trips a valid token', () => {
    const t = signToken(TOKEN, SECRET);
    const back = verifyToken(t, SECRET);
    assert.deepEqual(back, TOKEN);
  });
  it('is deterministic for the same payload + secret', () => {
    assert.equal(signToken(TOKEN, SECRET), signToken(TOKEN, SECRET));
  });
  it('rejects a token signed with a different secret', () => {
    const t = signToken(TOKEN, SECRET);
    assert.equal(verifyToken(t, 'other-secret'), null);
  });
  it('rejects a tampered payload (signature no longer matches)', () => {
    const t = signToken(TOKEN, SECRET);
    const [body, sig] = t.split('.');
    const forgedBody = encodeBase64Url(
      JSON.stringify({ ...TOKEN, mid: 'msg_HACKED' }),
    );
    const tampered = `${forgedBody}.${sig}`;
    assert.notEqual(forgedBody, body);
    assert.equal(verifyToken(tampered, SECRET), null);
  });
  it('rejects a tampered signature', () => {
    const t = signToken(TOKEN, SECRET);
    const [body] = t.split('.');
    assert.equal(verifyToken(`${body}.deadbeef`, SECRET), null);
  });
  it('rejects malformed / empty tokens', () => {
    assert.equal(verifyToken('', SECRET), null);
    assert.equal(verifyToken('no-dot-here', SECRET), null);
    assert.equal(verifyToken('.sig', SECRET), null);
    assert.equal(verifyToken('body.', SECRET), null);
  });
  it('rejects a payload missing required fields', () => {
    const body = encodeBase64Url(JSON.stringify({ mid: 'x' }));
    const sig = signToken({ mid: 'x', pid: '', iat: 0 }, SECRET); // not relevant
    // Re-sign the partial body so the signature is "valid" but payload invalid.
    const partial = signToken(
      { mid: 'x' } as unknown as TrackingToken,
      SECRET,
    );
    assert.equal(verifyToken(partial, SECRET), null);
    assert.ok(body.length > 0 && sig.length > 0); // touch the helpers
  });
});

describe('pixelTag / url builders', () => {
  it('builds an open-pixel img with the token in the src', () => {
    const tok = signToken(TOKEN, SECRET);
    const tag = pixelTag(tok, BASE);
    assert.match(tag, /<img /);
    assert.match(tag, /width="1"/);
    assert.match(tag, /height="1"/);
    assert.match(tag, /display:none/);
    assert.ok(tag.includes(encodeURIComponent(tok)));
    assert.ok(tag.includes('/api/sabcrm/track/open/'));
  });
  it('clickUrl carries the original url url-encoded under the u param', () => {
    const tok = signToken(TOKEN, SECRET);
    const url = clickUrl(tok, 'https://dest.com/path?a=1&b=2', BASE);
    assert.ok(url.startsWith(`${BASE}/api/sabcrm/track/click/`));
    assert.ok(url.includes(`?${CLICK_URL_PARAM}=`));
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get(CLICK_URL_PARAM), 'https://dest.com/path?a=1&b=2');
  });
  it('strips a trailing slash on the base url', () => {
    assert.equal(openUrl('t', 'https://x.com/'), openUrl('t', 'https://x.com'));
  });
});

describe('rewriteLinks', () => {
  const tok = signToken(TOKEN, SECRET);

  it('rewrites an http link through the click route, preserving the original', () => {
    const out = rewriteLinks('<a href="https://dest.com/x">go</a>', tok, BASE);
    assert.ok(out.includes('/api/sabcrm/track/click/'));
    const href = /href="([^"]+)"/.exec(out)?.[1] ?? '';
    const u = new URL(href.replace(/&amp;/g, '&'));
    assert.equal(u.searchParams.get(CLICK_URL_PARAM), 'https://dest.com/x');
  });
  it('handles single-quoted hrefs', () => {
    const out = rewriteLinks("<a href='https://dest.com'>go</a>", tok, BASE);
    assert.ok(out.includes('track/click'));
  });
  it('decodes &amp; in the source href so the original round-trips', () => {
    const out = rewriteLinks(
      '<a href="https://dest.com/p?a=1&amp;b=2">go</a>',
      tok,
      BASE,
    );
    const href = /href="([^"]+)"/.exec(out)?.[1] ?? '';
    const u = new URL(href.replace(/&amp;/g, '&'));
    assert.equal(u.searchParams.get(CLICK_URL_PARAM), 'https://dest.com/p?a=1&b=2');
  });
  it('leaves mailto / tel / anchor / javascript links untouched', () => {
    const src =
      '<a href="mailto:a@b.com">m</a><a href="tel:123">t</a>' +
      '<a href="#top">a</a><a href="javascript:void(0)">j</a>';
    assert.equal(rewriteLinks(src, tok, BASE), src);
  });
  it('rewrites multiple links in one document', () => {
    const src = '<a href="https://a.com">1</a> and <a href="https://b.com">2</a>';
    const out = rewriteLinks(src, tok, BASE);
    assert.equal(out.match(/track\/click/g)?.length, 2);
  });
});

describe('injectTracking', () => {
  const tok = signToken(TOKEN, SECRET);

  it('appends the pixel right before </body>', () => {
    const out = injectTracking('<html><body><p>Hi</p></body></html>', tok, BASE);
    assert.match(out, /<img [^>]*track\/open[^>]*><\/body>/);
  });
  it('appends the pixel at the end when there is no </body>', () => {
    const out = injectTracking('<p>Hi</p>', tok, BASE);
    assert.ok(out.endsWith('/>') || /<img [^>]*track\/open/.test(out));
    assert.ok(out.includes('track/open'));
    assert.ok(out.startsWith('<p>Hi</p>'));
  });
  it('also rewrites links while injecting the pixel', () => {
    const out = injectTracking(
      '<body><a href="https://dest.com">go</a></body>',
      tok,
      BASE,
    );
    assert.ok(out.includes('track/click'));
    assert.ok(out.includes('track/open'));
  });
  it('returns empty / whitespace input unchanged', () => {
    assert.equal(injectTracking('', tok, BASE), '');
    assert.equal(injectTracking('   ', tok, BASE), '   ');
  });
});
