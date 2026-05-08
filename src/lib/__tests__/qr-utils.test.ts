import assert from 'node:assert/strict';
import test from 'node:test';

import { filterPhoneLikeInput, normalizeQrWebsiteUrl } from '../qr-utils';

test('normalizeQrWebsiteUrl adds https to bare domains', () => {
  assert.equal(normalizeQrWebsiteUrl('example.com/path'), 'https://example.com/path');
});

test('normalizeQrWebsiteUrl preserves explicit schemes', () => {
  assert.equal(normalizeQrWebsiteUrl('http://example.com'), 'http://example.com');
});

test('filterPhoneLikeInput strips non phone characters and caps length', () => {
  assert.equal(filterPhoneLikeInput('+1 abc 234-567', 8), '+1234567');
});
