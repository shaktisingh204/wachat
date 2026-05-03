/**
 * CIDR matcher tests — IPv4 + IPv6 + edge cases.
 *
 *   pnpm exec tsx --test src/lib/identity/__tests__/cidr.test.ts
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    ipMatchesCidr,
    isAllowed,
    matchAny,
    parseCidr,
    parseIp,
} from '../ip-allowlist';
import type { IpAllowRule } from '../types';

test('parseIp rejects garbage', () => {
    assert.equal(parseIp('not-an-ip'), null);
    assert.equal(parseIp('999.1.1.1'), null);
    assert.equal(parseIp('1.2.3'), null);
});

test('parseIp parses IPv4', () => {
    const r = parseIp('192.168.1.1')!;
    assert.equal(r.family, 4);
    // 192.168.1.1 = 0xC0A80101
    assert.equal(r.value, 0xc0a80101n);
});

test('parseIp parses compressed IPv6', () => {
    const r = parseIp('::1')!;
    assert.equal(r.family, 6);
    assert.equal(r.value, 1n);
});

test('parseCidr — /0 matches anything (v4)', () => {
    const c = parseCidr('0.0.0.0/0')!;
    assert.equal(c.mask, 0n);
    assert.equal(ipMatchesCidr('1.2.3.4', '0.0.0.0/0'), true);
    assert.equal(ipMatchesCidr('255.255.255.255', '0.0.0.0/0'), true);
});

test('ipMatchesCidr — basic IPv4', () => {
    assert.equal(ipMatchesCidr('192.168.1.42', '192.168.1.0/24'), true);
    assert.equal(ipMatchesCidr('192.168.2.42', '192.168.1.0/24'), false);
    assert.equal(ipMatchesCidr('10.0.0.1', '10.0.0.1/32'), true);
    assert.equal(ipMatchesCidr('10.0.0.2', '10.0.0.1/32'), false);
});

test('ipMatchesCidr — single IP without prefix means exact match', () => {
    assert.equal(ipMatchesCidr('1.2.3.4', '1.2.3.4'), true);
    assert.equal(ipMatchesCidr('1.2.3.5', '1.2.3.4'), false);
});

test('ipMatchesCidr — IPv6', () => {
    assert.equal(ipMatchesCidr('2001:db8::1', '2001:db8::/32'), true);
    assert.equal(ipMatchesCidr('2001:db9::1', '2001:db8::/32'), false);
    assert.equal(ipMatchesCidr('::1', '::1/128'), true);
});

test('ipMatchesCidr — IPv4 vs IPv6 never match', () => {
    assert.equal(ipMatchesCidr('1.2.3.4', '::/0'), false);
    assert.equal(ipMatchesCidr('::1', '0.0.0.0/0'), false);
});

test('ipMatchesCidr returns false for malformed inputs', () => {
    assert.equal(ipMatchesCidr('garbage', '192.168.1.0/24'), false);
    assert.equal(ipMatchesCidr('1.2.3.4', 'garbage'), false);
    assert.equal(ipMatchesCidr('1.2.3.4', '1.2.3.4/33'), false);
});

test('matchAny: empty rules → allow', () => {
    assert.equal(matchAny('1.2.3.4', []), true);
});

test('matchAny: any rule matches', () => {
    const rules: IpAllowRule[] = [
        {
            id: 'a',
            orgId: 'o1',
            cidr: '10.0.0.0/8',
            createdAt: '2024-01-01T00:00:00Z',
            createdBy: 'u1',
        },
        {
            id: 'b',
            orgId: 'o1',
            cidr: '192.168.1.0/24',
            createdAt: '2024-01-01T00:00:00Z',
            createdBy: 'u1',
        },
    ];
    assert.equal(matchAny('192.168.1.42', rules), true);
    assert.equal(matchAny('10.55.1.1', rules), true);
    assert.equal(matchAny('8.8.8.8', rules), false);
});

test('isAllowed via injected store', async () => {
    const rules: IpAllowRule[] = [
        {
            id: 'r1',
            orgId: 'o1',
            cidr: '203.0.113.0/24',
            createdAt: '2024-01-01T00:00:00Z',
            createdBy: 'u1',
        },
    ];
    const store = { listForOrg: async () => rules };
    assert.equal(await isAllowed('o1', '203.0.113.55', store), true);
    assert.equal(await isAllowed('o1', '198.51.100.1', store), false);
});

test('isAllowed: org with no rules returns true (open by default)', async () => {
    const store = { listForOrg: async () => [] };
    assert.equal(await isAllowed('orgX', '1.1.1.1', store), true);
});
