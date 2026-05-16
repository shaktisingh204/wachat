/**
 * Forge block: Xata Chat Memory
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/memory/MemoryXata
 *
 * Uses the Xata REST API. Records look like:
 *   { sessionId, role, content, at }
 * Insert via `POST /db/{database}:{branch}/tables/{table}/data`
 * Query via `POST /db/.../tables/{table}/query`
 * Delete via filtered query then `POST /transaction` or per-id DELETE.
 *
 * Inline credentials — `auth: { type: 'none' }`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

function endpoint(ctx: ForgeActionContext): {
  baseUrl: string;
  table: string;
  headers: Record<string, string>;
} {
  const databaseUrl = asString(ctx.options.databaseUrl).replace(/\/$/, '');
  if (!databaseUrl) throw new Error('Xata: databaseUrl is required');
  const branch = asString(ctx.options.branch) || 'main';
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Xata: apiKey is required');
  const table = asString(ctx.options.table) || 'chat_history';
  return {
    baseUrl: `${databaseUrl}:${branch}`,
    table,
    headers: { Authorization: `Bearer ${apiKey}` },
  };
}

function sessionId(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('Xata: sessionId is required');
  return s;
}

async function saveMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, table, headers } = endpoint(ctx);
  const role = asString(ctx.options.role) || 'user';
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Xata: content is required');
  const id = sessionId(ctx);
  await apiRequest({
    service: 'Xata',
    method: 'POST',
    url: `${baseUrl}/tables/${encodeURIComponent(table)}/data`,
    headers,
    json: { sessionId: id, role, content, at: new Date().toISOString() },
  });
  return { outputs: { ok: true }, logs: [`Xata save → ${id} (${role})`] };
}

async function loadSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, table, headers } = endpoint(ctx);
  const id = sessionId(ctx);
  const limit = asNumber(ctx.options.limit) ?? 100;
  const res = await apiRequest({
    service: 'Xata',
    method: 'POST',
    url: `${baseUrl}/tables/${encodeURIComponent(table)}/query`,
    headers,
    json: {
      filter: { sessionId: id },
      sort: { at: 'asc' },
      page: { size: limit },
    },
  });
  const data = res.data as { records?: Array<Record<string, unknown>> };
  const records = Array.isArray(data?.records) ? data.records : [];
  const messages = records.map((r) => ({
    role: String(r.role ?? 'user'),
    content: String(r.content ?? ''),
    at: String(r.at ?? ''),
  }));
  return { outputs: { messages }, logs: [`Xata load → ${messages.length}`] };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, table, headers } = endpoint(ctx);
  const id = sessionId(ctx);
  const queryRes = await apiRequest({
    service: 'Xata',
    method: 'POST',
    url: `${baseUrl}/tables/${encodeURIComponent(table)}/query`,
    headers,
    json: { filter: { sessionId: id }, columns: ['id'], page: { size: 1000 } },
  });
  const data = queryRes.data as { records?: Array<{ id?: string }> };
  const records = Array.isArray(data?.records) ? data.records : [];
  for (const r of records) {
    if (!r.id) continue;
    await apiRequest({
      service: 'Xata',
      method: 'DELETE',
      url: `${baseUrl}/tables/${encodeURIComponent(table)}/data/${encodeURIComponent(r.id)}`,
      headers,
    });
  }
  return { outputs: { cleared: records.length }, logs: [`Xata clear → ${records.length}`] };
}

const inlineCreds = [
  { id: 'databaseUrl', label: 'Database URL', type: 'text' as const, required: true, placeholder: 'https://<workspace>.<region>.xata.sh/db/<db>' },
  { id: 'branch', label: 'Branch', type: 'text' as const, placeholder: 'main' },
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
  { id: 'table', label: 'Table', type: 'text' as const, placeholder: 'chat_history' },
];

const block: ForgeBlock = {
  id: 'forge_mem_xata',
  name: 'Xata Chat Memory',
  description: 'Persist chat sessions in a Xata table.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'save_message',
      label: 'Save message',
      description: 'Insert a record into the chat table.',
      fields: [
        ...inlineCreds,
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'role', label: 'Role', type: 'text', defaultValue: 'user' },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
      ],
      run: saveMessage,
    },
    {
      id: 'load_session',
      label: 'Load session',
      description: 'Query records for the session ordered by time.',
      fields: [
        ...inlineCreds,
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 100 },
      ],
      run: loadSession,
    },
    {
      id: 'clear_session',
      label: 'Clear session',
      description: 'Delete all records for the session.',
      fields: [
        ...inlineCreds,
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
      ],
      run: clearSession,
    },
  ],
};

registerForgeBlock(block);
export default block;
