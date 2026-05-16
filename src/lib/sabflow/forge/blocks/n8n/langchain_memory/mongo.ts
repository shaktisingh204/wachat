/**
 * Forge block: MongoDB Chat Memory
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/memory/MemoryMongoDbChat
 *
 * Documents look like:
 *   { sessionId: <id>, role: 'user'|'assistant'|'system', content: <text>, at: <iso> }
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

type Message = { sessionId: string; role: string; content: string; at: string };

type MongoCursor = {
  sort: (s: Record<string, 1 | -1>) => MongoCursor;
  limit: (n: number) => MongoCursor;
  toArray: () => Promise<Message[]>;
};

type MongoCollection = {
  insertOne: (doc: Message) => Promise<{ insertedId?: unknown }>;
  find: (filter: unknown) => MongoCursor;
  deleteMany: (filter: unknown) => Promise<{ deletedCount?: number }>;
};

type MongoClient = {
  connect: () => Promise<unknown>;
  db: (name: string) => { collection: (name: string) => MongoCollection };
  close: () => Promise<void>;
};

async function client(ctx: ForgeActionContext): Promise<{
  client: MongoClient;
  coll: MongoCollection;
}> {
  const uri = asString(ctx.options.uri);
  const dbName = asString(ctx.options.database);
  const collName = asString(ctx.options.collection) || 'chat_history';
  if (!uri) throw new Error('MongoDB: uri is required');
  if (!dbName) throw new Error('MongoDB: database is required');
  const mod = (await import('mongodb')) as unknown as {
    MongoClient: new (uri: string) => MongoClient;
  };
  const c = new mod.MongoClient(uri);
  await c.connect();
  return { client: c, coll: c.db(dbName).collection(collName) };
}

function sessionId(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('MongoDB: sessionId is required');
  return s;
}

async function saveMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const role = asString(ctx.options.role) || 'user';
  const content = asString(ctx.options.content);
  if (!content) throw new Error('MongoDB: content is required');
  const { client: c, coll } = await client(ctx);
  try {
    await coll.insertOne({ sessionId: id, role, content, at: new Date().toISOString() });
  } finally {
    await c.close();
  }
  return { outputs: { ok: true }, logs: [`MongoDB save → ${id} (${role})`] };
}

async function loadSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const limit = asNumber(ctx.options.limit) ?? 0;
  const { client: c, coll } = await client(ctx);
  let rows: Message[];
  try {
    let cur = coll.find({ sessionId: id }).sort({ at: 1 });
    if (limit > 0) cur = cur.limit(limit);
    rows = await cur.toArray();
  } finally {
    await c.close();
  }
  const messages = rows.map((r) => ({ role: r.role, content: r.content, at: r.at }));
  return { outputs: { messages }, logs: [`MongoDB load → ${messages.length}`] };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const { client: c, coll } = await client(ctx);
  let deleted = 0;
  try {
    const r = await coll.deleteMany({ sessionId: id });
    deleted = r.deletedCount ?? 0;
  } finally {
    await c.close();
  }
  return { outputs: { cleared: deleted }, logs: [`MongoDB clear → ${deleted}`] };
}

const inlineCreds = [
  { id: 'uri', label: 'Connection URI', type: 'password' as const, required: true, placeholder: 'mongodb+srv://user:pass@cluster/' },
  { id: 'database', label: 'Database', type: 'text' as const, required: true },
  { id: 'collection', label: 'Collection', type: 'text' as const, placeholder: 'chat_history' },
];

const block: ForgeBlock = {
  id: 'forge_mem_mongo',
  name: 'MongoDB Chat Memory',
  description: 'Persist chat sessions in a MongoDB collection.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'save_message',
      label: 'Save message',
      description: 'Insert a message document.',
      fields: [
        ...inlineCreds,
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'role', label: 'Role', type: 'text', defaultValue: 'user' },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
      ],
      run: saveMessage,
    },
    {
      id: 'load_session',
      label: 'Load session',
      description: 'Return all messages for a session ordered by time.',
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
      description: 'Delete all messages for a session.',
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
