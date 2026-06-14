import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanAddress,
  firstAddress,
  mapSabmailInboundToCrmEmail,
  type SabmailInboundRaw,
} from './sabmail-inbound-map';

test('cleanAddress strips display name + angle brackets and lowercases', () => {
  assert.equal(cleanAddress('Jane Doe <Jane.Doe@Example.COM>'), 'jane.doe@example.com');
  assert.equal(cleanAddress('  BARE@Host.io '), 'bare@host.io');
  assert.equal(cleanAddress('<only@addr.com>'), 'only@addr.com');
});

test('cleanAddress is total on garbage input', () => {
  assert.equal(cleanAddress(''), '');
  assert.equal(cleanAddress('   '), '');
  assert.equal(cleanAddress(undefined), '');
  assert.equal(cleanAddress(null), '');
  assert.equal(cleanAddress(42), '');
});

test('firstAddress picks the first of a comma-joined header', () => {
  assert.equal(firstAddress('a@x.com, b@y.com, c@z.com'), 'a@x.com');
  assert.equal(firstAddress('Solo <solo@x.com>'), 'solo@x.com');
  assert.equal(firstAddress(''), '');
});

test('mapSabmailInboundToCrmEmail normalizes a full envelope', () => {
  const raw: SabmailInboundRaw = {
    workspaceId: 'ws1',
    from: 'Customer <Cust@Foo.COM>',
    fromName: 'Customer',
    to: 'support@tenant.com, ops@tenant.com',
    subject: '  Re: my order  ',
    bodyText: 'hi there',
    bodyHtml: '<p>hi there</p>',
    messageId: '<abc@mail>',
    receivedAt: '2026-06-14T10:00:00.000Z',
  };
  const out = mapSabmailInboundToCrmEmail(raw);
  assert.equal(out.from, 'cust@foo.com');
  assert.equal(out.fromName, 'Customer');
  assert.equal(out.to, 'support@tenant.com');
  assert.equal(out.subject, 'Re: my order');
  assert.equal(out.bodyText, 'hi there');
  assert.equal(out.bodyHtml, '<p>hi there</p>');
  assert.equal(out.messageId, '<abc@mail>');
  assert.ok(out.receivedAt instanceof Date);
  assert.equal(out.receivedAt?.toISOString(), '2026-06-14T10:00:00.000Z');
});

test('mapSabmailInboundToCrmEmail defaults the subject and omits empty optionals', () => {
  const out = mapSabmailInboundToCrmEmail({
    workspaceId: 'ws1',
    from: 'x@y.com',
    to: 'z@w.com',
  });
  assert.equal(out.subject, '(no subject)');
  assert.equal(out.from, 'x@y.com');
  assert.equal(out.to, 'z@w.com');
  // empty / missing optionals must not appear (cleaner downstream payloads)
  assert.ok(!('fromName' in out));
  assert.ok(!('bodyText' in out));
  assert.ok(!('bodyHtml' in out));
  assert.ok(!('messageId' in out));
  assert.ok(!('receivedAt' in out));
});

test('mapSabmailInboundToCrmEmail drops blank-only body/name/messageId', () => {
  const out = mapSabmailInboundToCrmEmail({
    workspaceId: 'ws1',
    from: 'x@y.com',
    to: 'z@w.com',
    fromName: '   ',
    bodyText: '   ',
    bodyHtml: '',
    messageId: '  ',
  });
  assert.ok(!('fromName' in out));
  assert.ok(!('bodyText' in out));
  assert.ok(!('bodyHtml' in out));
  assert.ok(!('messageId' in out));
});

test('mapSabmailInboundToCrmEmail tolerates an invalid receivedAt', () => {
  const out = mapSabmailInboundToCrmEmail({
    workspaceId: 'ws1',
    from: 'x@y.com',
    to: 'z@w.com',
    receivedAt: 'not-a-date',
  });
  assert.ok(!('receivedAt' in out));
});

test('mapSabmailInboundToCrmEmail accepts a Date or epoch receivedAt', () => {
  const d = new Date('2026-01-02T03:04:05.000Z');
  const fromDate = mapSabmailInboundToCrmEmail({
    workspaceId: 'ws1',
    from: 'x@y.com',
    to: 'z@w.com',
    receivedAt: d,
  });
  assert.equal(fromDate.receivedAt?.toISOString(), d.toISOString());

  const fromEpoch = mapSabmailInboundToCrmEmail({
    workspaceId: 'ws1',
    from: 'x@y.com',
    to: 'z@w.com',
    receivedAt: d.getTime(),
  });
  assert.equal(fromEpoch.receivedAt?.toISOString(), d.toISOString());
});
