/**
 * Forge block: Conversation Memory (in-memory)
 *
 * Stores the entire transcript per session in a process-local Map. Like
 * `forge_mem_buffer` but exposes higher-level conversation primitives:
 * append a turn, format as chat-completion messages, render as prose.
 *
 * State is LOST on cold start — use a persistent backend for production.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

type Turn = { role: 'user' | 'assistant' | 'system'; content: string; at: string };

const store = new Map<string, Turn[]>();

function getSession(id: string): Turn[] {
  let s = store.get(id);
  if (!s) {
    s = [];
    store.set(id, s);
  }
  return s;
}

function sessionId(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('Conversation Memory: sessionId is required');
  return s;
}

function normaliseRole(r: string): Turn['role'] {
  const v = r.toLowerCase().trim();
  if (v === 'assistant' || v === 'ai' || v === 'bot') return 'assistant';
  if (v === 'system') return 'system';
  return 'user';
}

async function appendTurn(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const role = normaliseRole(asString(ctx.options.role) || 'user');
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Conversation Memory: content is required');
  const s = getSession(id);
  s.push({ role, content, at: new Date().toISOString() });
  return { outputs: { ok: true, size: s.length }, logs: [`Conversation append → ${id} (${s.length})`] };
}

async function asMessages(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const limit = asNumber(ctx.options.limit) ?? 0;
  const s = getSession(id);
  const slice = limit > 0 ? s.slice(-limit) : s.slice();
  const messages = slice.map((t) => ({ role: t.role, content: t.content }));
  return { outputs: { messages, size: messages.length }, logs: [`Conversation messages → ${messages.length}`] };
}

async function asProse(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const limit = asNumber(ctx.options.limit) ?? 0;
  const s = getSession(id);
  const slice = limit > 0 ? s.slice(-limit) : s.slice();
  const text = slice.map((t) => `${t.role === 'assistant' ? 'AI' : t.role === 'user' ? 'User' : 'System'}: ${t.content}`).join('\n');
  return { outputs: { text, size: slice.length }, logs: [`Conversation prose → ${slice.length} turn(s)`] };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const had = store.delete(id);
  return { outputs: { cleared: had }, logs: [`Conversation clear → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_memory_conversation',
  name: 'Conversation Memory',
  description: 'Full chat-history memory per session (in-memory). Lost on cold start — use a DB for production.',
  iconName: 'LuMessagesSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'append',
      label: 'Append turn',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'role', label: 'Role', type: 'text', defaultValue: 'user' },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
      ],
      run: appendTurn,
    },
    {
      id: 'as_messages',
      label: 'Get as chat messages',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit (last N)', type: 'number' },
      ],
      run: asMessages,
    },
    {
      id: 'as_prose',
      label: 'Get as prose',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit (last N)', type: 'number' },
      ],
      run: asProse,
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
