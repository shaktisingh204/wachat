/**
 * Forge block: Microsoft Excel V1
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/Excel/v1/MicrosoftExcelV1.node.ts
 *
 * Microsoft Graph bearer token. Operates on workbooks in the user's drive.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://graph.microsoft.com/v1.0';

function headers(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('MS Excel: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function worksheetsList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workbookId = asString(ctx.options.workbookId);
  if (!workbookId) throw new Error('MS Excel: workbookId is required');
  const res = await apiRequest({
    service: 'MS Excel',
    method: 'GET',
    url: `${API}/me/drive/items/${encodeURIComponent(workbookId)}/workbook/worksheets`,
    headers: headers(ctx),
  });
  return { outputs: { worksheets: res.data }, logs: [`MS Excel worksheets → ${workbookId}`] };
}

async function rangeGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workbookId = asString(ctx.options.workbookId);
  const worksheetId = asString(ctx.options.worksheetId);
  const range = asString(ctx.options.range);
  if (!workbookId || !worksheetId || !range)
    throw new Error('MS Excel: workbookId, worksheetId and range are required');
  const res = await apiRequest({
    service: 'MS Excel',
    method: 'GET',
    url: `${API}/me/drive/items/${encodeURIComponent(workbookId)}/workbook/worksheets/${encodeURIComponent(worksheetId)}/range(address='${encodeURIComponent(range)}')`,
    headers: headers(ctx),
  });
  return { outputs: { range: res.data }, logs: [`MS Excel range → ${range}`] };
}

async function rowAppend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workbookId = asString(ctx.options.workbookId);
  const worksheetId = asString(ctx.options.worksheetId);
  const tableName = asString(ctx.options.tableName);
  const valuesRaw = asString(ctx.options.values);
  if (!workbookId || !worksheetId || !tableName || !valuesRaw)
    throw new Error('MS Excel: workbookId, worksheetId, tableName and values are required');
  let values: unknown;
  try {
    values = JSON.parse(valuesRaw);
  } catch {
    throw new Error('MS Excel: values must be valid JSON (e.g. [["a","b"]])');
  }
  const res = await apiRequest({
    service: 'MS Excel',
    method: 'POST',
    url: `${API}/me/drive/items/${encodeURIComponent(workbookId)}/workbook/worksheets/${encodeURIComponent(worksheetId)}/tables/${encodeURIComponent(tableName)}/rows/add`,
    headers: headers(ctx),
    json: { values },
  });
  return { outputs: { row: res.data }, logs: [`MS Excel row append → ${tableName}`] };
}

const block: ForgeBlock = {
  id: 'forge_ms_excel_v1',
  name: 'Microsoft Excel V1',
  description: 'List worksheets, read ranges, append rows in Excel workbooks.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'worksheets_list',
      label: 'List worksheets',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'workbookId', label: 'Workbook drive item ID', type: 'text', required: true },
      ],
      run: worksheetsList,
    },
    {
      id: 'range_get',
      label: 'Get range',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'workbookId', label: 'Workbook drive item ID', type: 'text', required: true },
        { id: 'worksheetId', label: 'Worksheet ID/name', type: 'text', required: true },
        { id: 'range', label: 'Range (A1 notation)', type: 'text', required: true, placeholder: 'A1:B10' },
      ],
      run: rangeGet,
    },
    {
      id: 'row_append',
      label: 'Append table row',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'workbookId', label: 'Workbook drive item ID', type: 'text', required: true },
        { id: 'worksheetId', label: 'Worksheet ID/name', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'values', label: 'Values (JSON 2D array)', type: 'json', required: true },
      ],
      run: rowAppend,
    },
  ],
};

registerForgeBlock(block);
export default block;
