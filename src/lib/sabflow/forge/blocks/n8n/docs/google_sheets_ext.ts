/**
 * Forge block: Google Sheets (extended)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Sheet/GoogleSheets.node.ts
 *   (v2 implementation under /Sheet/v2)
 * Credential type: 'google_sheets' — fields: { clientId, clientSecret, refreshToken }
 *   Auth: exchange refresh token for access token at
 *   https://oauth2.googleapis.com/token; cached for the call lifetime only.
 *
 * Operations covered:
 *   - spreadsheet.create        POST   /v4/spreadsheets
 *   - spreadsheet.get           GET    /v4/spreadsheets/{id}
 *   - spreadsheet.values_get    GET    /v4/spreadsheets/{id}/values/{range}
 *   - spreadsheet.values_append POST   /v4/spreadsheets/{id}/values/{range}:append
 *   - spreadsheet.values_update PUT    /v4/spreadsheets/{id}/values/{range}
 *   - spreadsheet.values_clear  POST   /v4/spreadsheets/{id}/values/{range}:clear
 *   - spreadsheet.values_batch_get   GET  /v4/spreadsheets/{id}/values:batchGet?ranges=…
 *   - spreadsheet.values_batch_update POST /v4/spreadsheets/{id}/values:batchUpdate
 *   - sheet.add                 POST   /v4/spreadsheets/{id}:batchUpdate (addSheet)
 *   - sheet.delete              POST   /v4/spreadsheets/{id}:batchUpdate (deleteSheet)
 *   - sheet.copy_to             POST   /v4/spreadsheets/{id}/sheets/{sheetId}:copyTo
 *
 * Out of scope:
 *   - LoadOptions for spreadsheet / sheet titles
 *   - Persistent access-token caching across runs
 *   - Spreadsheet delete (Sheets API has no delete; n8n uses Drive API for that)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import {
  cacheKeyFor,
  getCachedToken,
  refreshAccessToken,
  setCachedToken,
} from '../_shared/oauth';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4';

async function getAccessToken(ctx: ForgeActionContext): Promise<string> {
  const cred = requireCredential('Google Sheets', ctx.credential);
  const clientId = cred.clientId;
  const clientSecret = cred.clientSecret;
  const refreshToken = cred.refreshToken;
  if (!clientId) throw new Error('Google Sheets: credential is missing `clientId`');
  if (!clientSecret) throw new Error('Google Sheets: credential is missing `clientSecret`');
  if (!refreshToken) throw new Error('Google Sheets: credential is missing `refreshToken`');

  const key = cacheKeyFor('google_sheets', refreshToken);
  const cached = getCachedToken(key);
  if (cached) return cached;

  const { accessToken, expiresIn } = await refreshAccessToken({
    service: 'Google Sheets',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    refreshToken,
    clientId,
    clientSecret,
  });
  setCachedToken(key, accessToken, expiresIn);
  return accessToken;
}

async function sheetsApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const accessToken = await getAccessToken(ctx);
  const res = await apiRequest({
    service: 'Google Sheets',
    method,
    url: `${SHEETS_BASE}${path}`,
    headers: { Authorization: `Bearer ${accessToken}` },
    json,
  });
  return res.data;
}

function parseJsonArray(label: string, raw: unknown): unknown[][] {
  const s = asString(raw).trim();
  if (!s) throw new Error(`Google Sheets: ${label} is required`);
  let v: unknown;
  try {
    v = JSON.parse(s);
  } catch {
    throw new Error(`Google Sheets: ${label} must be valid JSON`);
  }
  if (!Array.isArray(v)) throw new Error(`Google Sheets: ${label} must be a JSON array of rows`);
  return v.map((row) => (Array.isArray(row) ? row : [row]));
}

// ── Spreadsheet values ─────────────────────────────────────────────────────

async function valuesGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spreadsheetId = asString(ctx.options.spreadsheetId);
  const range = asString(ctx.options.range);
  if (!spreadsheetId) throw new Error('Google Sheets: spreadsheetId is required');
  if (!range) throw new Error('Google Sheets: range is required');
  const data = await sheetsApi(
    ctx,
    'GET',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
  );
  return { outputs: { result: data }, logs: [`Sheets values get → ${range}`] };
}

async function valuesAppend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spreadsheetId = asString(ctx.options.spreadsheetId);
  const range = asString(ctx.options.range);
  if (!spreadsheetId) throw new Error('Google Sheets: spreadsheetId is required');
  if (!range) throw new Error('Google Sheets: range is required');
  const values = parseJsonArray('values', ctx.options.values);
  const valueInputOption = asString(ctx.options.valueInputOption) || 'USER_ENTERED';

  const data = await sheetsApi(
    ctx,
    'POST',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}`,
    { values },
  );
  return { outputs: { result: data }, logs: [`Sheets values append → ${range}`] };
}

async function valuesUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spreadsheetId = asString(ctx.options.spreadsheetId);
  const range = asString(ctx.options.range);
  if (!spreadsheetId) throw new Error('Google Sheets: spreadsheetId is required');
  if (!range) throw new Error('Google Sheets: range is required');
  const values = parseJsonArray('values', ctx.options.values);
  const valueInputOption = asString(ctx.options.valueInputOption) || 'USER_ENTERED';

  const data = await sheetsApi(
    ctx,
    'PUT',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`,
    { values },
  );
  return { outputs: { result: data }, logs: [`Sheets values update → ${range}`] };
}

async function valuesClear(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spreadsheetId = asString(ctx.options.spreadsheetId);
  const range = asString(ctx.options.range);
  if (!spreadsheetId) throw new Error('Google Sheets: spreadsheetId is required');
  if (!range) throw new Error('Google Sheets: range is required');
  const data = await sheetsApi(
    ctx,
    'POST',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`,
    {},
  );
  return { outputs: { result: data }, logs: [`Sheets values clear → ${range}`] };
}

// ── Spreadsheet (workbook level) ──────────────────────────────────────────

async function spreadsheetCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  if (!title) throw new Error('Google Sheets: title is required');
  const sheetTitles = asString(ctx.options.sheets)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const body: Record<string, unknown> = {
    properties: { title },
  };
  if (sheetTitles.length > 0) {
    body.sheets = sheetTitles.map((t) => ({ properties: { title: t } }));
  }
  const data = await sheetsApi(ctx, 'POST', '/spreadsheets', body);
  return { outputs: { spreadsheet: data }, logs: [`Sheets spreadsheet create → ${title}`] };
}

async function spreadsheetGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spreadsheetId = asString(ctx.options.spreadsheetId);
  if (!spreadsheetId) throw new Error('Google Sheets: spreadsheetId is required');
  const includeGridData = asString(ctx.options.includeGridData) === 'true';
  const data = await sheetsApi(
    ctx,
    'GET',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}?includeGridData=${includeGridData}`,
  );
  return { outputs: { spreadsheet: data }, logs: [`Sheets spreadsheet get → ${spreadsheetId}`] };
}

async function valuesBatchGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spreadsheetId = asString(ctx.options.spreadsheetId);
  if (!spreadsheetId) throw new Error('Google Sheets: spreadsheetId is required');
  const ranges = asString(ctx.options.ranges)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (ranges.length === 0) throw new Error('Google Sheets: at least one range is required');
  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const data = await sheetsApi(
    ctx,
    'GET',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${qs}`,
  );
  return { outputs: { result: data }, logs: [`Sheets values batch get → ${ranges.length} ranges`] };
}

async function valuesBatchUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spreadsheetId = asString(ctx.options.spreadsheetId);
  if (!spreadsheetId) throw new Error('Google Sheets: spreadsheetId is required');
  const dataRaw = asString(ctx.options.data).trim();
  if (!dataRaw) throw new Error('Google Sheets: data is required');
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataRaw);
  } catch {
    throw new Error('Google Sheets: data must be valid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Google Sheets: data must be a JSON array of {range, values} objects');
  }
  const valueInputOption = asString(ctx.options.valueInputOption) || 'USER_ENTERED';
  const data = await sheetsApi(
    ctx,
    'POST',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    { valueInputOption, data: parsed },
  );
  return { outputs: { result: data }, logs: [`Sheets values batch update → ${(parsed as unknown[]).length}`] };
}

// ── Sheet (tab) ────────────────────────────────────────────────────────────

async function sheetAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spreadsheetId = asString(ctx.options.spreadsheetId);
  const title = asString(ctx.options.title);
  if (!spreadsheetId) throw new Error('Google Sheets: spreadsheetId is required');
  if (!title) throw new Error('Google Sheets: title is required');

  const body = {
    requests: [
      {
        addSheet: {
          properties: { title },
        },
      },
    ],
  };
  const data = await sheetsApi(
    ctx,
    'POST',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    body,
  );
  return { outputs: { result: data }, logs: [`Sheets sheet add → ${title}`] };
}

async function sheetDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spreadsheetId = asString(ctx.options.spreadsheetId);
  const sheetId = asNumber(ctx.options.sheetId);
  if (!spreadsheetId) throw new Error('Google Sheets: spreadsheetId is required');
  if (sheetId === undefined) throw new Error('Google Sheets: sheetId (numeric) is required');

  const body = { requests: [{ deleteSheet: { sheetId } }] };
  const data = await sheetsApi(
    ctx,
    'POST',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    body,
  );
  return { outputs: { result: data, sheetId }, logs: [`Sheets sheet delete → ${sheetId}`] };
}

async function sheetCopyTo(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spreadsheetId = asString(ctx.options.spreadsheetId);
  const sheetId = asNumber(ctx.options.sheetId);
  const destinationSpreadsheetId = asString(ctx.options.destinationSpreadsheetId);
  if (!spreadsheetId) throw new Error('Google Sheets: spreadsheetId is required');
  if (sheetId === undefined) throw new Error('Google Sheets: sheetId (numeric) is required');
  if (!destinationSpreadsheetId) throw new Error('Google Sheets: destinationSpreadsheetId is required');

  const data = await sheetsApi(
    ctx,
    'POST',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/sheets/${sheetId}:copyTo`,
    { destinationSpreadsheetId },
  );
  return { outputs: { result: data }, logs: [`Sheets sheet copy_to → ${destinationSpreadsheetId}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_google_sheets_ext',
  name: 'Google Sheets (extended)',
  description: 'Read, append, update, clear values and add new tabs in Google Sheets.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'google_sheets' },
  actions: [
    {
      id: 'values_get',
      label: 'Get values',
      description: 'Read a range from a spreadsheet.',
      fields: [
        { id: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', required: true },
        { id: 'range', label: 'Range (A1)', type: 'text', required: true, placeholder: 'Sheet1!A1:C10' },
      ],
      run: valuesGet,
    },
    {
      id: 'values_append',
      label: 'Append values',
      description: 'Append rows. Values is a JSON 2-D array, e.g. `[["a","b"]]`.',
      fields: [
        { id: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', required: true },
        { id: 'range', label: 'Range (A1)', type: 'text', required: true, placeholder: 'Sheet1!A:B' },
        { id: 'values', label: 'Values (JSON 2-D array)', type: 'json', required: true },
        {
          id: 'valueInputOption',
          label: 'Value input option',
          type: 'select',
          options: [
            { label: 'USER_ENTERED', value: 'USER_ENTERED' },
            { label: 'RAW', value: 'RAW' },
          ],
          defaultValue: 'USER_ENTERED',
        },
      ],
      run: valuesAppend,
    },
    {
      id: 'values_update',
      label: 'Update values',
      description: 'Overwrite a range with the given 2-D array.',
      fields: [
        { id: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', required: true },
        { id: 'range', label: 'Range (A1)', type: 'text', required: true },
        { id: 'values', label: 'Values (JSON 2-D array)', type: 'json', required: true },
        {
          id: 'valueInputOption',
          label: 'Value input option',
          type: 'select',
          options: [
            { label: 'USER_ENTERED', value: 'USER_ENTERED' },
            { label: 'RAW', value: 'RAW' },
          ],
          defaultValue: 'USER_ENTERED',
        },
      ],
      run: valuesUpdate,
    },
    {
      id: 'values_clear',
      label: 'Clear values',
      description: 'Clear all values in a range.',
      fields: [
        { id: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', required: true },
        { id: 'range', label: 'Range (A1)', type: 'text', required: true },
      ],
      run: valuesClear,
    },
    {
      id: 'sheet_add',
      label: 'Add sheet (tab)',
      description: 'Create a new sheet/tab inside an existing spreadsheet.',
      fields: [
        { id: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', required: true },
        { id: 'title', label: 'Sheet title', type: 'text', required: true },
      ],
      run: sheetAdd,
    },
    {
      id: 'sheet_delete',
      label: 'Delete sheet (tab)',
      description: 'Delete a sheet/tab from an existing spreadsheet (by numeric sheetId).',
      fields: [
        { id: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', required: true },
        { id: 'sheetId', label: 'Sheet ID (numeric tab id)', type: 'number', required: true },
      ],
      run: sheetDelete,
    },
    {
      id: 'sheet_copy_to',
      label: 'Copy sheet to another spreadsheet',
      description: 'Copy a single sheet from one spreadsheet into another.',
      fields: [
        { id: 'spreadsheetId', label: 'Source spreadsheet ID', type: 'text', required: true },
        { id: 'sheetId', label: 'Source sheet ID (numeric)', type: 'number', required: true },
        { id: 'destinationSpreadsheetId', label: 'Destination spreadsheet ID', type: 'text', required: true },
      ],
      run: sheetCopyTo,
    },
    {
      id: 'spreadsheet_create',
      label: 'Create spreadsheet',
      description: 'Create a brand-new spreadsheet, optionally with a comma-separated initial sheet list.',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'sheets', label: 'Initial sheet titles (comma list)', type: 'text', placeholder: 'Sheet1,Sheet2' },
      ],
      run: spreadsheetCreate,
    },
    {
      id: 'spreadsheet_get',
      label: 'Get spreadsheet',
      description: 'Fetch a spreadsheet (metadata; pass includeGridData=true to also pull cell data).',
      fields: [
        { id: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', required: true },
        { id: 'includeGridData', label: 'Include grid data (true/false)', type: 'text', defaultValue: 'false' },
      ],
      run: spreadsheetGet,
    },
    {
      id: 'values_batch_get',
      label: 'Batch get values',
      description: 'Read multiple ranges in one request. Ranges is a comma-separated list of A1 ranges.',
      fields: [
        { id: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', required: true },
        { id: 'ranges', label: 'Ranges (comma-separated A1)', type: 'text', required: true,
          placeholder: 'Sheet1!A1:C10,Sheet2!A:A' },
      ],
      run: valuesBatchGet,
    },
    {
      id: 'values_batch_update',
      label: 'Batch update values',
      description: 'Update multiple ranges in one request. data is a JSON array of { range, values } objects.',
      fields: [
        { id: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', required: true },
        { id: 'data', label: 'Data (JSON array of {range, values})', type: 'json', required: true },
        {
          id: 'valueInputOption',
          label: 'Value input option',
          type: 'select',
          options: [
            { label: 'USER_ENTERED', value: 'USER_ENTERED' },
            { label: 'RAW', value: 'RAW' },
          ],
          defaultValue: 'USER_ENTERED',
        },
      ],
      run: valuesBatchUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
