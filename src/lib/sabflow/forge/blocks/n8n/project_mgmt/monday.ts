/**
 * Forge block: Monday.com
 *
 * Source: n8n-master/packages/nodes-base/nodes/MondayCom/MondayCom.node.ts
 * Credential type: 'monday_com' (CREDENTIAL_FIELD_SCHEMAS → { apiToken }).
 *
 * Operations covered (board item subset, GraphQL):
 *   - item.create
 *   - item.get
 *   - item.changeColumnValue
 *   - item.delete
 *   - item.addUpdate (comment)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const ENDPOINT = 'https://api.monday.com/v2/';

async function gql<T = unknown>(
  ctx: ForgeActionContext,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const cred = requireCredential('Monday.com', ctx.credential);
  const apiToken = cred.apiToken ?? cred.accessToken;
  if (!apiToken) throw new Error('Monday.com: credential is missing `apiToken`');

  const res = await apiRequest({
    service: 'Monday.com',
    method: 'POST',
    url: ENDPOINT,
    headers: { Authorization: apiToken },
    json: { query, variables },
  });
  const body = res.data as { data?: T; errors?: Array<{ message: string }> };
  if (body?.errors?.length) {
    throw new Error(`Monday.com GraphQL: ${body.errors.map((e) => e.message).join('; ')}`);
  }
  return body.data as T;
}

async function itemCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const boardId = asString(ctx.options.boardId);
  const itemName = asString(ctx.options.itemName);
  if (!boardId) throw new Error('Monday.com: boardId is required');
  if (!itemName) throw new Error('Monday.com: itemName is required');

  const groupId = asString(ctx.options.groupId) || undefined;
  const columnValuesRaw = asString(ctx.options.columnValues);

  const data = await gql<{ create_item: { id: string; name: string } }>(
    ctx,
    `mutation CreateItem($boardId: ID!, $itemName: String!, $groupId: String, $columnValues: JSON) {
      create_item(board_id: $boardId, item_name: $itemName, group_id: $groupId, column_values: $columnValues) {
        id name
      }
    }`,
    {
      boardId,
      itemName,
      groupId,
      columnValues: columnValuesRaw || undefined,
    },
  );
  return { outputs: { item: data.create_item }, logs: [`Monday item create → ${data.create_item?.id}`] };
}

async function itemGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const itemId = asString(ctx.options.itemId);
  if (!itemId) throw new Error('Monday.com: itemId is required');
  const data = await gql<{ items: Array<{ id: string; name: string; column_values: unknown[] }> }>(
    ctx,
    `query GetItem($ids: [ID!]) {
      items(ids: $ids) {
        id name state created_at
        column_values { id text type value }
      }
    }`,
    { ids: [itemId] },
  );
  return { outputs: { item: data.items?.[0] ?? null }, logs: [`Monday item get → ${itemId}`] };
}

async function itemChangeColumnValue(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const boardId = asString(ctx.options.boardId);
  const itemId = asString(ctx.options.itemId);
  const columnId = asString(ctx.options.columnId);
  const value = asString(ctx.options.value);
  if (!boardId) throw new Error('Monday.com: boardId is required');
  if (!itemId) throw new Error('Monday.com: itemId is required');
  if (!columnId) throw new Error('Monday.com: columnId is required');
  if (!value) throw new Error('Monday.com: value is required');

  const data = await gql<{ change_column_value: { id: string } }>(
    ctx,
    `mutation ChangeColumn($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
      change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) { id }
    }`,
    { boardId, itemId, columnId, value },
  );
  return { outputs: { item: data.change_column_value }, logs: [`Monday item col update → ${itemId}/${columnId}`] };
}

async function itemDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const itemId = asString(ctx.options.itemId);
  if (!itemId) throw new Error('Monday.com: itemId is required');
  const data = await gql<{ delete_item: { id: string } }>(
    ctx,
    `mutation DeleteItem($itemId: ID!) { delete_item(item_id: $itemId) { id } }`,
    { itemId },
  );
  return { outputs: { success: true, id: data.delete_item?.id }, logs: [`Monday item delete → ${itemId}`] };
}

async function itemAddUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const itemId = asString(ctx.options.itemId);
  const body = asString(ctx.options.body);
  if (!itemId) throw new Error('Monday.com: itemId is required');
  if (!body) throw new Error('Monday.com: body is required');
  const data = await gql<{ create_update: { id: string } }>(
    ctx,
    `mutation CreateUpdate($itemId: ID!, $body: String!) {
      create_update(item_id: $itemId, body: $body) { id body created_at }
    }`,
    { itemId, body },
  );
  return { outputs: { update: data.create_update }, logs: [`Monday update → ${itemId}`] };
}

const block: ForgeBlock = {
  id: 'forge_monday',
  name: 'Monday.com',
  description: 'Create, update and comment on Monday.com board items from a flow.',
  iconName: 'LuLayoutDashboard',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'monday_com' },
  actions: [
    {
      id: 'item_create',
      label: 'Create item',
      description: 'Create a new item on a board.',
      fields: [
        { id: 'boardId', label: 'Board ID', type: 'text', required: true },
        { id: 'itemName', label: 'Item name', type: 'text', required: true },
        { id: 'groupId', label: 'Group ID', type: 'text' },
        { id: 'columnValues', label: 'Column values (JSON string)', type: 'textarea', placeholder: '{"status":{"label":"Done"}}' },
      ],
      run: itemCreate,
    },
    {
      id: 'item_get',
      label: 'Get item',
      description: 'Fetch a single item by id.',
      fields: [{ id: 'itemId', label: 'Item ID', type: 'text', required: true }],
      run: itemGet,
    },
    {
      id: 'item_change_column_value',
      label: 'Change column value',
      description: 'Update a single column on an item.',
      fields: [
        { id: 'boardId', label: 'Board ID', type: 'text', required: true },
        { id: 'itemId', label: 'Item ID', type: 'text', required: true },
        { id: 'columnId', label: 'Column ID', type: 'text', required: true },
        { id: 'value', label: 'Value (JSON string)', type: 'textarea', required: true },
      ],
      run: itemChangeColumnValue,
    },
    {
      id: 'item_delete',
      label: 'Delete item',
      description: 'Permanently delete an item.',
      fields: [{ id: 'itemId', label: 'Item ID', type: 'text', required: true }],
      run: itemDelete,
    },
    {
      id: 'item_add_update',
      label: 'Add update to item',
      description: 'Post an update (comment) on an item.',
      fields: [
        { id: 'itemId', label: 'Item ID', type: 'text', required: true },
        { id: 'body', label: 'Body', type: 'textarea', required: true },
      ],
      run: itemAddUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
