import assert from 'node:assert/strict';
import test from 'node:test';

import { SignJWT } from 'jose';

import { verifyJwtEdge } from '../auth.edge';

process.env.JWT_SECRET = 'test-secret-for-edge-session-validation';

async function sign(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
}

test('edge verifier rejects Rust-shaped tokens as browser sessions', async () => {
  const token = await sign({
    sub: '507f1f77bcf86cd799439011',
    tid: '507f1f77bcf86cd799439011',
    roles: [],
    iss: 'sabnode-bff',
  });

  await assert.rejects(() => verifyJwtEdge(token));
});

test('edge verifier accepts app session tokens', async () => {
  const token = await sign({
    jti: 'session-jti',
    userId: '507f1f77bcf86cd799439011',
    email: 'user@example.com',
  });

  assert.equal(await verifyJwtEdge(token), true);
});
