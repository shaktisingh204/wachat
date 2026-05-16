/**
 * Forge block: Buffer Window Memory (in-memory)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/memory/MemoryBufferWindow
 *
 * NOTE: State is held in a module-level Map keyed by session id. This is
 * single-process and IS LOST ON COLD START (or when the engine worker
 * restarts). Use one of the persistent backends (Postgres, Redis, Mongo,
 * Xata, Zep, Motörhead) for real workloads.
 *
 * Keeps the last N messages per session. Older messages are dropped on save.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

type Message = { role: string; content: string; at: string };

const store = new Map<string, Message[]>();

const DEFAULT_WINDOW = 10;

function getSession(id: string): Message[] {
  let s = store.get(id);
  if (!s) {
    s = [];
    store.set(id, s);
  }
  return s;
}

function sessionId(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('BufferWindow: sessionId is required');
  return s;
}

async function saveMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const role = asString(ctx.options.role) || 'user';
  const content = asString(ctx.options.content);
  if (!content) throw new Error('BufferWindow: content is required');
  const window = asNumber(ctx.options.window) ?? DEFAULT_WINDOW;
  const s = getSession(id);
  s.push({ role, content, at: new Date().toISOString() });
  if (window > 0 && s.length > window) s.splice(0, s.length - window);
  return { outputs: { ok: true, size: s.length }, logs: [`BufferWindow save → ${id} (size: ${s.length})`] };
}

async function loadSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const limit = asNumber(ctx.options.limit) ?? 0;
  const s = getSession(id);
  const messages = limit > 0 ? s.slice(-limit) : s.slice();
  return { outputs: { messages }, logs: [`BufferWindow load → ${messages.length}`] };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const had = store.delete(id);
  return { outputs: { cleared: had }, logs: [`BufferWindow clear → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_mem_buffer_window',
  name: 'Buffer Window Memory',
  description:
    'In-memory chat history limited to the last N messages per session. State is LOST on cold start — use a persistent backend (Postgres, Redis, Mongo) for real workloads.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'save_message',
      label: 'Save message',
      description: 'Append a message; drops oldest beyond the window.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'role', label: 'Role', type: 'text', defaultValue: 'user' },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
        { id: 'window', label: 'Window size (N)', type: 'number', defaultValue: DEFAULT_WINDOW },
      ],
      run: saveMessage,
    },
    {
      id: 'load_session',
      label: 'Load session',
      description: 'Return the windowed message history.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit (last N)', type: 'number' },
      ],
      run: loadSession,
    },
    {
      id: 'clear_session',
      label: 'Clear session',
      description: 'Drop the in-memory window.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
      ],
      run: clearSession,
    },
  ],
};

registerForgeBlock(block);
export default block;
