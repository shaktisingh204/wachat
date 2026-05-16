/**
 * Forge block: Zep Cloud Memory
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/memory/MemoryZep
 *
 * Uses Zep Cloud REST API:
 *   POST   /api/v2/sessions/{sessionId}/memory  → append messages
 *   GET    /api/v2/sessions/{sessionId}/memory  → retrieve messages
 *   DELETE /api/v2/sessions/{sessionId}/memory  → wipe session
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

function endpoint(ctx: ForgeActionContext): { baseUrl: string; headers: Record<string, string> } {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Zep: apiKey is required');
  const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.getzep.com').replace(/\/$/, '');
  return {
    baseUrl,
    headers: { Authorization: `Api-Key ${apiKey}` },
  };
}

function sessionId(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('Zep: sessionId is required');
  return s;
}

async function saveMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, headers } = endpoint(ctx);
  const role = asString(ctx.options.role) || 'user';
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Zep: content is required');
  const id = sessionId(ctx);
  await apiRequest({
    service: 'Zep',
    method: 'POST',
    url: `${baseUrl}/api/v2/sessions/${encodeURIComponent(id)}/memory`,
    headers,
    json: { messages: [{ role, role_type: role, content }] },
  });
  return { outputs: { ok: true }, logs: [`Zep save → ${id} (${role})`] };
}

async function loadSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, headers } = endpoint(ctx);
  const id = sessionId(ctx);
  const limit = asNumber(ctx.options.limit);
  const url = new URL(`${baseUrl}/api/v2/sessions/${encodeURIComponent(id)}/memory`);
  if (limit && limit > 0) url.searchParams.set('lastn', String(limit));
  const res = await apiRequest({
    service: 'Zep',
    method: 'GET',
    url: url.toString(),
    headers,
  });
  const data = res.data as { messages?: Array<{ role?: string; content?: string }> };
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  return { outputs: { messages }, logs: [`Zep load → ${messages.length}`] };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, headers } = endpoint(ctx);
  const id = sessionId(ctx);
  await apiRequest({
    service: 'Zep',
    method: 'DELETE',
    url: `${baseUrl}/api/v2/sessions/${encodeURIComponent(id)}/memory`,
    headers,
  });
  return { outputs: { cleared: true }, logs: [`Zep clear → ${id}`] };
}

const inlineCreds = [
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, placeholder: 'https://api.getzep.com' },
];

const block: ForgeBlock = {
  id: 'forge_mem_zep',
  name: 'Zep Cloud Memory',
  description: 'Persist chat sessions in Zep Cloud (memory + auto-summarisation).',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'save_message',
      label: 'Save message',
      description: 'Append a message to a Zep session.',
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
      description: 'Return Zep session messages.',
      fields: [
        ...inlineCreds,
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'limit', label: 'Last N', type: 'number' },
      ],
      run: loadSession,
    },
    {
      id: 'clear_session',
      label: 'Clear session',
      description: 'Wipe a Zep session.',
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
