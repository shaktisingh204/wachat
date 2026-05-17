/**
 * Forge block: LangChain Memory Manager.
 *
 * Add or remove messages from a named in-memory store. Same module-level state
 * caveats as the Buffer Memory block — single-process, lost on cold start.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

type Message = { role: string; content: string; at: string };

declare global {
  // eslint-disable-next-line no-var
  var __sabflow_chat_memory_store__: Map<string, Message[]> | undefined;
}

function getStore(): Map<string, Message[]> {
  if (!globalThis.__sabflow_chat_memory_store__) {
    globalThis.__sabflow_chat_memory_store__ = new Map<string, Message[]>();
  }
  return globalThis.__sabflow_chat_memory_store__;
}

function getSession(id: string): Message[] {
  const store = getStore();
  let s = store.get(id);
  if (!s) {
    s = [];
    store.set(id, s);
  }
  return s;
}

async function add(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.sessionId);
  if (!id) throw new Error('Memory Manager: sessionId is required');
  const role = asString(ctx.options.role) || 'user';
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Memory Manager: content is required');
  const s = getSession(id);
  s.push({ role, content, at: new Date().toISOString() });
  return { outputs: { ok: true, size: s.length }, logs: [`Memory Manager add → ${id} (size: ${s.length})`] };
}

async function removeRecent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.sessionId);
  if (!id) throw new Error('Memory Manager: sessionId is required');
  const count = Math.max(1, asNumber(ctx.options.count) ?? 1);
  const s = getSession(id);
  const removed = s.splice(Math.max(0, s.length - count), count);
  return {
    outputs: { removed, size: s.length },
    logs: [`Memory Manager remove → ${id} (-${removed.length})`],
  };
}

async function clear(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.sessionId);
  if (!id) throw new Error('Memory Manager: sessionId is required');
  const store = getStore();
  const had = store.delete(id);
  return { outputs: { cleared: had }, logs: [`Memory Manager clear → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_lc_memory_manager',
  name: 'Memory Manager',
  description: 'Add or remove messages from the shared in-memory chat store.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'add',
      label: 'Add message',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'role', label: 'Role', type: 'text', defaultValue: 'user' },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
      ],
      run: add,
    },
    {
      id: 'remove_recent',
      label: 'Remove recent N',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'count', label: 'Count', type: 'number', defaultValue: 1 },
      ],
      run: removeRecent,
    },
    {
      id: 'clear',
      label: 'Clear session',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
      ],
      run: clear,
    },
  ],
};

registerForgeBlock(block);
export default block;
