/**
 * Forge block: Redis Chat Memory
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/memory/MemoryRedisChat
 *
 * Stored as a per-session Redis list:
 *   RPUSH chat:{sessionId} {"role","content","at"}
 *   LRANGE chat:{sessionId} 0 -1
 *   DEL    chat:{sessionId}
 *
 * Inline credentials — `auth: { type: 'none' }`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

type RedisClient = {
  rpush: (key: string, ...values: string[]) => Promise<number>;
  lrange: (key: string, start: number, stop: number) => Promise<string[]>;
  del: (...keys: string[]) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  quit: () => Promise<'OK' | string>;
};

async function client(ctx: ForgeActionContext): Promise<RedisClient> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('Redis: url is required');
  const mod = (await import('ioredis')) as unknown as {
    default?: new (url: string) => RedisClient;
    Redis?: new (url: string) => RedisClient;
  };
  const Redis = (mod.default ?? mod.Redis) as new (url: string) => RedisClient;
  if (!Redis) throw new Error('Redis: failed to load ioredis');
  return new Redis(url);
}

function key(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('Redis: sessionId is required');
  const prefix = asString(ctx.options.keyPrefix) || 'chat:';
  return `${prefix}${s}`;
}

async function saveMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const role = asString(ctx.options.role) || 'user';
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Redis: content is required');
  const ttl = asNumber(ctx.options.ttl);
  const r = await client(ctx);
  const k = key(ctx);
  try {
    await r.rpush(k, JSON.stringify({ role, content, at: new Date().toISOString() }));
    if (ttl && ttl > 0) await r.expire(k, ttl);
  } finally {
    await r.quit();
  }
  return { outputs: { ok: true }, logs: [`Redis save → ${k} (${role})`] };
}

async function loadSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const limit = asNumber(ctx.options.limit) ?? 0;
  const r = await client(ctx);
  const k = key(ctx);
  let raw: string[];
  try {
    raw = limit > 0 ? await r.lrange(k, -limit, -1) : await r.lrange(k, 0, -1);
  } finally {
    await r.quit();
  }
  const messages = raw.map((s) => {
    try {
      return JSON.parse(s) as { role: string; content: string; at?: string };
    } catch {
      return { role: 'user', content: s };
    }
  });
  return { outputs: { messages }, logs: [`Redis load → ${messages.length}`] };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const r = await client(ctx);
  const k = key(ctx);
  let deleted = 0;
  try {
    deleted = await r.del(k);
  } finally {
    await r.quit();
  }
  return { outputs: { cleared: deleted > 0 }, logs: [`Redis clear → ${k}`] };
}

const inlineCreds = [
  { id: 'url', label: 'Redis URL', type: 'password' as const, required: true, placeholder: 'redis://localhost:6379' },
  { id: 'keyPrefix', label: 'Key prefix', type: 'text' as const, placeholder: 'chat:' },
];

const block: ForgeBlock = {
  id: 'forge_mem_redis',
  name: 'Redis Chat Memory',
  description: 'Persist chat sessions in Redis lists.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'save_message',
      label: 'Save message',
      description: 'Append a message to the session list.',
      fields: [
        ...inlineCreds,
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'role', label: 'Role', type: 'text', defaultValue: 'user' },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
        { id: 'ttl', label: 'TTL (seconds)', type: 'number' },
      ],
      run: saveMessage,
    },
    {
      id: 'load_session',
      label: 'Load session',
      description: 'Return all (or last N) messages.',
      fields: [
        ...inlineCreds,
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit (last N)', type: 'number' },
      ],
      run: loadSession,
    },
    {
      id: 'clear_session',
      label: 'Clear session',
      description: 'Delete the session list.',
      fields: [
        ...inlineCreds,
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
      ],
      run: clearSession,
    },
  ],
};

registerForgeBlock(block);
export default block;
