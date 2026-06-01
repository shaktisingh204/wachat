import 'server-only';

import {
  type ClickHouseClient,
  ClickHouseLogLevel,
  createClient,
} from '@clickhouse/client';

// Reads configuration from environment variables directly (no NestJS DI).
function getClickHouseUrl(): string | undefined {
  return process.env.CLICKHOUSE_URL;
}

function buildClient(url: string): ClickHouseClient {
  return createClient({
    url,
    compression: {
      response: true,
      request: true,
    },
    clickhouse_settings: {
      async_insert: 1,
      wait_for_async_insert: 1,
    },
    application: 'sabcrm',
    log: { level: ClickHouseLogLevel.OFF },
  });
}

// Singleton main client — lazily initialised.
let _mainClient: ClickHouseClient | undefined;
const _clientMap = new Map<string, ClickHouseClient>();
const _initializingMap = new Map<string, boolean>();

export function getMainClient(): ClickHouseClient | undefined {
  if (_mainClient) return _mainClient;
  const url = getClickHouseUrl();
  if (!url) return undefined;
  _mainClient = buildClient(url);
  return _mainClient;
}

export async function connectToClient(
  clientId: string,
  url?: string,
): Promise<ClickHouseClient | undefined> {
  if (!getClickHouseUrl()) return undefined;

  // Wait for concurrent initialisation.
  while (_initializingMap.get(clientId)) {
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }

  if (_clientMap.has(clientId)) {
    return _clientMap.get(clientId);
  }

  _initializingMap.set(clientId, true);

  try {
    const targetUrl = url ?? getClickHouseUrl()!;
    const client = buildClient(targetUrl);
    await client.ping();
    _clientMap.set(clientId, client);
    return client;
  } catch (err) {
    console.error(`ClickHouseService: error connecting to client ${clientId}`, err);
    return undefined;
  } finally {
    _initializingMap.delete(clientId);
  }
}

export async function disconnectFromClient(clientId: string): Promise<void> {
  const client = _clientMap.get(clientId);
  if (client) {
    await client.close();
  }
  _clientMap.delete(clientId);
}

export async function closeAll(): Promise<void> {
  if (_mainClient) {
    await _mainClient.close();
    _mainClient = undefined;
  }
  for (const [, client] of _clientMap) {
    await client.close();
  }
  _clientMap.clear();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertRows<T extends Record<string, any>>(
  table: string,
  values: T[],
  clientId?: string,
): Promise<{ success: boolean }> {
  try {
    const client = clientId
      ? await connectToClient(clientId)
      : getMainClient();
    if (!client) return { success: false };
    await insertInChunks(client, table, values, { chunkSize: 1000, maxMemoryMB: 4 });
    return { success: true };
  } catch (err) {
    console.error('ClickHouseService: error inserting data', err);
    return { success: false };
  }
}

export async function selectRows<T>(
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>,
  clientId?: string,
): Promise<T[]> {
  try {
    const client = clientId
      ? await connectToClient(clientId)
      : getMainClient();
    if (!client) return [];
    const resultSet = await client.query({
      query,
      format: 'JSONEachRow',
      query_params: params,
    });
    const result = await resultSet.json<T>();
    return Array.isArray(result) ? result : [];
  } catch (err) {
    console.error('ClickHouseService: error executing select', err);
    return [];
  }
}

export async function createDatabase(databaseName: string): Promise<boolean> {
  try {
    const client = getMainClient();
    if (!client) return false;
    await client.exec({ query: `CREATE DATABASE IF NOT EXISTS ${databaseName}` });
    return true;
  } catch (err) {
    console.error('ClickHouseService: error creating database', err);
    return false;
  }
}

export async function dropDatabase(databaseName: string): Promise<boolean> {
  try {
    const client = getMainClient();
    if (!client) return false;
    await client.exec({ query: `DROP DATABASE IF EXISTS ${databaseName}` });
    return true;
  } catch (err) {
    console.error('ClickHouseService: error dropping database', err);
    return false;
  }
}

export async function executeCommand(
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>,
  clientId?: string,
): Promise<boolean> {
  try {
    const client = clientId
      ? await connectToClient(clientId)
      : getMainClient();
    if (!client) return false;
    await client.command({ query, query_params: params });
    return true;
  } catch (err) {
    console.error('ClickHouseService: error executing command', err);
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertInChunks<T extends Record<string, any>>(
  client: ClickHouseClient,
  table: string,
  values: T[],
  options: { chunkSize?: number; maxMemoryMB?: number } = {},
): Promise<void> {
  const chunkSize = options.chunkSize ?? 1000;
  const maxMemoryMB = options.maxMemoryMB;

  let chunk: T[] = [];
  let currentSizeBytes = 0;

  const flush = async () => {
    if (chunk.length === 0) return;
    await client.insert({ table, values: chunk, format: 'JSONEachRow' });
    chunk = [];
    currentSizeBytes = 0;
  };

  for (const row of values) {
    const rowSize = Buffer.byteLength(JSON.stringify(row));
    chunk.push(row);
    currentSizeBytes += rowSize;
    const currentSizeMB = currentSizeBytes / 1024 / 1024;
    if (
      chunk.length >= chunkSize ||
      (maxMemoryMB !== undefined && currentSizeMB >= maxMemoryMB)
    ) {
      await flush();
    }
  }

  await flush();
}
