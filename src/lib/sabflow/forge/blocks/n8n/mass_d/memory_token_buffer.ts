/**
 * Forge block: Token Buffer Memory
 *
 * Like the buffer memory but bounded by an approximate token budget. Tokens
 * are estimated as `ceil(chars / 4)` (LangChain's default heuristic for the
 * tiktoken-cl100k tokenizer in pure-JS environments).
 *
 * On save, oldest messages are dropped until the running token count fits
 * `maxTokens`. State is LOST on cold start.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

type Message = { role: string; content: string; tokens: number; at: string };

const store = new Map<string, Message[]>();

function approxTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

function sessionId(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('Token Buffer Memory: sessionId is required');
  return s;
}

function getSession(id: string): Message[] {
  let s = store.get(id);
  if (!s) {
    s = [];
    store.set(id, s);
  }
  return s;
}

function trim(messages: Message[], maxTokens: number): void {
  let total = messages.reduce((n, m) => n + m.tokens, 0);
  while (total > maxTokens && messages.length > 0) {
    const dropped = messages.shift();
    if (dropped) total -= dropped.tokens;
  }
}

async function saveMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const role = asString(ctx.options.role) || 'user';
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Token Buffer Memory: content is required');
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 2000;
  const s = getSession(id);
  s.push({ role, content, tokens: approxTokens(content), at: new Date().toISOString() });
  trim(s, maxTokens);
  return {
    outputs: { ok: true, size: s.length, tokens: s.reduce((n, m) => n + m.tokens, 0) },
    logs: [`Token Buffer save → ${id} (${s.length} msgs)`],
  };
}

async function loadSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const s = getSession(id);
  const messages = s.map(({ role, content }) => ({ role, content }));
  return {
    outputs: { messages, tokens: s.reduce((n, m) => n + m.tokens, 0) },
    logs: [`Token Buffer load → ${messages.length}`],
  };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const had = store.delete(id);
  return { outputs: { cleared: had }, logs: [`Token Buffer clear → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_memory_token_buffer',
  name: 'Token Buffer Memory',
  description: 'Conversation memory bounded by an approximate token count (chars/4).',
  iconName: 'LuGauge',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'save_message',
      label: 'Save message',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'role', label: 'Role', type: 'text', defaultValue: 'user' },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
        { id: 'maxTokens', label: 'Max tokens', type: 'number', defaultValue: 2000 },
      ],
      run: saveMessage,
    },
    {
      id: 'load_session',
      label: 'Load session',
      fields: [{ id: 'sessionId', label: 'Session ID', type: 'text', required: true }],
      run: loadSession,
    },
    {
      id: 'clear_session',
      label: 'Clear session',
      fields: [{ id: 'sessionId', label: 'Session ID', type: 'text', required: true }],
      run: clearSession,
    },
  ],
};

registerForgeBlock(block);
export default block;
