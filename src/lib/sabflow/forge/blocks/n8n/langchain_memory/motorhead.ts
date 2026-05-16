/**
 * Forge block: Motörhead Memory
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/memory/MemoryMotorhead
 *
 * Motörhead is a Rust-based memory server with a simple REST API:
 *   GET    /sessions/{sessionId}/memory       → { messages: [...] }
 *   POST   /sessions/{sessionId}/memory       → append a message
 *   DELETE /sessions/{sessionId}/memory       → drop the session
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
  const baseUrl = asString(ctx.options.baseUrl).replace(/\/$/, '');
  if (!baseUrl) throw new Error('Motorhead: baseUrl is required');
  const apiKey = asString(ctx.options.apiKey);
  const clientId = asString(ctx.options.clientId);
  const headers: Record<string, string> = {};
  if (apiKey) headers['X-Api-Key'] = apiKey;
  if (clientId) headers['X-Client-Id'] = clientId;
  return { baseUrl, headers };
}

function sessionId(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('Motorhead: sessionId is required');
  return s;
}

async function saveMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, headers } = endpoint(ctx);
  const role = asString(ctx.options.role) || 'user';
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Motorhead: content is required');
  const id = sessionId(ctx);
  await apiRequest({
    service: 'Motorhead',
    method: 'POST',
    url: `${baseUrl}/sessions/${encodeURIComponent(id)}/memory`,
    headers,
    json: { messages: [{ role, content }] },
  });
  return { outputs: { ok: true }, logs: [`Motorhead save → ${id} (${role})`] };
}

async function loadSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, headers } = endpoint(ctx);
  const id = sessionId(ctx);
  const limit = asNumber(ctx.options.limit);
  const res = await apiRequest({
    service: 'Motorhead',
    method: 'GET',
    url: `${baseUrl}/sessions/${encodeURIComponent(id)}/memory`,
    headers,
  });
  const data = res.data as { messages?: Array<{ role: string; content: string }> };
  let messages = Array.isArray(data?.messages) ? data.messages : [];
  if (limit && limit > 0) messages = messages.slice(-limit);
  return { outputs: { messages }, logs: [`Motorhead load → ${messages.length}`] };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, headers } = endpoint(ctx);
  const id = sessionId(ctx);
  await apiRequest({
    service: 'Motorhead',
    method: 'DELETE',
    url: `${baseUrl}/sessions/${encodeURIComponent(id)}/memory`,
    headers,
  });
  return { outputs: { cleared: true }, logs: [`Motorhead clear → ${id}`] };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'http://localhost:8080' },
  { id: 'apiKey', label: 'API key', type: 'password' as const },
  { id: 'clientId', label: 'Client ID', type: 'text' as const },
];

const block: ForgeBlock = {
  id: 'forge_mem_motorhead',
  name: 'Motörhead Memory',
  description: 'Persist chat sessions in a Motörhead memory server.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'save_message',
      label: 'Save message',
      description: 'Append a message to a session.',
      fields: [
        ...inlineCreds,
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'role', label: 'Role', type: 'text', defaultValue: 'user', placeholder: 'user / assistant / system' },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
      ],
      run: saveMessage,
    },
    {
      id: 'load_session',
      label: 'Load session',
      description: 'Return the message history for a session.',
      fields: [
        ...inlineCreds,
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit (last N)', type: 'number' },
      ],
      run: loadSession,
    },
    {
      id: 'clear_session',
      label: 'Clear session',
      description: 'Delete all messages for a session.',
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
