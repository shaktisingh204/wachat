/**
 * Forge block: TOTP
 *
 * Source: n8n-master/packages/nodes-base/nodes/Totp/Totp.node.ts
 *
 * Pure-local node — no network. Implements RFC 6238 TOTP on top of
 * RFC 4226 HOTP, using HMAC-SHA1 by default. The shared secret is taken
 * as an inline `password` field per action; nothing is persisted.
 *
 * Operations covered:
 *   - generate   secret → 6-digit code (+ remaining seconds)
 *   - verify     secret + code → { valid: boolean }
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

type Algo = 'sha1' | 'sha256' | 'sha512';

// RFC 4648 base32 alphabet
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const ch of cleaned) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error(`TOTP: invalid base32 character "${ch}"`);
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

async function hotp(secret: Buffer, counter: number, digits: number, algo: Algo): Promise<string> {
  const { createHmac } = await import('node:crypto');
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac(algo, secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return (code % mod).toString().padStart(digits, '0');
}

function readSecret(ctx: ForgeActionContext): Buffer {
  const raw = asString(ctx.options.secret);
  if (!raw) throw new Error('TOTP: secret is required');
  return base32Decode(raw);
}

function readAlgo(ctx: ForgeActionContext): Algo {
  const a = (asString(ctx.options.algorithm) || 'sha1').toLowerCase();
  if (a === 'sha1' || a === 'sha256' || a === 'sha512') return a;
  throw new Error(`TOTP: unsupported algorithm "${a}"`);
}

async function generate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = readSecret(ctx);
  const digits = asNumber(ctx.options.digits) ?? 6;
  const period = asNumber(ctx.options.period) ?? 30;
  const algo = readAlgo(ctx);
  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / period);
  const code = await hotp(secret, counter, digits, algo);
  const secondsRemaining = period - (now % period);
  return {
    outputs: { code, secondsRemaining, digits, period, algorithm: algo },
    logs: [`TOTP generate (${algo}, ${digits} digits)`],
  };
}

async function verify(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = readSecret(ctx);
  const digits = asNumber(ctx.options.digits) ?? 6;
  const period = asNumber(ctx.options.period) ?? 30;
  const algo = readAlgo(ctx);
  const window = asNumber(ctx.options.window) ?? 1;
  const code = asString(ctx.options.code);
  if (!code) throw new Error('TOTP: code is required');
  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / period);
  let valid = false;
  for (let i = -window; i <= window && !valid; i++) {
    if ((await hotp(secret, counter + i, digits, algo)) === code) valid = true;
  }
  return {
    outputs: { valid, code },
    logs: [`TOTP verify → ${valid ? 'ok' : 'reject'}`],
  };
}

const sharedFields = [
  { id: 'secret', label: 'Secret (base32)', type: 'password' as const, required: true },
  { id: 'digits', label: 'Digits', type: 'number' as const, defaultValue: 6 },
  { id: 'period', label: 'Period (seconds)', type: 'number' as const, defaultValue: 30 },
  {
    id: 'algorithm',
    label: 'Algorithm',
    type: 'select' as const,
    defaultValue: 'sha1',
    options: [
      { label: 'SHA1', value: 'sha1' },
      { label: 'SHA256', value: 'sha256' },
      { label: 'SHA512', value: 'sha512' },
    ],
  },
];

const block: ForgeBlock = {
  id: 'forge_totp',
  name: 'TOTP',
  description: 'Generate and verify RFC 6238 time-based one-time passwords locally.',
  iconName: 'LuKeyRound',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'generate',
      label: 'Generate code',
      description: 'Return the current TOTP code for the given secret.',
      fields: [...sharedFields],
      run: generate,
    },
    {
      id: 'verify',
      label: 'Verify code',
      description: 'Check a code against the secret with an optional drift window.',
      fields: [
        ...sharedFields,
        { id: 'code', label: 'Code to verify', type: 'text', required: true },
        { id: 'window', label: 'Drift window (steps)', type: 'number', defaultValue: 1 },
      ],
      run: verify,
    },
  ],
};

registerForgeBlock(block);
export default block;
