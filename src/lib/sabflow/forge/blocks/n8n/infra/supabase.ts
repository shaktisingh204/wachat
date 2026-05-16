/**
 * Forge block: Supabase
 *
 * Source: n8n-master/packages/nodes-base/nodes/Supabase/Supabase.node.ts
 *
 * Pure REST against the PostgREST endpoint at `<projectUrl>/rest/v1/`. The
 * service-role key is passed both in the `apikey` header and as a Bearer
 * token (PostgREST accepts either; sending both bypasses RLS for anon-only
 * deployments while still scoping correctly).
 *
 * Operations covered:
 *   - select        SELECT rows with optional filter/limit/columns
 *   - insert        INSERT one row (returning the inserted row)
 *   - update        UPDATE rows matching a PostgREST filter
 *   - delete        DELETE rows matching a PostgREST filter
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

function readBase(ctx: ForgeActionContext): { url: string; key: string } {
  const projectUrl = asString(ctx.options.projectUrl).replace(/\/$/, '');
  if (!projectUrl) throw new Error('Supabase: projectUrl is required');
  const key = asString(ctx.options.serviceRoleKey);
  if (!key) throw new Error('Supabase: serviceRoleKey is required');
  return { url: `${projectUrl}/rest/v1`, key };
}

function authHeaders(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

function buildQuery(ctx: ForgeActionContext): URLSearchParams {
  const params = new URLSearchParams();
  const filter = asString(ctx.options.filter).trim();
  if (filter) {
    // filter is one or more "column=op.value" lines/commas
    const parts = filter.split(/[\n,]/).map((p) => p.trim()).filter(Boolean);
    for (const p of parts) {
      const idx = p.indexOf('=');
      if (idx === -1) throw new Error(`Supabase: invalid filter "${p}" — expected col=op.value`);
      params.append(p.slice(0, idx), p.slice(idx + 1));
    }
  }
  const columns = asString(ctx.options.columns);
  if (columns) params.set('select', columns);
  const order = asString(ctx.options.order);
  if (order) params.set('order', order);
  const limit = asNumber(ctx.options.limit);
  if (limit !== undefined) params.set('limit', String(limit));
  return params;
}

async function selectRows(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, key } = readBase(ctx);
  const table = asString(ctx.options.table);
  if (!table) throw new Error('Supabase: table is required');
  const qs = buildQuery(ctx);
  const qsStr = qs.toString();
  const res = await apiRequest({
    service: 'Supabase',
    method: 'GET',
    url: `${url}/${encodeURIComponent(table)}${qsStr ? `?${qsStr}` : ''}`,
    headers: authHeaders(key),
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  return { outputs: { rows, count: rows.length }, logs: [`Supabase select → ${rows.length} rows from ${table}`] };
}

async function insertRow(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, key } = readBase(ctx);
  const table = asString(ctx.options.table);
  if (!table) throw new Error('Supabase: table is required');
  const body = asString(ctx.options.body);
  if (!body) throw new Error('Supabase: body is required');
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch (err) {
    throw new Error(`Supabase: body is not valid JSON — ${(err as Error).message}`);
  }
  const res = await apiRequest({
    service: 'Supabase',
    method: 'POST',
    url: `${url}/${encodeURIComponent(table)}`,
    headers: authHeaders(key, { Prefer: 'return=representation' }),
    json: payload,
  });
  const rows = Array.isArray(res.data) ? res.data : [res.data];
  return { outputs: { rows, count: rows.length }, logs: [`Supabase insert → ${rows.length} row(s) into ${table}`] };
}

async function updateRows(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, key } = readBase(ctx);
  const table = asString(ctx.options.table);
  if (!table) throw new Error('Supabase: table is required');
  const body = asString(ctx.options.body);
  if (!body) throw new Error('Supabase: body is required');
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch (err) {
    throw new Error(`Supabase: body is not valid JSON — ${(err as Error).message}`);
  }
  const qs = buildQuery(ctx);
  if (!qs.toString()) {
    throw new Error('Supabase: filter is required for update (refusing to update all rows)');
  }
  const res = await apiRequest({
    service: 'Supabase',
    method: 'PATCH',
    url: `${url}/${encodeURIComponent(table)}?${qs.toString()}`,
    headers: authHeaders(key, { Prefer: 'return=representation' }),
    json: payload,
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  return { outputs: { rows, count: rows.length }, logs: [`Supabase update → ${rows.length} row(s) in ${table}`] };
}

async function deleteRows(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, key } = readBase(ctx);
  const table = asString(ctx.options.table);
  if (!table) throw new Error('Supabase: table is required');
  const qs = buildQuery(ctx);
  if (!qs.toString()) {
    throw new Error('Supabase: filter is required for delete (refusing to delete all rows)');
  }
  const res = await apiRequest({
    service: 'Supabase',
    method: 'DELETE',
    url: `${url}/${encodeURIComponent(table)}?${qs.toString()}`,
    headers: authHeaders(key, { Prefer: 'return=representation' }),
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  return { outputs: { rows, count: rows.length }, logs: [`Supabase delete → ${rows.length} row(s) from ${table}`] };
}

const CRED_FIELDS = [
  { id: 'projectUrl', label: 'Project URL', type: 'text' as const, required: true, placeholder: 'https://xyz.supabase.co' },
  { id: 'serviceRoleKey', label: 'Service role key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_supabase',
  name: 'Supabase',
  description: 'Read and write Supabase tables via PostgREST.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'select_from_table',
      label: 'Select rows',
      description: 'GET /rest/v1/<table> with optional filter / columns / order / limit.',
      fields: [
        ...CRED_FIELDS,
        { id: 'table', label: 'Table', type: 'text', required: true },
        { id: 'columns', label: 'Columns (PostgREST select)', type: 'text', placeholder: '*' },
        {
          id: 'filter',
          label: 'Filter (one per line, col=op.value)',
          type: 'textarea',
          placeholder: 'id=eq.42\nstatus=in.(open,pending)',
        },
        { id: 'order', label: 'Order', type: 'text', placeholder: 'created_at.desc' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: selectRows,
    },
    {
      id: 'insert_row',
      label: 'Insert row',
      description: 'POST /rest/v1/<table> with a JSON body (object or array).',
      fields: [
        ...CRED_FIELDS,
        { id: 'table', label: 'Table', type: 'text', required: true },
        { id: 'body', label: 'Row JSON', type: 'json', required: true, placeholder: '{"name": "Ada"}' },
      ],
      run: insertRow,
    },
    {
      id: 'update_rows',
      label: 'Update rows',
      description: 'PATCH /rest/v1/<table>?filter=… (filter required).',
      fields: [
        ...CRED_FIELDS,
        { id: 'table', label: 'Table', type: 'text', required: true },
        {
          id: 'filter',
          label: 'Filter (col=op.value)',
          type: 'textarea',
          required: true,
          placeholder: 'id=eq.42',
        },
        { id: 'body', label: 'Patch JSON', type: 'json', required: true, placeholder: '{"name": "Grace"}' },
      ],
      run: updateRows,
    },
    {
      id: 'delete_rows',
      label: 'Delete rows',
      description: 'DELETE /rest/v1/<table>?filter=… (filter required).',
      fields: [
        ...CRED_FIELDS,
        { id: 'table', label: 'Table', type: 'text', required: true },
        {
          id: 'filter',
          label: 'Filter (col=op.value)',
          type: 'textarea',
          required: true,
          placeholder: 'id=eq.42',
        },
      ],
      run: deleteRows,
    },
  ],
};

registerForgeBlock(block);
export default block;
