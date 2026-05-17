/**
 * Forge block: LangChain Memory Chat Retriever.
 *
 * Reads the N most recent messages from the same in-memory store used by the
 * `Buffer Memory` block (single-process, lost on cold start).
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

async function retrieve(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sessionId = asString(ctx.options.sessionId);
  if (!sessionId) throw new Error('Memory Chat Retriever: sessionId is required');
  const limit = asNumber(ctx.options.limit) ?? 5;
  const store = getStore();
  const all = store.get(sessionId) ?? [];
  const messages = limit > 0 ? all.slice(-limit) : all.slice();
  return {
    outputs: { messages, total: all.length, returned: messages.length },
    logs: [`Memory Chat Retriever → ${messages.length}/${all.length}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_memory_chat_retriever',
  name: 'Memory Chat Retriever',
  description: 'Return the N most recent messages from the in-memory chat history for a session.',
  iconName: 'LuHistory',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'retrieve',
      label: 'Retrieve recent',
      description: 'Pull the last N messages from the shared in-memory store.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit (last N)', type: 'number', defaultValue: 5 },
      ],
      run: retrieve,
    },
  ],
};

registerForgeBlock(block);
export default block;
