/**
 * Forge block: Microsoft Excel (Graph)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/Excel/{MicrosoftExcel.node.ts, v2}
 * Credential type: 'microsoft_excel' — { clientId, clientSecret, refreshToken }
 *
 * Operations (Graph v1.0):
 *   - workbook.list  GET /me/drive/root/search(q='.xlsx')
 *   - worksheet.list GET /me/drive/items/{id}/workbook/worksheets
 *   - range.get      GET /me/drive/items/{id}/workbook/worksheets/{ws}/range(address='A1:C3')
 *   - range.update   PATCH /me/drive/items/{id}/workbook/worksheets/{ws}/range(address='A1:C3')
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, MICROSOFT_TOKEN_URL } from '../_shared/google_oauth';

const BASE = 'https://graph.microsoft.com/v1.0';
const SERVICE = 'Microsoft Excel';

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, ctx.credential, MICROSOFT_TOKEN_URL);
  const res = await apiRequest({
    service: SERVICE,
    method,
    url: `${BASE}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  return res.data;
}

async function workbookList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await call(ctx, 'GET', `/me/drive/root/search(q='.xlsx')`);
  return { outputs: { result: data }, logs: ['Excel workbooks list'] };
}

async function worksheetList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const itemId = asString(ctx.options.workbookId);
  if (!itemId) throw new Error(`${SERVICE}: workbookId is required`);
  const data = await call(ctx, 'GET', `/me/drive/items/${encodeURIComponent(itemId)}/workbook/worksheets`);
  return { outputs: { result: data }, logs: [`Excel worksheets list → ${itemId}`] };
}

async function rangeGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const itemId = asString(ctx.options.workbookId);
  const worksheet = asString(ctx.options.worksheet);
  const range = asString(ctx.options.range);
  if (!itemId) throw new Error(`${SERVICE}: workbookId is required`);
  if (!worksheet) throw new Error(`${SERVICE}: worksheet is required`);
  if (!range) throw new Error(`${SERVICE}: range is required`);
  const data = await call(
    ctx,
    'GET',
    `/me/drive/items/${encodeURIComponent(itemId)}/workbook/worksheets/${encodeURIComponent(worksheet)}/range(address='${encodeURIComponent(range)}')`,
  );
  return { outputs: { result: data }, logs: [`Excel range get → ${range}`] };
}

async function rangeUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const itemId = asString(ctx.options.workbookId);
  const worksheet = asString(ctx.options.worksheet);
  const range = asString(ctx.options.range);
  const valuesRaw = asString(ctx.options.values).trim();
  if (!itemId) throw new Error(`${SERVICE}: workbookId is required`);
  if (!worksheet) throw new Error(`${SERVICE}: worksheet is required`);
  if (!range) throw new Error(`${SERVICE}: range is required`);
  if (!valuesRaw) throw new Error(`${SERVICE}: values is required`);
  let values: unknown;
  try {
    values = JSON.parse(valuesRaw);
  } catch {
    throw new Error(`${SERVICE}: values must be valid JSON (2-D array)`);
  }
  if (!Array.isArray(values)) throw new Error(`${SERVICE}: values must be a JSON 2-D array`);
  const data = await call(
    ctx,
    'PATCH',
    `/me/drive/items/${encodeURIComponent(itemId)}/workbook/worksheets/${encodeURIComponent(worksheet)}/range(address='${encodeURIComponent(range)}')`,
    { values },
  );
  return { outputs: { result: data }, logs: [`Excel range update → ${range}`] };
}

const block: ForgeBlock = {
  id: 'forge_microsoft_excel',
  name: 'Microsoft Excel',
  description: 'Read and write ranges in Microsoft Excel workbooks via Graph.',
  iconName: 'LuSheet',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'microsoft_excel' },
  actions: [
    {
      id: 'workbook_list',
      label: 'List workbooks',
      description: 'Search drive for .xlsx workbooks.',
      fields: [],
      run: workbookList,
    },
    {
      id: 'worksheet_list',
      label: 'List worksheets',
      description: 'List worksheets in a workbook.',
      fields: [{ id: 'workbookId', label: 'Workbook ID', type: 'text', required: true }],
      run: worksheetList,
    },
    {
      id: 'range_get',
      label: 'Get range',
      description: 'Read a range from a worksheet.',
      fields: [
        { id: 'workbookId', label: 'Workbook ID', type: 'text', required: true },
        { id: 'worksheet', label: 'Worksheet name', type: 'text', required: true },
        { id: 'range', label: 'Range (e.g. A1:C3)', type: 'text', required: true },
      ],
      run: rangeGet,
    },
    {
      id: 'range_update',
      label: 'Update range',
      description: 'Update a range with a 2-D JSON array of values.',
      fields: [
        { id: 'workbookId', label: 'Workbook ID', type: 'text', required: true },
        { id: 'worksheet', label: 'Worksheet name', type: 'text', required: true },
        { id: 'range', label: 'Range', type: 'text', required: true },
        { id: 'values', label: 'Values (JSON 2-D array)', type: 'json', required: true },
      ],
      run: rangeUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
