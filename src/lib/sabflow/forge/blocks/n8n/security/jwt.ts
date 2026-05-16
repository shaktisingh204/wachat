/**
 * Forge block: JWT
 *
 * Source: n8n-master/packages/nodes-base/nodes/Jwt/Jwt.node.ts
 *
 * Pure-local node — no network. Sign / verify JSON Web Tokens using
 * HMAC-SHA{256,384,512}. The shared secret is taken as an inline `password`
 * field per action; nothing is persisted.
 *
 * Operations covered:
 *   - sign     payload + secret + algorithm → token
 *   - verify   token + secret → { valid, payload, header }
 *   - decode   token → { header, payload } (no signature check)
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

type Algo = 'HS256' | 'HS384' | 'HS512';
const ALGOS: Algo[] = ['HS256', 'HS384', 'HS512'];

function toAlgo(v: string): Algo {
  const up = v.toUpperCase();
  if ((ALGOS as string[]).includes(up)) return up as Algo;
  throw new Error(`JWT: unsupported algorithm "${v}" (HS256/HS384/HS512 only)`);
}

function nodeAlgo(a: Algo): 'sha256' | 'sha384' | 'sha512' {
  return a === 'HS256' ? 'sha256' : a === 'HS384' ? 'sha384' : 'sha512';
}

function base64urlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const std = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(std, 'base64');
}

function sign(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  secret: string,
  algo: Algo,
): string {
  const h = base64urlEncode(JSON.stringify(header));
  const p = base64urlEncode(JSON.stringify(payload));
  const signing = `${h}.${p}`;
  const sig = createHmac(nodeAlgo(algo), secret).update(signing).digest();
  return `${signing}.${base64urlEncode(sig)}`;
}

function parsePayload(ctx: ForgeActionContext): Record<string, unknown> {
  const raw = asString(ctx.options.payload);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error('payload must be a JSON object');
  } catch (e) {
    throw new Error(`JWT: invalid payload JSON — ${(e as Error).message}`);
  }
}

async function signAction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = asString(ctx.options.secret);
  if (!secret) throw new Error('JWT: secret is required');
  const algo = toAlgo(asString(ctx.options.algorithm) || 'HS256');
  const payload = parsePayload(ctx);
  const expiresIn = asNumber(ctx.options.expiresIn);
  if (expiresIn !== undefined) {
    payload.exp = Math.floor(Date.now() / 1000) + expiresIn;
  }
  const issuer = asString(ctx.options.issuer);
  const subject = asString(ctx.options.subject);
  const audience = asString(ctx.options.audience);
  if (issuer) payload.iss = issuer;
  if (subject) payload.sub = subject;
  if (audience) payload.aud = audience;
  const token = sign({ alg: algo, typ: 'JWT' }, payload, secret, algo);
  return { outputs: { token, payload }, logs: [`JWT sign (${algo})`] };
}

async function verifyAction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = asString(ctx.options.token);
  const secret = asString(ctx.options.secret);
  if (!token) throw new Error('JWT: token is required');
  if (!secret) throw new Error('JWT: secret is required');
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { outputs: { valid: false, reason: 'malformed token' }, logs: ['JWT verify → malformed'] };
  }
  const [h, p, s] = parts;
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(base64urlDecode(h).toString('utf8')) as Record<string, unknown>;
    payload = JSON.parse(base64urlDecode(p).toString('utf8')) as Record<string, unknown>;
  } catch {
    return { outputs: { valid: false, reason: 'unparseable header/payload' }, logs: ['JWT verify → unparseable'] };
  }
  const alg = typeof header.alg === 'string' ? header.alg : '';
  let algo: Algo;
  try {
    algo = toAlgo(alg);
  } catch {
    return { outputs: { valid: false, reason: `unsupported alg "${alg}"`, header, payload }, logs: ['JWT verify → bad alg'] };
  }
  const expected = createHmac(nodeAlgo(algo), secret).update(`${h}.${p}`).digest();
  const given = base64urlDecode(s);
  const sigOk = expected.length === given.length && timingSafeEqual(expected, given);
  if (!sigOk) {
    return { outputs: { valid: false, reason: 'bad signature', header, payload }, logs: ['JWT verify → bad sig'] };
  }
  // exp / nbf
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    return { outputs: { valid: false, reason: 'expired', header, payload }, logs: ['JWT verify → expired'] };
  }
  if (typeof payload.nbf === 'number' && payload.nbf > now) {
    return { outputs: { valid: false, reason: 'not yet valid', header, payload }, logs: ['JWT verify → nbf'] };
  }
  return { outputs: { valid: true, header, payload }, logs: [`JWT verify ok (${algo})`] };
}

async function decodeAction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = asString(ctx.options.token);
  if (!token) throw new Error('JWT: token is required');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT: malformed token');
  try {
    const header = JSON.parse(base64urlDecode(parts[0]).toString('utf8')) as Record<string, unknown>;
    const payload = JSON.parse(base64urlDecode(parts[1]).toString('utf8')) as Record<string, unknown>;
    return { outputs: { header, payload }, logs: ['JWT decode'] };
  } catch (e) {
    throw new Error(`JWT: cannot decode — ${(e as Error).message}`);
  }
}

const algorithmField = {
  id: 'algorithm',
  label: 'Algorithm',
  type: 'select' as const,
  defaultValue: 'HS256',
  options: ALGOS.map((a) => ({ label: a, value: a })),
};

const block: ForgeBlock = {
  id: 'forge_jwt',
  name: 'JWT',
  description: 'Sign, verify and decode JSON Web Tokens with HMAC-SHA{256,384,512}.',
  iconName: 'LuKey',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'sign',
      label: 'Sign token',
      description: 'Sign a JSON payload into a compact JWT.',
      fields: [
        { id: 'secret', label: 'Secret', type: 'password', required: true },
        algorithmField,
        { id: 'payload', label: 'Payload (JSON object)', type: 'textarea', required: true, placeholder: '{ "sub": "user-123" }' },
        { id: 'expiresIn', label: 'Expires in (seconds from now)', type: 'number' },
        { id: 'issuer', label: 'Issuer (iss)', type: 'text' },
        { id: 'subject', label: 'Subject (sub)', type: 'text' },
        { id: 'audience', label: 'Audience (aud)', type: 'text' },
      ],
      run: signAction,
    },
    {
      id: 'verify',
      label: 'Verify token',
      description: 'Verify the signature, exp and nbf of a JWT.',
      fields: [
        { id: 'token', label: 'Token', type: 'textarea', required: true },
        { id: 'secret', label: 'Secret', type: 'password', required: true },
      ],
      run: verifyAction,
    },
    {
      id: 'decode',
      label: 'Decode token',
      description: 'Decode header + payload without verifying the signature.',
      fields: [
        { id: 'token', label: 'Token', type: 'textarea', required: true },
      ],
      run: decodeAction,
    },
  ],
};

registerForgeBlock(block);
export default block;
