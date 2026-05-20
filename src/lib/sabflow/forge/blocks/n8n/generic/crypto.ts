/**
 * Forge block: Crypto
 *
 * Source: n8n-master/packages/nodes-base/nodes/Crypto/Crypto.node.ts (+ v1, v2)
 * Credential type: none — uses Node.js built-in `crypto`.
 *
 * Operations covered:
 *   - hash   — hash a value with a chosen algorithm (md5/sha1/sha256/sha512)
 *   - hmac   — HMAC a value with a secret + algorithm
 *   - random — generate a hex/base64 random string of n bytes
 *   - uuid   — generate a v4 UUID (n8n's `generate` action)
 *
 * Out of scope: sign/verify with key pairs (no engine-level keystore yet),
 * file-stream hashing — deferred until SabFlow exposes binary refs in
 * ForgeActionContext.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

type Algo = 'md5' | 'sha1' | 'sha256' | 'sha512';
type Encoding = 'hex' | 'base64';

const ALGOS: Algo[] = ['md5', 'sha1', 'sha256', 'sha512'];
const ENCODINGS: Encoding[] = ['hex', 'base64'];

function checkAlgo(v: string): Algo {
  if ((ALGOS as string[]).includes(v)) return v as Algo;
  throw new Error(`Crypto: unsupported algorithm "${v}"`);
}

function checkEncoding(v: string): Encoding {
  if ((ENCODINGS as string[]).includes(v)) return v as Encoding;
  throw new Error(`Crypto: unsupported encoding "${v}"`);
}

async function hash(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { createHash } = await import('node:crypto');
  const algorithm = checkAlgo(asString(ctx.options.algorithm) || 'sha256');
  const encoding = checkEncoding(asString(ctx.options.encoding) || 'hex');
  const value = asString(ctx.options.value);
  if (!value) throw new Error('Crypto: value is required');
  const digest = createHash(algorithm).update(value).digest(encoding);
  return {
    outputs: { result: digest, algorithm, encoding },
    logs: [`Crypto hash ${algorithm} (${encoding})`],
  };
}

async function hmac(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { createHmac } = await import('node:crypto');
  const algorithm = checkAlgo(asString(ctx.options.algorithm) || 'sha256');
  const encoding = checkEncoding(asString(ctx.options.encoding) || 'hex');
  const value = asString(ctx.options.value);
  const secret = asString(ctx.options.secret);
  if (!value) throw new Error('Crypto: value is required');
  if (!secret) throw new Error('Crypto: secret is required');
  const digest = createHmac(algorithm, secret).update(value).digest(encoding);
  return {
    outputs: { result: digest, algorithm, encoding },
    logs: [`Crypto hmac ${algorithm} (${encoding})`],
  };
}

async function uuid(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { randomUUID } = await import('node:crypto');
  const result = randomUUID();
  return { outputs: { result }, logs: ['Crypto uuid v4'] };
}

async function random(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { randomBytes } = await import('node:crypto');
  const length = asNumber(ctx.options.length) ?? 16;
  if (length <= 0 || length > 1024) {
    throw new Error('Crypto: length must be between 1 and 1024 bytes');
  }
  const encoding = checkEncoding(asString(ctx.options.encoding) || 'hex');
  const result = randomBytes(Math.floor(length)).toString(encoding);
  return {
    outputs: { result, length, encoding },
    logs: [`Crypto random ${length} bytes`],
  };
}

const algoField = {
  id: 'algorithm',
  label: 'Algorithm',
  type: 'select' as const,
  defaultValue: 'sha256',
  options: ALGOS.map((a) => ({ label: a.toUpperCase(), value: a })),
};

const encodingField = {
  id: 'encoding',
  label: 'Output encoding',
  type: 'select' as const,
  defaultValue: 'hex',
  options: ENCODINGS.map((e) => ({ label: e, value: e })),
};

const block: ForgeBlock = {
  id: 'forge_crypto',
  name: 'Crypto',
  description: 'Hash, HMAC and random-bytes helpers backed by Node `crypto`.',
  iconName: 'LuShield',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'hash',
      label: 'Hash',
      description: 'Hash a value with the chosen algorithm.',
      fields: [
        algoField,
        encodingField,
        { id: 'value', label: 'Value', type: 'textarea', required: true },
      ],
      run: hash,
    },
    {
      id: 'hmac',
      label: 'HMAC',
      description: 'Sign a value with HMAC + secret.',
      fields: [
        algoField,
        encodingField,
        { id: 'value', label: 'Value', type: 'textarea', required: true },
        { id: 'secret', label: 'Secret', type: 'password', required: true },
      ],
      run: hmac,
    },
    {
      id: 'random',
      label: 'Random bytes',
      description: 'Generate cryptographically-random bytes encoded as hex or base64.',
      fields: [
        { id: 'length', label: 'Length (bytes)', type: 'number', defaultValue: 16 },
        encodingField,
      ],
      run: random,
    },
    {
      id: 'uuid',
      label: 'Generate UUID',
      description: 'Return a fresh v4 UUID — useful for idempotency keys or trace IDs.',
      fields: [],
      run: uuid,
    },
  ],
};

registerForgeBlock(block);
export default block;
