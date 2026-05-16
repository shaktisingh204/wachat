/**
 * Forge block: Cockpit CMS
 *
 * Source: n8n-master/packages/nodes-base/nodes/Cockpit/Cockpit.node.ts
 *
 * Self-hosted Cockpit CMS. Auth is an API token sent as a `Cockpit-Token`
 * header (also accepted as `?token=...` — we use the header).
 *
 * Operations covered:
 *   - collection.entries       POST /api/collections/get/{collection}
 *   - collection.entry.save    POST /api/collections/save/{collection}
 *   - collection.entry.remove  POST /api/collections/remove/{collection}
 *   - form.submit              POST /api/forms/submit/{form}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const url = asString(ctx.options.baseUrl).trim();
  if (!url) throw new Error('Cockpit: baseUrl is required');
  return url.replace(/\/$/, '');
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.apiToken);
  if (!token) throw new Error('Cockpit: apiToken is required');
  return { 'Cockpit-Token': token };
}

function parseJsonOption(v: unknown, field: string): Record<string, unknown> {
  if (v == null || v === '') return {};
  if (typeof v === 'object') return v as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(v));
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`Cockpit: ${field} must be valid JSON`);
  }
  throw new Error(`Cockpit: ${field} must be a JSON object`);
}

async function collectionEntries(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const collection = asString(ctx.options.collection);
  if (!collection) throw new Error('Cockpit: collection is required');
  const body: Record<string, unknown> = {};
  const filter = ctx.options.filter;
  if (filter != null && filter !== '') body.filter = parseJsonOption(filter, 'filter');
  const sort = ctx.options.sort;
  if (sort != null && sort !== '') body.sort = parseJsonOption(sort, 'sort');
  const limit = asString(ctx.options.limit).trim();
  const skip = asString(ctx.options.skip).trim();
  if (limit) body.limit = Number(limit);
  if (skip) body.skip = Number(skip);
  const res = await apiRequest({
    service: 'Cockpit',
    method: 'POST',
    url: `${baseUrl(ctx)}/api/collections/get/${encodeURIComponent(collection)}`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { entries: res.data }, logs: [`Cockpit entries → ${collection}`] };
}

async function collectionEntrySave(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const collection = asString(ctx.options.collection);
  if (!collection) throw new Error('Cockpit: collection is required');
  const data = parseJsonOption(ctx.options.data, 'data');
  const res = await apiRequest({
    service: 'Cockpit',
    method: 'POST',
    url: `${baseUrl(ctx)}/api/collections/save/${encodeURIComponent(collection)}`,
    headers: authHeader(ctx),
    json: { data },
  });
  return { outputs: { entry: res.data }, logs: [`Cockpit entry save → ${collection}`] };
}

async function collectionEntryRemove(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const collection = asString(ctx.options.collection);
  if (!collection) throw new Error('Cockpit: collection is required');
  const filter = parseJsonOption(ctx.options.filter, 'filter');
  const res = await apiRequest({
    service: 'Cockpit',
    method: 'POST',
    url: `${baseUrl(ctx)}/api/collections/remove/${encodeURIComponent(collection)}`,
    headers: authHeader(ctx),
    json: { filter },
  });
  return { outputs: { result: res.data }, logs: [`Cockpit entry remove → ${collection}`] };
}

async function formSubmit(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const form = asString(ctx.options.form);
  if (!form) throw new Error('Cockpit: form is required');
  const formData = parseJsonOption(ctx.options.formData, 'formData');
  const res = await apiRequest({
    service: 'Cockpit',
    method: 'POST',
    url: `${baseUrl(ctx)}/api/forms/submit/${encodeURIComponent(form)}`,
    headers: authHeader(ctx),
    json: { form: formData },
  });
  return { outputs: { result: res.data }, logs: [`Cockpit form submit → ${form}`] };
}

const CRED_FIELDS = [
  {
    id: 'baseUrl',
    label: 'Base URL',
    type: 'text' as const,
    required: true,
    placeholder: 'https://cockpit.example.com',
  },
  { id: 'apiToken', label: 'API token', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_cockpit',
  name: 'Cockpit',
  description: 'Read and write Cockpit CMS collection entries and form submissions.',
  iconName: 'LuLayoutGrid',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'collection_entries',
      label: 'List collection entries',
      description: 'Fetch entries from a collection with optional filter/sort/limit.',
      fields: [
        ...CRED_FIELDS,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'filter', label: 'Filter', type: 'json', placeholder: '{"published": true}' },
        { id: 'sort', label: 'Sort', type: 'json', placeholder: '{"_created": -1}' },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'skip', label: 'Skip', type: 'number' },
      ],
      run: collectionEntries,
    },
    {
      id: 'collection_entry_save',
      label: 'Save entry',
      description: 'Create or update an entry in a collection.',
      fields: [
        ...CRED_FIELDS,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        {
          id: 'data',
          label: 'Entry data',
          type: 'json',
          required: true,
          placeholder: '{"title": "Hello", "body": "World"}',
          helperText: 'Include `_id` to update an existing entry.',
        },
      ],
      run: collectionEntrySave,
    },
    {
      id: 'collection_entry_remove',
      label: 'Remove entry',
      description: 'Delete entries matching the filter.',
      fields: [
        ...CRED_FIELDS,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        {
          id: 'filter',
          label: 'Filter',
          type: 'json',
          required: true,
          placeholder: '{"_id": "..."}',
        },
      ],
      run: collectionEntryRemove,
    },
    {
      id: 'form_submit',
      label: 'Submit form',
      description: 'Submit a Cockpit form.',
      fields: [
        ...CRED_FIELDS,
        { id: 'form', label: 'Form', type: 'text', required: true },
        { id: 'formData', label: 'Form data', type: 'json', required: true },
      ],
      run: formSubmit,
    },
  ],
};

registerForgeBlock(block);
export default block;
