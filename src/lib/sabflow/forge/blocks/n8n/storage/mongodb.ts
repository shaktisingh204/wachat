/**
 * Forge block: MongoDB
 *
 * Source: n8n-master/packages/nodes-base/nodes/MongoDb/MongoDb.node.ts
 * Credential type: 'mongodb' (CREDENTIAL_FIELD_SCHEMAS expects { connectionString }).
 *
 * Operations covered:
 *   - find                 collection.find(filter).limit(limit) → array
 *   - findOne              collection.findOne(filter)
 *   - insert               collection.insertMany(docs)
 *   - update               collection.updateMany(filter, update)
 *   - delete               collection.deleteMany(filter)
 *   - aggregate            collection.aggregate(pipeline)
 *   - listSearchIndexes    collection.listSearchIndexes([name])
 *   - createSearchIndex    collection.createSearchIndex({ name, definition, type })
 *   - updateSearchIndex    collection.updateSearchIndex(name, definition)
 *   - dropSearchIndex      collection.dropSearchIndex(name)
 *
 * Out of scope for the first port:
 *   - findOneAndReplace / findOneAndUpdate — n8n's port leans on its
 *     `prepareItems` per-row helpers (item-paired updates keyed by
 *     `updateKey`); SabFlow doesn't have an equivalent row-fanout abstraction
 *     in the forge surface yet, so users should call `update` with their own
 *     filter/update JSON in the meantime.
 *   - Transactions, change streams (those belong to triggers)
 *
 * Note: the connection is built per-call with `MongoClient` and closed in
 * `finally`. Pooling can be revisited once we know real usage patterns —
 * SabFlow already runs on a serverful Node host, so single-shot connect is
 * acceptable, but it's the obvious next perf knob to turn.
 */

import type { Document, Filter, UpdateFilter } from 'mongodb';
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString, requireCredential } from '../_shared/http';

async function withCollection<T>(
  ctx: ForgeActionContext,
  fn: (col: import('mongodb').Collection<Document>) => Promise<T>,
): Promise<T> {
  const cred = requireCredential('MongoDB', ctx.credential);
  const uri = cred.connectionString;
  if (!uri) throw new Error('MongoDB: credential missing `connectionString`');

  const database = asString(ctx.options.database);
  const collection = asString(ctx.options.collection);
  if (!database) throw new Error('MongoDB: database is required');
  if (!collection) throw new Error('MongoDB: collection is required');

  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    return await fn(client.db(database).collection(collection));
  } finally {
    await client.close().catch(() => undefined);
  }
}

function parseJsonField<T = unknown>(raw: unknown, fieldName: string): T {
  const s = asString(raw).trim();
  if (!s) return {} as T;
  try {
    return JSON.parse(s) as T;
  } catch (err) {
    throw new Error(`MongoDB: ${fieldName} is not valid JSON — ${(err as Error).message}`);
  }
}

// ── Actions ────────────────────────────────────────────────────────────────

async function findMany(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return withCollection(ctx, async (col) => {
    const filter = parseJsonField<Filter<Document>>(ctx.options.filter, 'filter');
    const limit = asNumber(ctx.options.limit) ?? 50;
    const docs = await col.find(filter).limit(limit).toArray();
    return { outputs: { docs, count: docs.length }, logs: [`MongoDB find → ${docs.length}`] };
  });
}

async function findOne(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return withCollection(ctx, async (col) => {
    const filter = parseJsonField<Filter<Document>>(ctx.options.filter, 'filter');
    const doc = await col.findOne(filter);
    return { outputs: { doc }, logs: [`MongoDB findOne → ${doc ? 'hit' : 'miss'}`] };
  });
}

async function insertDocs(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return withCollection(ctx, async (col) => {
    const docsRaw = parseJsonField<Document | Document[]>(ctx.options.documents, 'documents');
    const docs = Array.isArray(docsRaw) ? docsRaw : [docsRaw];
    if (docs.length === 0) throw new Error('MongoDB: at least one document is required');
    const res = await col.insertMany(docs);
    return {
      outputs: {
        insertedCount: res.insertedCount,
        insertedIds: Object.values(res.insertedIds).map(String),
      },
      logs: [`MongoDB insert → ${res.insertedCount}`],
    };
  });
}

async function updateDocs(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return withCollection(ctx, async (col) => {
    const filter = parseJsonField<Filter<Document>>(ctx.options.filter, 'filter');
    const update = parseJsonField<UpdateFilter<Document>>(ctx.options.update, 'update');
    const upsert = ctx.options.upsert === true;
    const res = await col.updateMany(filter, update, { upsert });
    return {
      outputs: {
        matchedCount: res.matchedCount,
        modifiedCount: res.modifiedCount,
        upsertedCount: res.upsertedCount,
        upsertedId: res.upsertedId ? String(res.upsertedId) : null,
      },
      logs: [`MongoDB update → matched ${res.matchedCount}, modified ${res.modifiedCount}`],
    };
  });
}

async function deleteDocs(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return withCollection(ctx, async (col) => {
    const filter = parseJsonField<Filter<Document>>(ctx.options.filter, 'filter');
    if (!Object.keys(filter).length && !ctx.options.allowEmptyFilter) {
      throw new Error('MongoDB: refusing to delete without a filter — tick "Allow empty filter" to override');
    }
    const res = await col.deleteMany(filter);
    return {
      outputs: { deletedCount: res.deletedCount },
      logs: [`MongoDB delete → ${res.deletedCount}`],
    };
  });
}

async function aggregateDocs(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return withCollection(ctx, async (col) => {
    // n8n parses a single JSON parameter and passes it through as a pipeline array.
    const raw = parseJsonField<Document | Document[]>(ctx.options.pipeline, 'pipeline');
    const pipeline = Array.isArray(raw) ? raw : [raw];
    const docs = await col.aggregate(pipeline).toArray();
    return { outputs: { docs, count: docs.length }, logs: [`MongoDB aggregate → ${docs.length}`] };
  });
}

async function listSearchIndexes(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return withCollection(ctx, async (col) => {
    const name = asString(ctx.options.indexName);
    const cursor = name ? col.listSearchIndexes(name) : col.listSearchIndexes();
    const indexes = await cursor.toArray();
    return { outputs: { indexes, count: indexes.length }, logs: [`MongoDB listSearchIndexes → ${indexes.length}`] };
  });
}

async function createSearchIndex(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return withCollection(ctx, async (col) => {
    const name = asString(ctx.options.indexName);
    const type = asString(ctx.options.indexType) || 'search';
    if (!name) throw new Error('MongoDB: index name is required');
    const definition = parseJsonField<Record<string, unknown>>(ctx.options.definition, 'definition');
    await col.createSearchIndex({ name, definition, type });
    return { outputs: { indexName: name }, logs: [`MongoDB createSearchIndex → ${name}`] };
  });
}

async function updateSearchIndex(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return withCollection(ctx, async (col) => {
    const name = asString(ctx.options.indexName);
    if (!name) throw new Error('MongoDB: index name is required');
    const definition = parseJsonField<Record<string, unknown>>(ctx.options.definition, 'definition');
    await col.updateSearchIndex(name, definition);
    return { outputs: { indexName: name, updated: true }, logs: [`MongoDB updateSearchIndex → ${name}`] };
  });
}

async function dropSearchIndex(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return withCollection(ctx, async (col) => {
    const name = asString(ctx.options.indexName);
    if (!name) throw new Error('MongoDB: index name is required');
    await col.dropSearchIndex(name);
    return { outputs: { indexName: name, dropped: true }, logs: [`MongoDB dropSearchIndex → ${name}`] };
  });
}

// ── Block ─────────────────────────────────────────────────────────────────

const COMMON_FIELDS = [
  { id: 'database', label: 'Database', type: 'text', required: true } as const,
  { id: 'collection', label: 'Collection', type: 'text', required: true } as const,
];

const block: ForgeBlock = {
  id: 'forge_mongodb',
  name: 'MongoDB',
  description: 'Query, insert, update and delete MongoDB documents.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'mongodb',
  },
  actions: [
    {
      id: 'find',
      label: 'Find documents',
      description: 'Return up to N documents matching the filter.',
      fields: [
        ...COMMON_FIELDS,
        { id: 'filter', label: 'Filter (JSON)', type: 'json', defaultValue: '{}' },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
      ],
      run: findMany,
    },
    {
      id: 'find_one',
      label: 'Find one document',
      description: 'Return the first document matching the filter.',
      fields: [
        ...COMMON_FIELDS,
        { id: 'filter', label: 'Filter (JSON)', type: 'json', defaultValue: '{}' },
      ],
      run: findOne,
    },
    {
      id: 'insert',
      label: 'Insert documents',
      description: 'Insert one document (object) or many (array).',
      fields: [
        ...COMMON_FIELDS,
        {
          id: 'documents',
          label: 'Documents (JSON)',
          type: 'json',
          required: true,
          placeholder: '[{ "name": "..." }]',
        },
      ],
      run: insertDocs,
    },
    {
      id: 'update',
      label: 'Update documents',
      description: 'Update all documents matching the filter.',
      fields: [
        ...COMMON_FIELDS,
        { id: 'filter', label: 'Filter (JSON)', type: 'json', defaultValue: '{}', required: true },
        {
          id: 'update',
          label: 'Update (JSON)',
          type: 'json',
          required: true,
          placeholder: '{ "$set": { "status": "done" } }',
        },
        { id: 'upsert', label: 'Upsert if not found', type: 'toggle', defaultValue: false },
      ],
      run: updateDocs,
    },
    {
      id: 'delete',
      label: 'Delete documents',
      description: 'Delete documents matching the filter.',
      fields: [
        ...COMMON_FIELDS,
        { id: 'filter', label: 'Filter (JSON)', type: 'json', required: true },
        {
          id: 'allowEmptyFilter',
          label: 'Allow empty filter (delete all)',
          type: 'toggle',
          defaultValue: false,
          helperText: 'Safety guard — an empty filter would otherwise wipe the collection.',
        },
      ],
      run: deleteDocs,
    },
    {
      id: 'aggregate',
      label: 'Aggregate',
      description: 'Run an aggregation pipeline on a collection.',
      fields: [
        ...COMMON_FIELDS,
        {
          id: 'pipeline',
          label: 'Pipeline (JSON array)',
          type: 'json',
          required: true,
          placeholder: '[{ "$match": { "status": "open" } }, { "$count": "n" }]',
        },
      ],
      run: aggregateDocs,
    },
    {
      id: 'list_search_indexes',
      label: 'List search indexes',
      description: 'List Atlas Search / vector search indexes on a collection.',
      fields: [
        ...COMMON_FIELDS,
        { id: 'indexName', label: 'Index name (optional)', type: 'text' },
      ],
      run: listSearchIndexes,
    },
    {
      id: 'create_search_index',
      label: 'Create search index',
      description: 'Create an Atlas Search or vector search index.',
      fields: [
        ...COMMON_FIELDS,
        { id: 'indexName', label: 'Index name', type: 'text', required: true },
        {
          id: 'indexType',
          label: 'Type',
          type: 'select',
          defaultValue: 'search',
          options: [
            { label: 'Search', value: 'search' },
            { label: 'Vector search', value: 'vectorSearch' },
          ],
        },
        {
          id: 'definition',
          label: 'Definition (JSON)',
          type: 'json',
          required: true,
          placeholder: '{ "mappings": { "dynamic": true } }',
        },
      ],
      run: createSearchIndex,
    },
    {
      id: 'update_search_index',
      label: 'Update search index',
      description: 'Replace the definition of an existing search index.',
      fields: [
        ...COMMON_FIELDS,
        { id: 'indexName', label: 'Index name', type: 'text', required: true },
        { id: 'definition', label: 'Definition (JSON)', type: 'json', required: true },
      ],
      run: updateSearchIndex,
    },
    {
      id: 'drop_search_index',
      label: 'Drop search index',
      description: 'Delete an Atlas Search index by name.',
      fields: [
        ...COMMON_FIELDS,
        { id: 'indexName', label: 'Index name', type: 'text', required: true },
      ],
      run: dropSearchIndex,
    },
  ],
};

registerForgeBlock(block);
export default block;
