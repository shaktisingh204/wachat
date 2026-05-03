/**
 * TOTP unit tests — RFC 6238 reference vectors + general behaviour.
 *
 *   pnpm exec tsx --test src/lib/identity/__tests__/totp.test.ts
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    base32Decode,
    base32Encode,
    generateTotp,
    generateTotpSecret,
    totpProvisioningUri,
    verifyTotp,
} from '../mfa';

test('base32 encode/decode round-trips', () => {
    const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff, 0x42]);
    const encoded = base32Encode(data);
    assert.match(encoded, /^[A-Z2-7]+$/);
    const decoded = base32Decode(encoded);
    assert.deepEqual(Array.from(decoded), Array.from(data));
});

test('generateTotpSecret produces a base32 string of expected length', () => {
    const secret = generateTotpSecret(20);
    // 20 bytes → 32 base32 chars (no padding from our encoder).
    assert.equal(secret.length, 32);
    assert.match(secret, /^[A-Z2-7]+$/);
});

test('RFC 6238 reference vector — sha1, T=59 → 94287082', () => {
    // Standard RFC test secret ("12345678901234567890" ASCII) in base32.
    const secret = base32Encode(new TextEncoder().encode('12345678901234567890'));
    const code = generateTotp(secret, 59 * 1000, { digits: 8, step: 30, algorithm: 'sha1' });
    assert.equal(code, '94287082');
});

test('RFC 6238 reference vector — sha1, T=1111111109 → 07081804', () => {
    const secret = base32Encode(new TextEncoder().encode('12345678901234567890'));
    const code = generateTotp(secret, 1111111109 * 1000, {
        digits: 8,
        step: 30,
        algorithm: 'sha1',
    });
    assert.equal(code, '07081804');
});

test('verifyTotp accepts the freshly generated code', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const code = generateTotp(secret, now);
    assert.equal(verifyTotp(secret, code, undefined, now), true);
});

test('verifyTotp rejects a wrong code', () => {
    const secret = generateTotpSecret();
    assert.equal(verifyTotp(secret, '000000'), false);
});

test('verifyTotp accepts adjacent window codes within tolerance', () => {
    const secret = generateTotpSecret();
    const baseTime = Date.now();
    const previous = generateTotp(secret, baseTime - 30_000);
    assert.equal(verifyTotp(secret, previous, { window: 1 }, baseTime), true);
});

test('verifyTotp rejects out-of-window codes', () => {
    const secret = generateTotpSecret();
    const baseTime = Date.now();
    const wayOld = generateTotp(secret, baseTime - 5 * 60_000);
    assert.equal(verifyTotp(secret, wayOld, { window: 1 }, baseTime), false);
});

test('verifyTotp rejects wrong-length tokens', () => {
    const secret = generateTotpSecret();
    assert.equal(verifyTotp(secret, '12345'), false);
    assert.equal(verifyTotp(secret, '1234567'), false);
});

test('totpProvisioningUri carries secret + issuer', () => {
    const uri = totpProvisioningUri({
        secret: 'JBSWY3DPEHPK3PXP',
        accountName: 'alice@example.com',
        issuer: 'SabNode',
    });
    assert.match(uri, /^otpauth:\/\/totp\//);
    assert.match(uri, /secret=JBSWY3DPEHPK3PXP/);
    assert.match(uri, /issuer=SabNode/);
});
