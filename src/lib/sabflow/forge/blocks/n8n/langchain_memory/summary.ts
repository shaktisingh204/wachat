/**
 * Forge block: Summary Memory (in-memory + on-demand LLM summarisation)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/memory (summary variant)
 *
 * NOTE: State is held in a module-level Map keyed by session id. This is
 * single-process and IS LOST ON COLD START (or when the engine worker
 * restarts). Use one of the persistent backends for real workloads.
 *
 * Each session tracks:
 *   - a rolling summary string (compressed older context)
 *   - a tail of recent raw messages
 *
 * `save_message` appends to the tail. When the tail exceeds `maxRecent`, the
 * `summarise` action can be invoked with an inline LLM endpoint to fold the
 * tail into the rolling summary. `load_session` returns both.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

type Message = { role: string; content: string; at: string };

type Session = {
  summary: string;
  tail: Message[];
};

const store = new Map<string, Session>();

function getSession(id: string): Session {
  let s = store.get(id);
  if (!s) {
    s = { summary: '', tail: [] };
    store.set(id, s);
  }
  return s;
}

function sessionId(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('Summary: sessionId is required');
  return s;
}

async function saveMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const role = asString(ctx.options.role) || 'user';
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Summary: content is required');
  const s = getSession(id);
  s.tail.push({ role, content, at: new Date().toISOString() });
  return {
    outputs: { ok: true, tailSize: s.tail.length },
    logs: [`Summary save → ${id} (tail: ${s.tail.length})`],
  };
}

async function loadSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const limit = asNumber(ctx.options.limit) ?? 0;
  const s = getSession(id);
  const tail = limit > 0 ? s.tail.slice(-limit) : s.tail.slice();
  return {
    outputs: { summary: s.summary, messages: tail },
    logs: [`Summary load → tail ${tail.length}`],
  };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const had = store.delete(id);
  return { outputs: { cleared: had }, logs: [`Summary clear → ${id}`] };
}

/**
 * Fold tail messages into the rolling summary using an OpenAI-compatible
 * Chat Completions endpoint. The endpoint defaults to OpenAI but any
 * compatible URL works (LiteLLM, llama.cpp server, etc).
 */
async function summarise(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const s = getSession(id);
  if (s.tail.length === 0) {
    return { outputs: { summary: s.summary }, logs: ['Summary: nothing to summarise'] };
  }
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Summary: apiKey is required');
  const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com').replace(/\/$/, '');
  const model = asString(ctx.options.model) || 'gpt-4o-mini';

  const transcript = s.tail.map((m) => `${m.role}: ${m.content}`).join('\n');
  const prompt = s.summary
    ? `Existing summary:\n${s.summary}\n\nNew lines:\n${transcript}\n\nProduce an updated concise summary.`
    : `Summarise the following conversation concisely:\n${transcript}`;

  const res = await apiRequest({
    service: 'Summary',
    method: 'POST',
    url: `${baseUrl}/v1/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      messages: [
        { role: 'system', content: 'You compress chat history into short factual summaries.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    },
  });
  const data = res.data as { choices?: Array<{ message?: { content?: string } }> };
  const summary = String(data?.choices?.[0]?.message?.content ?? '').trim();
  s.summary = summary || s.summary;
  s.tail = [];
  return {
    outputs: { summary: s.summary },
    logs: [`Summary updated (${s.summary.length} chars)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_mem_summary',
  name: 'Summary Memory',
  description:
    'In-memory chat history with on-demand LLM summarisation. State is LOST on cold start — use a persistent backend for real workloads.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'save_message',
      label: 'Save message',
      description: 'Append a message to the session tail.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'role', label: 'Role', type: 'text', defaultValue: 'user' },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
      ],
      run: saveMessage,
    },
    {
      id: 'load_session',
      label: 'Load session',
      description: 'Return the rolling summary plus recent tail.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'limit', label: 'Tail limit (last N)', type: 'number' },
      ],
      run: loadSession,
    },
    {
      id: 'summarise',
      label: 'Summarise tail',
      description: 'Fold the recent tail into the rolling summary via an LLM.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'apiKey', label: 'LLM API key', type: 'password', required: true },
        { id: 'baseUrl', label: 'LLM base URL', type: 'text', placeholder: 'https://api.openai.com' },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'gpt-4o-mini' },
      ],
      run: summarise,
    },
    {
      id: 'clear_session',
      label: 'Clear session',
      description: 'Drop the summary and tail.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
      ],
      run: clearSession,
    },
  ],
};

registerForgeBlock(block);
export default block;
