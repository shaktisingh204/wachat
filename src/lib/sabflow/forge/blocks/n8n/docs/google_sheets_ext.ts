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
 *   - spreadsheet.valuesGet     GET    /v4/spreadsheets/{id}/values/{range}
 *   - spreadsheet.valuesAppend  POST   /v4/spreadsheets/{id}/values/{range}:append
 *   - spreadsheet.valuesUpdate  PUT    /v4/spreadsheets/{id}/values/{range}
 *   - spreadsheet.valuesClear   POST   /v4/spreadsheets/{id}/values/{range}:clear
 *   - sheet.add                 POST   /v4/spreadsheets/{id}:batchUpdate (addSheet)
 *
 * Out of scope:
 *   - LoadOptions for spreadsheet / sheet titles
 *   - Persistent access-token caching across runs
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';
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
  ],
};

registerForgeBlock(block);
export default block;
