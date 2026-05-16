/**
 * Forge block: AWS DynamoDB
 *
 * Source: n8n-master/packages/nodes-base/nodes/Aws/DynamoDB/AwsDynamoDB.node.ts
 *
 * Dynamic-imports `@aws-sdk/client-dynamodb` so the block can be authored ahead
 * of the dependency being added to package.json — same approach as
 * `infra/oracle.ts` (oracledb) and `infra/postgres.ts` did before `pg` shipped.
 *
 * Actions: get-item, put-item, query, scan, delete-item.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock, ForgeField } from '../../../types';
import { asNumber, asString } from '../_shared/http';
import { optionalImport } from '../_shared/optional_import';

type AwsCred = { accessKeyId: string; secretAccessKey: string; region: string };

function readCred(ctx: ForgeActionContext): AwsCred {
  const accessKeyId = asString(ctx.options.accessKeyId);
  const secretAccessKey = asString(ctx.options.secretAccessKey);
  const region = asString(ctx.options.region);
  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('AWS DynamoDB: accessKeyId, secretAccessKey and region are required');
  }
  return { accessKeyId, secretAccessKey, region };
}

type SdkClient = {
  send: (cmd: unknown) => Promise<Record<string, unknown>>;
  destroy?: () => void;
};

type DynamoSdk = Record<string, unknown> & {
  DynamoDBClient: new (cfg: Record<string, unknown>) => SdkClient;
};

async function loadSdk(): Promise<DynamoSdk> {
  try {
    const mod = await optionalImport<Record<string, unknown>>('@aws-sdk/client-dynamodb');
    const real = ((mod as { default?: Record<string, unknown> }).default ?? mod) as DynamoSdk;
    if (typeof real.DynamoDBClient !== 'function') {
      throw new Error('DynamoDBClient missing');
    }
    return real;
  } catch {
    throw new Error("AWS DynamoDB: install '@aws-sdk/client-dynamodb' to use this block");
  }
}

function clientFor(cred: AwsCred, sdk: DynamoSdk): SdkClient {
  return new sdk.DynamoDBClient({
    region: cred.region,
    credentials: { accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey },
  });
}

function parseJsonOption(label: string, raw: unknown, fallback: unknown): unknown {
  const s = asString(raw).trim();
  if (!s) return fallback;
  try {
    return JSON.parse(s);
  } catch (err) {
    throw new Error(`AWS DynamoDB: ${label} is not valid JSON — ${(err as Error).message}`);
  }
}

async function runCommand(sdk: DynamoSdk, cmdName: string, input: Record<string, unknown>, cred: AwsCred): Promise<Record<string, unknown>> {
  const Ctor = sdk[cmdName] as undefined | (new (i: Record<string, unknown>) => unknown);
  if (typeof Ctor !== 'function') {
    throw new Error(`AWS DynamoDB: ${cmdName} not available in SDK`);
  }
  const client = clientFor(cred, sdk);
  try {
    return await client.send(new Ctor(input));
  } finally {
    client.destroy?.();
  }
}

async function getItem(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const TableName = asString(ctx.options.tableName);
  if (!TableName) throw new Error('AWS DynamoDB: tableName is required');
  const Key = parseJsonOption('key', ctx.options.key, undefined);
  if (!Key) throw new Error('AWS DynamoDB: key is required (JSON in DynamoDB AttributeValue form)');
  const res = await runCommand(sdk, 'GetItemCommand', { TableName, Key }, cred);
  return {
    outputs: { item: res.Item ?? null, consumedCapacity: res.ConsumedCapacity ?? null },
    logs: [`DynamoDB GetItem ${TableName} → ${res.Item ? 'found' : 'missing'}`],
  };
}

async function putItem(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const TableName = asString(ctx.options.tableName);
  if (!TableName) throw new Error('AWS DynamoDB: tableName is required');
  const Item = parseJsonOption('item', ctx.options.item, undefined);
  if (!Item) throw new Error('AWS DynamoDB: item is required (JSON in DynamoDB AttributeValue form)');
  const res = await runCommand(sdk, 'PutItemCommand', { TableName, Item }, cred);
  return {
    outputs: { attributes: res.Attributes ?? null, consumedCapacity: res.ConsumedCapacity ?? null },
    logs: [`DynamoDB PutItem ${TableName}`],
  };
}

async function query(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const TableName = asString(ctx.options.tableName);
  if (!TableName) throw new Error('AWS DynamoDB: tableName is required');
  const KeyConditionExpression = asString(ctx.options.keyConditionExpression);
  if (!KeyConditionExpression) throw new Error('AWS DynamoDB: keyConditionExpression is required');
  const ExpressionAttributeValues = parseJsonOption('expressionAttributeValues', ctx.options.expressionAttributeValues, undefined);
  const ExpressionAttributeNames = parseJsonOption('expressionAttributeNames', ctx.options.expressionAttributeNames, undefined);
  const Limit = asNumber(ctx.options.limit);
  const IndexName = asString(ctx.options.indexName) || undefined;
  const input: Record<string, unknown> = { TableName, KeyConditionExpression };
  if (ExpressionAttributeValues !== undefined) input.ExpressionAttributeValues = ExpressionAttributeValues;
  if (ExpressionAttributeNames !== undefined) input.ExpressionAttributeNames = ExpressionAttributeNames;
  if (Limit !== undefined) input.Limit = Limit;
  if (IndexName) input.IndexName = IndexName;
  const res = await runCommand(sdk, 'QueryCommand', input, cred);
  const items = (res.Items as unknown[] | undefined) ?? [];
  return {
    outputs: {
      items,
      count: (res.Count as number | undefined) ?? items.length,
      scannedCount: res.ScannedCount ?? null,
      lastEvaluatedKey: res.LastEvaluatedKey ?? null,
    },
    logs: [`DynamoDB Query ${TableName} → ${items.length} item(s)`],
  };
}

async function scan(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const TableName = asString(ctx.options.tableName);
  if (!TableName) throw new Error('AWS DynamoDB: tableName is required');
  const Limit = asNumber(ctx.options.limit);
  const FilterExpression = asString(ctx.options.filterExpression) || undefined;
  const ExpressionAttributeValues = parseJsonOption('expressionAttributeValues', ctx.options.expressionAttributeValues, undefined);
  const ExpressionAttributeNames = parseJsonOption('expressionAttributeNames', ctx.options.expressionAttributeNames, undefined);
  const input: Record<string, unknown> = { TableName };
  if (Limit !== undefined) input.Limit = Limit;
  if (FilterExpression) input.FilterExpression = FilterExpression;
  if (ExpressionAttributeValues !== undefined) input.ExpressionAttributeValues = ExpressionAttributeValues;
  if (ExpressionAttributeNames !== undefined) input.ExpressionAttributeNames = ExpressionAttributeNames;
  const res = await runCommand(sdk, 'ScanCommand', input, cred);
  const items = (res.Items as unknown[] | undefined) ?? [];
  return {
    outputs: {
      items,
      count: (res.Count as number | undefined) ?? items.length,
      scannedCount: res.ScannedCount ?? null,
      lastEvaluatedKey: res.LastEvaluatedKey ?? null,
    },
    logs: [`DynamoDB Scan ${TableName} → ${items.length} item(s)`],
  };
}

async function deleteItem(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const TableName = asString(ctx.options.tableName);
  if (!TableName) throw new Error('AWS DynamoDB: tableName is required');
  const Key = parseJsonOption('key', ctx.options.key, undefined);
  if (!Key) throw new Error('AWS DynamoDB: key is required');
  const res = await runCommand(sdk, 'DeleteItemCommand', { TableName, Key }, cred);
  return {
    outputs: { attributes: res.Attributes ?? null, consumedCapacity: res.ConsumedCapacity ?? null, deleted: true },
    logs: [`DynamoDB DeleteItem ${TableName}`],
  };
}

const CRED_FIELDS: ForgeField[] = [
  { id: 'accessKeyId', label: 'Access key id', type: 'password', required: true },
  { id: 'secretAccessKey', label: 'Secret access key', type: 'password', required: true },
  { id: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
];

const block: ForgeBlock = {
  id: 'forge_aws_dynamodb',
  name: 'AWS DynamoDB',
  description: 'Read and write items in DynamoDB tables (SigV4 via AWS SDK v3).',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'get_item',
      label: 'Get item',
      description: 'GetItem by primary key.',
      fields: [
        ...CRED_FIELDS,
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'key', label: 'Key (DynamoDB JSON)', type: 'json', required: true, placeholder: '{"id":{"S":"abc"}}' },
      ],
      run: getItem,
    },
    {
      id: 'put_item',
      label: 'Put item',
      description: 'PutItem replaces or creates an item.',
      fields: [
        ...CRED_FIELDS,
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'item', label: 'Item (DynamoDB JSON)', type: 'json', required: true },
      ],
      run: putItem,
    },
    {
      id: 'query',
      label: 'Query',
      description: 'Query items using a KeyConditionExpression.',
      fields: [
        ...CRED_FIELDS,
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'keyConditionExpression', label: 'KeyConditionExpression', type: 'text', required: true, placeholder: 'pk = :pk' },
        { id: 'expressionAttributeValues', label: 'ExpressionAttributeValues (JSON)', type: 'json' },
        { id: 'expressionAttributeNames', label: 'ExpressionAttributeNames (JSON)', type: 'json' },
        { id: 'indexName', label: 'IndexName', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: query,
    },
    {
      id: 'scan',
      label: 'Scan',
      description: 'Scan the entire table (paginated).',
      fields: [
        ...CRED_FIELDS,
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'filterExpression', label: 'FilterExpression', type: 'text' },
        { id: 'expressionAttributeValues', label: 'ExpressionAttributeValues (JSON)', type: 'json' },
        { id: 'expressionAttributeNames', label: 'ExpressionAttributeNames (JSON)', type: 'json' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: scan,
    },
    {
      id: 'delete_item',
      label: 'Delete item',
      description: 'DeleteItem by primary key.',
      fields: [
        ...CRED_FIELDS,
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'key', label: 'Key (DynamoDB JSON)', type: 'json', required: true },
      ],
      run: deleteItem,
    },
  ],
};

registerForgeBlock(block);
export default block;
