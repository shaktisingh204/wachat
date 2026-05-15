/**
 * Tiny round-trip test for `crypto.ts`.
 *
 * Runs under Node's built-in `node:test` runner so we don't need to add
 * vitest as a dependency just for this. Execute with:
 *
 *   pnpm exec tsx --test src/crypto.test.ts
 */

import { strict as assert } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { describe, it, before } from 'node:test';

import { decrypt, encrypt, __resetKeyCacheForTests } from './crypto.js';

describe('crypto: AES-256-GCM round trip', () => {
  before(() => {
    // Pin a deterministic 32-byte key (base64) so the test does not depend
    // on any ambient env. Reset the module-level cache first.
    process.env.AUTH_STATE_KEY = Buffer.alloc(32, 0xab).toString('base64');
    __resetKeyCacheForTests();
  });

  it('round-trips plaintext through encrypt/decrypt', () => {
    const plaintext = Buffer.from(
      'baileys-creds:{"noiseKey":"...","signedIdentityKey":"..."}',
      'utf8',
    );
    const blob = encrypt(plaintext);

    // Layout sanity: [12-byte nonce][ciphertext][16-byte tag].
    assert.equal(blob.length, plaintext.length + 12 + 16);

    const decrypted = decrypt(blob);
    assert.deepEqual(decrypted, plaintext);
  });

  it('produces a fresh nonce on each call (ciphertexts differ)', () => {
    const plaintext = Buffer.from('same plaintext', 'utf8');
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    assert.notDeepEqual(a, b);
  });

  it('decrypt rejects a truncated blob', () => {
    assert.throws(() => decrypt(Buffer.alloc(4)));
  });

  it('decrypt rejects a tampered tag', () => {
    const blob = encrypt(Buffer.from('hello', 'utf8'));
    // Flip a bit in the auth tag (last 16 bytes). `Buffer.subarray` view +
    // explicit `writeUInt8` keeps TS happy under noUncheckedIndexedAccess.
    const lastIdx = blob.length - 1;
    blob.writeUInt8(blob.readUInt8(lastIdx) ^ 0x01, lastIdx);
    assert.throws(() => decrypt(blob));
  });

  it('handles a 1MiB random plaintext', () => {
    const big = randomBytes(1024 * 1024);
    const blob = encrypt(big);
    const back = decrypt(blob);
    assert.deepEqual(back, big);
  });
});
