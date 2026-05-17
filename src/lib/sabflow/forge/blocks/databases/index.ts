/**
 * Step 39 — native database forge blocks.
 *
 * Four blocks with real executors:
 *   - Postgres (pg)
 *   - MySQL (mysql2)
 *   - MongoDB (mongodb)
 *   - Redis (ioredis)
 *
 * Each uses dynamic `import()` for the driver so:
 *   1. Edge / browser bundles don't pull in Node-only native modules.
 *   2. Drivers that aren't installed don't break unrelated routes — they
 *      only fail when the user actually tries to run the block.
 *
 * Credential bag conventions match the existing Step 3 testers
 * (`testPostgres`, `testMySql`, `testMongo`, `testRedis`) so users with
 * tested credentials can wire them straight into these blocks.
 */

import { registerForgeBlock } from '../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../types';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

function writeOutput(ctx: ForgeActionContext, value: unknown): Record<string, unknown> {
  const key = str(ctx.options.outputVariable);
  return key ? { [key]: value, result: value } : { result: value };
}

function parseParams(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [value];
    }
  }
  return [value];
}

/* ── Postgres ───────────────────────────────────────────────────────────── */

type PgClientCtor = new (opts: {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  connectionString?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
}) => {
  connect: () => Promise<void>;
  end: () => Promise<void>;
  query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
};

async function postgresQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = ctx.credential ?? {};
  const sql = str(ctx.options.sql);
  if (!sql) throw new Error('Postgres: SQL is required');
  const params = parseParams(ctx.options.params);

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const dynImport = new Function('s', 'return import(s)') as (
    s: string,
  ) => Promise<unknown>;
  const mod = (await dynImport('pg')) as { Client: PgClientCtor };
  const Client = mod.Client;
  const client = new Client({
    host: cred.host,
    port: cred.port ? Number(cred.port) : 5432,
    user: cred.user,
    password: cred.password,
    database: cred.database,
    connectionString: cred.connectionString || undefined,
    ssl:
      cred.ssl === 'true' || cred.ssl === '1'
        ? { rejectUnauthorized: false }
        : undefined,
  });
  await client.connect();
  try {
    const result = await client.query(sql, params);
    return {
      outputs: writeOutput(ctx, { rows: result.rows, rowCount: result.rowCount }),
      logs: [`Postgres: ${result.rowCount ?? result.rows.length} row(s)`],
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

registerForgeBlock({
  id: 'forge_postgres',
  name: 'Postgres',
  description: 'Run a parameterised SQL query against a Postgres database.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'postgres' },
  actions: [
    {
      id: 'query',
      label: 'Query',
      description: 'Run any SQL — SELECT, INSERT, UPDATE, DELETE.',
      fields: [
        { id: 'sql', label: 'SQL', type: 'code', required: true, placeholder: 'SELECT $1::text;' },
        { id: 'params', label: 'Parameters (JSON array)', type: 'json' },
        { id: 'outputVariable', label: 'Save result to variable', type: 'text' },
      ],
      run: postgresQuery,
    },
  ],
});

/* ── MySQL ──────────────────────────────────────────────────────────────── */

type MysqlPool = {
  query: (sql: string, values?: unknown[]) => Promise<[unknown, unknown]>;
  end: () => Promise<void>;
};
type MysqlCreatePool = (opts: {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  connectionLimit?: number;
  uri?: string;
}) => MysqlPool;

async function mysqlQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = ctx.credential ?? {};
  const sql = str(ctx.options.sql);
  if (!sql) throw new Error('MySQL: SQL is required');
  const params = parseParams(ctx.options.params);

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const dynImport = new Function('s', 'return import(s)') as (
    s: string,
  ) => Promise<unknown>;
  const mod = (await dynImport('mysql2/promise')) as {
    createPool: MysqlCreatePool;
  };
  const pool = mod.createPool({
    host: cred.host,
    port: cred.port ? Number(cred.port) : 3306,
    user: cred.user,
    password: cred.password,
    database: cred.database,
    uri: cred.uri || undefined,
    connectionLimit: 1,
  });
  try {
    const [rows] = await pool.query(sql, params);
    const rowsArr = Array.isArray(rows) ? rows : [rows];
    return {
      outputs: writeOutput(ctx, { rows, rowCount: rowsArr.length }),
      logs: [`MySQL: ${rowsArr.length} row(s)`],
    };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

registerForgeBlock({
  id: 'forge_mysql',
  name: 'MySQL',
  description: 'Run a parameterised SQL query against a MySQL database.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mysql' },
  actions: [
    {
      id: 'query',
      label: 'Query',
      description: 'Run any SQL — SELECT, INSERT, UPDATE, DELETE.',
      fields: [
        { id: 'sql', label: 'SQL', type: 'code', required: true, placeholder: 'SELECT ?;' },
        { id: 'params', label: 'Parameters (JSON array)', type: 'json' },
        { id: 'outputVariable', label: 'Save result to variable', type: 'text' },
      ],
      run: mysqlQuery,
    },
  ],
});

/* ── MongoDB ────────────────────────────────────────────────────────────── */

type MongoCollection = {
  find: (filter: unknown) => { toArray: () => Promise<unknown[]> };
  insertOne: (doc: unknown) => Promise<{ insertedId: unknown }>;
  updateOne: (filter: unknown, update: unknown) => Promise<{ matchedCount: number; modifiedCount: number }>;
  deleteOne: (filter: unknown) => Promise<{ deletedCount: number }>;
};
type MongoDb = { collection: (name: string) => MongoCollection };
type MongoClientCtor = new (uri: string) => {
  connect: () => Promise<unknown>;
  close: () => Promise<void>;
  db: (name?: string) => MongoDb;
};

async function mongoOp(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = ctx.credential ?? {};
  const uri = cred.connectionString ?? cred.uri;
  if (!uri) throw new Error('MongoDB: credential must include connectionString');
  const dbName = str(ctx.options.database) || cred.database;
  const collectionName = str(ctx.options.collection);
  const operation = (str(ctx.options.operation) || 'find').toLowerCase();
  if (!collectionName) throw new Error('MongoDB: collection is required');

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const dynImport = new Function('s', 'return import(s)') as (
    s: string,
  ) => Promise<unknown>;
  const mod = (await dynImport('mongodb')) as { MongoClient: MongoClientCtor };
  const MongoClient = mod.MongoClient;
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const collection = client.db(dbName).collection(collectionName);
    const filter = parseJsonObject(ctx.options.filter);
    const doc = parseJsonObject(ctx.options.document);
    const update = parseJsonObject(ctx.options.update);

    let result: unknown;
    switch (operation) {
      case 'find':
        result = await collection.find(filter).toArray();
        break;
      case 'insert':
      case 'insertone':
        result = await collection.insertOne(doc);
        break;
      case 'update':
      case 'updateone':
        result = await collection.updateOne(filter, update);
        break;
      case 'delete':
      case 'deleteone':
        result = await collection.deleteOne(filter);
        break;
      default:
        throw new Error(`MongoDB: unknown operation "${operation}"`);
    }
    return {
      outputs: writeOutput(ctx, result),
      logs: [`MongoDB ${operation}: ${collectionName}`],
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* fall through */
    }
  }
  return {};
}

registerForgeBlock({
  id: 'forge_mongodb',
  name: 'MongoDB',
  description: 'Run a find / insert / update / delete operation against MongoDB.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mongodb' },
  actions: [
    {
      id: 'operation',
      label: 'Operation',
      description: 'Find / insert / update / delete a single document.',
      fields: [
        { id: 'database',   label: 'Database name (overrides credential)', type: 'text' },
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        {
          id: 'operation',
          label: 'Operation',
          type: 'select',
          options: [
            { label: 'Find', value: 'find' },
            { label: 'Insert one', value: 'insertOne' },
            { label: 'Update one', value: 'updateOne' },
            { label: 'Delete one', value: 'deleteOne' },
          ],
        },
        { id: 'filter',   label: 'Filter (JSON)', type: 'json' },
        { id: 'document', label: 'Document — for insertOne (JSON)', type: 'json' },
        { id: 'update',   label: 'Update spec — for updateOne (JSON, with $set etc.)', type: 'json' },
        { id: 'outputVariable', label: 'Save result to variable', type: 'text' },
      ],
      run: mongoOp,
    },
  ],
});

/* ── Redis ──────────────────────────────────────────────────────────────── */

type RedisClient = {
  on: (ev: string, cb: (e: unknown) => void) => RedisClient;
  connect: () => Promise<void>;
  quit: () => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ...args: unknown[]) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  publish: (channel: string, msg: string) => Promise<number>;
};
type RedisCreateClient = (opts: { url: string }) => RedisClient;

async function redisOp(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = ctx.credential ?? {};
  const url = cred.connectionString ?? cred.url ?? cred.uri;
  if (!url) throw new Error('Redis: credential must include connectionString or url');
  const operation = (str(ctx.options.operation) || 'get').toLowerCase();
  const key = str(ctx.options.key);
  const value = str(ctx.options.value);
  const channel = str(ctx.options.channel);
  const ttlSeconds = ctx.options.ttlSeconds ? Number(ctx.options.ttlSeconds) : 0;

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const dynImport = new Function('s', 'return import(s)') as (
    s: string,
  ) => Promise<unknown>;
  const mod = (await dynImport('redis')) as { createClient: RedisCreateClient };
  const client = mod.createClient({ url });
  client.on('error', () => undefined);
  await client.connect();
  try {
    let result: unknown;
    switch (operation) {
      case 'get':
        if (!key) throw new Error('Redis GET: key is required');
        result = await client.get(key);
        break;
      case 'set':
        if (!key) throw new Error('Redis SET: key is required');
        result =
          ttlSeconds > 0
            ? await client.set(key, value, { EX: ttlSeconds })
            : await client.set(key, value);
        break;
      case 'del':
        if (!key) throw new Error('Redis DEL: key is required');
        result = await client.del(key);
        break;
      case 'publish':
        if (!channel) throw new Error('Redis PUBLISH: channel is required');
        result = await client.publish(channel, value);
        break;
      default:
        throw new Error(`Redis: unknown operation "${operation}"`);
    }
    return {
      outputs: writeOutput(ctx, result),
      logs: [`Redis ${operation}: ${key || channel}`],
    };
  } finally {
    await client.quit().catch(() => undefined);
  }
}

registerForgeBlock({
  id: 'forge_redis',
  name: 'Redis',
  description: 'GET / SET / DEL / PUBLISH against a Redis instance.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'redis' },
  actions: [
    {
      id: 'operation',
      label: 'Operation',
      description: 'Single Redis command.',
      fields: [
        {
          id: 'operation',
          label: 'Operation',
          type: 'select',
          options: [
            { label: 'GET', value: 'get' },
            { label: 'SET', value: 'set' },
            { label: 'DEL', value: 'del' },
            { label: 'PUBLISH', value: 'publish' },
          ],
        },
        { id: 'key',     label: 'Key', type: 'text' },
        { id: 'value',   label: 'Value (for SET / PUBLISH)', type: 'text' },
        { id: 'ttlSeconds', label: 'TTL seconds (SET only)', type: 'number' },
        { id: 'channel', label: 'Channel (for PUBLISH)', type: 'text' },
        { id: 'outputVariable', label: 'Save result to variable', type: 'text' },
      ],
      run: redisOp,
    },
  ],
});

export const STEP_39_DB_BLOCK_IDS = [
  'forge_postgres',
  'forge_mysql',
  'forge_mongodb',
  'forge_redis',
] as const;
