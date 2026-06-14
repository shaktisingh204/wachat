/**
 * Unit tests for the Sab Vault client-side crypto (PURE, WebCrypto-backed).
 *   npx tsx --test src/lib/sabfiles/vault/crypto.test.ts
 *
 * Runs under Node's built-in test runner; `globalThis.crypto` (Node 20+)
 * provides `crypto.subtle` + `getRandomValues`, and the base64 helpers fall
 * back to Buffer when `window` is absent.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    base64ToBytes,
    bytesToBase64,
    decryptBytes,
    decryptPayload,
    deriveMasterKey,
    encryptBytes,
    encryptPayload,
    makeCanary,
    newSalt,
    scorePasswordStrength,
    verifyCanary,
} from './crypto.ts';

const PW = 'correct horse battery staple';

describe('sabfiles vault crypto', () => {
    it('base64 round-trips arbitrary bytes', () => {
        const bytes = new Uint8Array([0, 1, 2, 250, 251, 255, 128, 64]);
        assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes);
    });

    it('encryptPayload → decryptPayload round-trips a JSON object', async () => {
        const salt = newSalt();
        const key = await deriveMasterKey(PW, salt);
        const payload = { name: 'taxes.pdf', mime: 'application/pdf', size: 12345, nested: { a: [1, 2, 3] } };
        const env = await encryptPayload(payload, key);
        assert.equal(typeof env, 'string');
        const out = await decryptPayload<typeof payload>(env, key);
        assert.deepEqual(out, payload);
    });

    it('encryptBytes → decryptBytes round-trips binary content', async () => {
        const salt = newSalt();
        const key = await deriveMasterKey(PW, salt);
        const data = new Uint8Array(2048);
        for (let i = 0; i < data.length; i++) data[i] = (i * 31 + 7) & 0xff;
        const env = await encryptBytes(data, key);
        // Envelope must not equal plaintext and must carry version byte 0x01.
        assert.equal(env[0], 0x01);
        assert.notDeepEqual(env.slice(0, data.length), data);
        const out = await decryptBytes(env, key);
        assert.deepEqual(out, data);
    });

    it('a key derived twice from the same password+salt is interchangeable', async () => {
        const salt = newSalt();
        const keyA = await deriveMasterKey(PW, salt);
        const keyB = await deriveMasterKey(PW, salt);
        const env = await encryptPayload({ hi: 'there' }, keyA);
        const out = await decryptPayload<{ hi: string }>(env, keyB);
        assert.equal(out.hi, 'there');
    });

    it('a different password cannot decrypt (canary fails)', async () => {
        const salt = newSalt();
        const right = await deriveMasterKey(PW, salt);
        const wrong = await deriveMasterKey('not the password', salt);
        const canary = await makeCanary(right);
        assert.equal(await verifyCanary(canary, right), true);
        assert.equal(await verifyCanary(canary, wrong), false);
    });

    it('tampering with the ciphertext fails the GCM tag', async () => {
        const salt = newSalt();
        const key = await deriveMasterKey(PW, salt);
        const env = await encryptBytes(new Uint8Array([9, 9, 9, 9]), key);
        env[env.length - 1] ^= 0x01; // flip a bit in the tag/ciphertext
        await assert.rejects(() => decryptBytes(env, key));
    });

    it('rejects a too-short / wrong-version envelope', async () => {
        const salt = newSalt();
        const key = await deriveMasterKey(PW, salt);
        await assert.rejects(() => decryptBytes(new Uint8Array([0x01, 0x00]), key));
        const env = await encryptBytes(new Uint8Array([1, 2, 3]), key);
        env[0] = 0x99; // unknown version
        await assert.rejects(() => decryptBytes(env, key));
    });

    it('scores password strength monotonically', () => {
        assert.equal(scorePasswordStrength('a').label, 'weak');
        assert.ok(scorePasswordStrength('Abcd1234!xyz').score >= 3);
    });
});
