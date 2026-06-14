/**
 * Unit tests for the PURE BCC-dropbox address logic (`./email-dropbox.ts`).
 * Run: npx tsx --test src/lib/sabcrm/email-dropbox.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DROPBOX_LOCAL_PREFIX,
  buildDropboxAddress,
  parseDropboxAddress,
  matchesDropbox,
  isDropboxAddress,
  isValidDropboxToken,
  normaliseToken,
  normaliseDomain,
} from './email-dropbox.ts';

const TOKEN = 'ab12cd34ef56';

test('buildDropboxAddress builds crm+<token>@<domain>', () => {
  assert.equal(
    buildDropboxAddress(TOKEN, 'mail.acme.com'),
    `${DROPBOX_LOCAL_PREFIX}+${TOKEN}@mail.acme.com`,
  );
});

test('buildDropboxAddress normalises case on token and domain', () => {
  assert.equal(
    buildDropboxAddress('AB12CD34EF56', 'Mail.ACME.com'),
    `crm+${TOKEN}@mail.acme.com`,
  );
});

test('buildDropboxAddress returns empty on invalid token', () => {
  assert.equal(buildDropboxAddress('short', 'mail.acme.com'), '');
  assert.equal(buildDropboxAddress('has space!', 'mail.acme.com'), '');
  assert.equal(buildDropboxAddress('', 'mail.acme.com'), '');
});

test('buildDropboxAddress returns empty on invalid domain', () => {
  assert.equal(buildDropboxAddress(TOKEN, ''), '');
  assert.equal(buildDropboxAddress(TOKEN, 'localhost'), ''); // no dot
});

test('parseDropboxAddress round-trips a built address', () => {
  const addr = buildDropboxAddress(TOKEN, 'mail.acme.com');
  assert.equal(parseDropboxAddress(addr), TOKEN);
});

test('parseDropboxAddress tolerates display name + angle brackets + case', () => {
  assert.equal(
    parseDropboxAddress(`Sales CRM <CRM+${TOKEN.toUpperCase()}@Mail.Acme.com>`),
    TOKEN,
  );
});

test('parseDropboxAddress rejects non-dropbox / wrong-prefix addresses', () => {
  assert.equal(parseDropboxAddress('jane@acme.com'), null);
  assert.equal(parseDropboxAddress('sales+ab12cd34ef56@acme.com'), null); // wrong prefix
  assert.equal(parseDropboxAddress('crm@acme.com'), null); // no token
  assert.equal(parseDropboxAddress('crm+@acme.com'), null); // empty token
  assert.equal(parseDropboxAddress('crm+bad token@acme.com'), null);
  assert.equal(parseDropboxAddress(''), null);
  assert.equal(parseDropboxAddress('not-an-email'), null);
});

test('isDropboxAddress mirrors parseDropboxAddress', () => {
  assert.equal(isDropboxAddress(`crm+${TOKEN}@mail.acme.com`), true);
  assert.equal(isDropboxAddress('jane@acme.com'), false);
});

test('matchesDropbox finds the first dropbox token in a recipient list', () => {
  const list = [
    'jane@acme.com',
    'bob@acme.com',
    `crm+${TOKEN}@mail.acme.com`,
    `crm+othertoken99@mail.acme.com`,
  ];
  assert.equal(matchesDropbox(list), TOKEN);
});

test('matchesDropbox returns null when no dropbox present', () => {
  assert.equal(matchesDropbox(['jane@acme.com', 'bob@acme.com']), null);
  assert.equal(matchesDropbox([]), null);
});

test('isValidDropboxToken enforces charset + length', () => {
  assert.equal(isValidDropboxToken(TOKEN), true);
  assert.equal(isValidDropboxToken('ab12cd34'), true); // 8 = min
  assert.equal(isValidDropboxToken('short1'), false); // 6 < 8
  assert.equal(isValidDropboxToken('UPPER1234'.toLowerCase()), true);
  assert.equal(isValidDropboxToken('has-dash-12'), false);
  assert.equal(isValidDropboxToken('a'.repeat(65)), false); // > 64
});

test('normalisers trim + lowercase + strip leading @', () => {
  assert.equal(normaliseToken('  AbC123XY  '), 'abc123xy');
  assert.equal(normaliseDomain('  @Mail.ACME.com '), 'mail.acme.com');
});
