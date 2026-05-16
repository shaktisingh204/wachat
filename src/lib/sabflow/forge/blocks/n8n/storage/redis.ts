/**
 * Forge block: Redis
 *
 * Source: n8n-master/packages/nodes-base/nodes/Redis/Redis.node.ts
 * Credential type: 'redis' (expects { connectionString }).
 *
 * Operations covered:
 *   - key.get      GET <key>
 *   - key.set      SET <key> <value>   with optional EX/TTL
 *   - key.delete   DEL <key>
 *   - incr         INCR <key>
 *   - keys         KEYS <pattern>
 *
 * Implementation note:
 *   The repo already bundles `ioredis` — we mirror the MongoDB block's
 *   "open per call, close in finally" pattern. The connection-string form
 *   is the simplest cross-cluster surface; cluster/sentinel-specific
 *   configuration can be layered in via a follow-up port.
 *
 * Deferred:
 *   - Pub/Sub publish + subscribe (subscribe belongs in a Redis trigger)
 *   - LPUSH/RPUSH/LPOP/RPOP list operations (re-add when a flow needs them)
 *   - Hash + sorted-set operations (HSET, ZADD…)
 */

import type Redis from 'ioredis';
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString, requireCredential } from '../_shared/http';

async function withClient<T>(
  ctx: ForgeActionContext,
  fn: (client: Redis) => Promise<T>,
): Promise<T> {
  const cred = requireCredential('Redis', ctx.credential);
  const uri = cred.connectionString;
  if (!uri) throw new Error('Redis: credential is missing `connectionString`');
  type RedisCtorShape = new (uri: string, opts: Record<string, unknown>) => Redis;
  const mod = (await import('ioredis')) as unknown as {
    default?: RedisCtorShape;
  } & RedisCtorShape;
  const RedisCtor = (mod.default ?? mod) as RedisCtorShape;
  const client = new RedisCtor(uri, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await client.connect();
    return await fn(client);
  } finally {
    client.disconnect();
  }
}

async function keyGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = asString(ctx.options.key);
  if (!key) throw new Error('Redis: key is required');
  return withClient(ctx, async (client) => {
    const value = await client.get(key);
    return { outputs: { value }, logs: [`Redis GET ${key} → ${value === null ? 'miss' : 'hit'}`] };
  });
}

async function keySet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = asString(ctx.options.key);
  const value = asString(ctx.options.value);
  const ttl = asNumber(ctx.options.ttl);
  if (!key) throw new Error('Redis: key is required');
  return withClient(ctx, async (client) => {
    if (ttl && ttl > 0) {
      await client.set(key, value, 'EX', ttl);
    } else {
      await client.set(key, value);
    }
    return { outputs: { key, value }, logs: [`Redis SET ${key}${ttl ? ` (ttl=${ttl})` : ''}`] };
  });
}

async function keyDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = asString(ctx.options.key);
  if (!key) throw new Error('Redis: key is required');
  return withClient(ctx, async (client) => {
    const deleted = await client.del(key);
    return { outputs: { deleted }, logs: [`Redis DEL ${key} → ${deleted}`] };
  });
}

async function incr(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = asString(ctx.options.key);
  const by = asNumber(ctx.options.by) ?? 1;
  if (!key) throw new Error('Redis: key is required');
  return withClient(ctx, async (client) => {
    const value = by === 1 ? await client.incr(key) : await client.incrby(key, by);
    return { outputs: { value }, logs: [`Redis INCR ${key} (+${by}) → ${value}`] };
  });
}

async function keys(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const pattern = asString(ctx.options.pattern) || '*';
  return withClient(ctx, async (client) => {
    const matched = await client.keys(pattern);
    return { outputs: { keys: matched, count: matched.length }, logs: [`Redis KEYS ${pattern} → ${matched.length}`] };
  });
}

const block: ForgeBlock = {
  id: 'forge_redis',
  name: 'Redis',
  description: 'Read, write and increment Redis keys.',
  iconName: 'LuDatabaseZap',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'redis' },
  actions: [
    {
      id: 'key_get',
      label: 'Get key',
      description: 'GET a string value by key.',
      fields: [
        { id: 'key', label: 'Key', type: 'text', required: true },
      ],
      run: keyGet,
    },
    {
      id: 'key_set',
      label: 'Set key',
      description: 'SET a string value with optional TTL (seconds).',
      fields: [
        { id: 'key', label: 'Key', type: 'text', required: true },
        { id: 'value', label: 'Value', type: 'textarea', required: true },
        { id: 'ttl', label: 'TTL (seconds, optional)', type: 'number' },
      ],
      run: keySet,
    },
    {
      id: 'key_delete',
      label: 'Delete key',
      description: 'DEL a key.',
      fields: [
        { id: 'key', label: 'Key', type: 'text', required: true },
      ],
      run: keyDelete,
    },
    {
      id: 'incr',
      label: 'Increment counter',
      description: 'INCR (or INCRBY) a counter key.',
      fields: [
        { id: 'key', label: 'Key', type: 'text', required: true },
        { id: 'by', label: 'Increment by', type: 'number', defaultValue: 1 },
      ],
      run: incr,
    },
    {
      id: 'keys',
      label: 'List keys',
      description: 'KEYS pattern — use sparingly on large databases.',
      fields: [
        { id: 'pattern', label: 'Pattern', type: 'text', defaultValue: '*' },
      ],
      run: keys,
    },
  ],
};

registerForgeBlock(block);
export default block;
