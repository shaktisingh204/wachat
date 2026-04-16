/**
 * Forge block: Airtable.
 *
 * Auth: Personal access token (Bearer).
 * Actions: Create record, Update record, List records.
 */

import { registerForgeBlock } from '../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../types';

const AIRTABLE_API = 'https://api.airtable.com/v0';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

const buildHeaders = (ctx: ForgeActionContext): Record<string, string> => {
  const token = ctx.credential?.apiKey ?? str(ctx.options.apiKey);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const parseJsonFields = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string' || raw.trim() === '') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
};

const baseUrl = (baseId: string, table: string): string =>
  `${AIRTABLE_API}/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`;

async function createRecord(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const baseId = str(ctx.options.baseId);
  const tableName = str(ctx.options.tableName);
  const fields = parseJsonFields(ctx.options.fields);
  const outputVariable = str(ctx.options.outputVariable);

  const res = await fetch(baseUrl(baseId, tableName), {
    method: 'POST',
    headers: buildHeaders(ctx),
    body: JSON.stringify({ fields }),
  });
  const data: unknown = await res.json();
  if (!res.ok) throw new Error(`Airtable create record failed: ${res.status}`);

  const outputs: Record<string, unknown> = {};
  if (outputVariable) outputs[outputVariable] = data;
  return { outputs, logs: [`Airtable: created record in ${baseId}/${tableName}`] };
}

async function updateRecord(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const baseId = str(ctx.options.baseId);
  const tableName = str(ctx.options.tableName);
  const recordId = str(ctx.options.recordId);
  const fields = parseJsonFields(ctx.options.fields);

  const res = await fetch(`${baseUrl(baseId, tableName)}/${encodeURIComponent(recordId)}`, {
    method: 'PATCH',
    headers: buildHeaders(ctx),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable update record failed: ${res.status}`);

  return { logs: [`Airtable: updated ${recordId} in ${baseId}/${tableName}`] };
}

async function listRecords(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const baseId = str(ctx.options.baseId);
  const tableName = str(ctx.options.tableName);
  const maxRecords = str(ctx.options.maxRecords) || '100';
  const outputVariable = str(ctx.options.outputVariable);

  const url = new URL(baseUrl(baseId, tableName));
  url.searchParams.set('maxRecords', maxRecords);

  const res = await fetch(url.toString(), { headers: buildHeaders(ctx) });
  const data: unknown = await res.json();
  if (!res.ok) throw new Error(`Airtable list records failed: ${res.status}`);

  const outputs: Record<string, unknown> = {};
  if (outputVariable) outputs[outputVariable] = data;
  return { outputs, logs: [`Airtable: listed records from ${baseId}/${tableName}`] };
}

const block: ForgeBlock = {
  id: 'forge_airtable',
  name: 'Airtable',
  description: 'Create, update, and list records in an Airtable base.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    fields: [
      {
        id: 'apiKey',
        label: 'Personal Access Token',
        type: 'password',
        placeholder: 'patXXXXXXXXXXXXXX',
        required: true,
      },
    ],
  },
  actions: [
    {
      id: 'create_record',
      label: 'Create Record',
      description: 'Insert a new record into a table.',
      fields: [
        { id: 'baseId', label: 'Base ID', type: 'text', placeholder: 'appXXXXXXXXXXXXXX', required: true },
        { id: 'tableName', label: 'Table Name', type: 'text', placeholder: 'Contacts', required: true },
        {
          id: 'fields',
          label: 'Field Values (JSON)',
          type: 'json',
          placeholder: '{\n  "Name": "{{name}}",\n  "Email": "{{email}}"\n}',
          required: true,
        },
        { id: 'outputVariable', label: 'Save response to variable', type: 'variable' },
      ],
      run: createRecord,
    },
    {
      id: 'update_record',
      label: 'Update Record',
      description: 'Patch an existing record by id.',
      fields: [
        { id: 'baseId', label: 'Base ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table Name', type: 'text', required: true },
        { id: 'recordId', label: 'Record ID', type: 'text', placeholder: 'recXXXXXXXXXXXXXX', required: true },
        {
          id: 'fields',
          label: 'Field Values (JSON)',
          type: 'json',
          placeholder: '{ "Status": "Done" }',
          required: true,
        },
      ],
      run: updateRecord,
    },
    {
      id: 'list_records',
      label: 'List Records',
      description: 'Fetch records from a table.',
      fields: [
        { id: 'baseId', label: 'Base ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table Name', type: 'text', required: true },
        {
          id: 'maxRecords',
          label: 'Max Records',
          type: 'number',
          defaultValue: 100,
          helperText: 'Hard capped at 100 per Airtable page.',
        },
        { id: 'outputVariable', label: 'Save rows to variable', type: 'variable', required: true },
      ],
      run: listRecords,
    },
  ],
};

registerForgeBlock(block);

export default block;
