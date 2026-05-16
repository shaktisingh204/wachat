/**
 * Forge block: Buffer Memory (in-memory)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/memory/MemoryBufferMemory
 *
 * NOTE: State is held in a module-level Map keyed by session id. This is
 * single-process and IS LOST ON COLD START (or when the engine worker
 * restarts). Use one of the persistent backends (Postgres, Redis, Mongo,
 * Xata, Zep, Motörhead) for real workloads.
 *
 * Keeps the full transcript per session.
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
  if (!s) throw new Error('Buffer: sessionId is required');
  return s;
}

async function saveMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const role = asString(ctx.options.role) || 'user';
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Buffer: content is required');
  const s = getSession(id);
  s.push({ role, content, at: new Date().toISOString() });
  return { outputs: { ok: true, size: s.length }, logs: [`Buffer save → ${id} (size: ${s.length})`] };
}

async function loadSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const limit = asNumber(ctx.options.limit) ?? 0;
  const s = getSession(id);
  const messages = limit > 0 ? s.slice(-limit) : s.slice();
  return { outputs: { messages }, logs: [`Buffer load → ${messages.length}`] };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const had = store.delete(id);
  return { outputs: { cleared: had }, logs: [`Buffer clear → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_mem_buffer',
  name: 'Buffer Memory',
  description:
    'In-memory full-transcript chat history per session. State is LOST on cold start — use a persistent backend (Postgres, Redis, Mongo) for real workloads.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'save_message',
      label: 'Save message',
      description: 'Append a message to the session transcript.',
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
      description: 'Return the full message history (or last N).',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit (last N)', type: 'number' },
      ],
      run: loadSession,
    },
    {
      id: 'clear_session',
      label: 'Clear session',
      description: 'Drop the in-memory transcript.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
      ],
      run: clearSession,
    },
  ],
};

registerForgeBlock(block);
export default block;
