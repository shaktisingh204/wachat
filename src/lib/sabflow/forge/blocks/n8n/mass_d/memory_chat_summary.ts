/**
 * Forge block: Summary Chat Memory
 *
 * Memory that summarises older turns automatically. Maintains:
 *  - `summary`: rolling summary of dropped turns.
 *  - `recent`: last N raw turns (FIFO).
 *
 * When the recent window overflows, the oldest turn is folded into the
 * summary via an OpenAI-compatible chat-completions call.
 *
 * State is in a process-local Map. Lost on cold start.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

type Turn = { role: string; content: string };
type Session = { summary: string; recent: Turn[] };

const store = new Map<string, Session>();

function sessionId(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('Summary Memory: sessionId is required');
  return s;
}

function getSession(id: string): Session {
  let s = store.get(id);
  if (!s) {
    s = { summary: '', recent: [] };
    store.set(id, s);
  }
  return s;
}

async function summarise(
  baseUrl: string,
  apiKey: string,
  model: string,
  existing: string,
  dropped: Turn,
): Promise<string> {
  const prompt = `Existing running summary:\n${existing || '(empty)'}\n\nNew turn to fold in:\n${dropped.role}: ${dropped.content}\n\nReturn the updated 3–5 sentence summary.`;
  const result = await apiRequest({
    service: 'Summary Memory',
    method: 'POST',
    url: `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: 'You maintain a concise running summary of a conversation.' },
        { role: 'user', content: prompt },
      ],
    },
  });
  const data = result.data as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? existing;
}

async function appendTurn(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const role = asString(ctx.options.role) || 'user';
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Summary Memory: content is required');
  const keep = asNumber(ctx.options.keepRecent) ?? 6;
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Summary Memory: apiKey is required (for summariser)');
  const baseUrl = asString(ctx.options.baseUrl) || 'https://api.openai.com/v1';
  const model = asString(ctx.options.model) || 'gpt-4o-mini';

  const s = getSession(id);
  s.recent.push({ role, content });
  while (s.recent.length > keep) {
    const dropped = s.recent.shift()!;
    s.summary = await summarise(baseUrl, apiKey, model, s.summary, dropped);
  }
  return {
    outputs: { summary: s.summary, recent: s.recent },
    logs: [`Summary Memory append → ${id} (recent: ${s.recent.length})`],
  };
}

async function loadSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const s = getSession(id);
  return { outputs: { summary: s.summary, recent: s.recent }, logs: [`Summary Memory load → ${id}`] };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const had = store.delete(id);
  return { outputs: { cleared: had }, logs: [`Summary Memory clear → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_memory_chat_summary',
  name: 'Summary Chat Memory',
  description: 'Conversation memory that auto-summarises older turns into a rolling summary.',
  iconName: 'LuBookText',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'append',
      label: 'Append turn (auto-summarise older)',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'role', label: 'Role', type: 'text', defaultValue: 'user' },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
        { id: 'keepRecent', label: 'Keep most recent N turns', type: 'number', defaultValue: 6 },
        { id: 'apiKey', label: 'Summariser API Key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Summariser base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Summariser model', type: 'text', defaultValue: 'gpt-4o-mini' },
      ],
      run: appendTurn,
    },
    {
      id: 'load',
      label: 'Load session',
      fields: [{ id: 'sessionId', label: 'Session ID', type: 'text', required: true }],
      run: loadSession,
    },
    {
      id: 'clear',
      label: 'Clear session',
      fields: [{ id: 'sessionId', label: 'Session ID', type: 'text', required: true }],
      run: clearSession,
    },
  ],
};

registerForgeBlock(block);
export default block;
