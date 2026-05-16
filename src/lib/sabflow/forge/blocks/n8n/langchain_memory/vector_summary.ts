/**
 * Forge block: Vector Summary Memory (in-memory short-term + vector long-term)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/memory (vector-store
 *         retriever variant)
 *
 * NOTE: Short-term state is held in a module-level Map keyed by session id —
 * single-process and IS LOST ON COLD START. The long-term memory lives in a
 * persistent vector store: this block forwards `archive_to_vector` calls to
 * another forge vector block (e.g. `forge_vector_pinecone`,
 * `forge_vector_pgvector`, …) via the shared registry.
 *
 * Architecture:
 *   - save_message    → appends to the short-term ring buffer
 *   - load_session    → returns recent messages from short-term
 *   - clear_session   → drops the in-memory buffer for the session
 *   - archive_to_vector → delegates to a chosen vector block's
 *                         `upsert_vectors` action, with a caller-supplied
 *                         embedding for each tail message
 */

import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

type Message = { role: string; content: string; at: string };

const store = new Map<string, Message[]>();

const DEFAULT_WINDOW = 20;

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
  if (!s) throw new Error('VectorSummary: sessionId is required');
  return s;
}

async function saveMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const role = asString(ctx.options.role) || 'user';
  const content = asString(ctx.options.content);
  if (!content) throw new Error('VectorSummary: content is required');
  const window = asNumber(ctx.options.window) ?? DEFAULT_WINDOW;
  const s = getSession(id);
  s.push({ role, content, at: new Date().toISOString() });
  if (window > 0 && s.length > window) s.splice(0, s.length - window);
  return {
    outputs: { ok: true, size: s.length },
    logs: [`VectorSummary save → ${id} (size: ${s.length})`],
  };
}

async function loadSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const limit = asNumber(ctx.options.limit) ?? 0;
  const s = getSession(id);
  const messages = limit > 0 ? s.slice(-limit) : s.slice();
  return { outputs: { messages }, logs: [`VectorSummary load → ${messages.length}`] };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const had = store.delete(id);
  return { outputs: { cleared: had }, logs: [`VectorSummary clear → ${id}`] };
}

/**
 * Delegate the current short-term tail to a forge vector block. The caller
 * must provide:
 *   - `vectorBlockId`  — e.g. `forge_vector_pinecone`
 *   - `vectorOptions`  — JSON object merged into ctx.options for that block
 *   - `vectors`        — JSON array of pre-embedded items
 *                        `[{ id, vector, metadata? }]`
 * After successful upsert the short-term buffer is drained.
 */
async function archiveToVector(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const blockId = asString(ctx.options.vectorBlockId);
  if (!blockId) throw new Error('VectorSummary: vectorBlockId is required');
  const vectorsRaw = asString(ctx.options.vectors);
  if (!vectorsRaw) throw new Error('VectorSummary: vectors (JSON array) is required');
  const optionsRaw = asString(ctx.options.vectorOptions);
  const extraOptions = optionsRaw ? (JSON.parse(optionsRaw) as Record<string, unknown>) : {};

  const targetBlock = getForgeBlock(blockId);
  if (!targetBlock) throw new Error(`VectorSummary: unknown vector block "${blockId}"`);
  const action = targetBlock.actions?.find((a) => a.id === 'upsert_vectors');
  if (!action) throw new Error(`VectorSummary: block "${blockId}" has no upsert_vectors action`);

  const result = await action.run({
    options: { ...extraOptions, vectors: vectorsRaw },
    variables: ctx.variables,
    credential: ctx.credential,
  });

  // Drain the short-term tail after a successful archive.
  store.set(id, []);
  return {
    outputs: { archived: result.outputs?.upserted ?? 0 },
    logs: [
      `VectorSummary archive → ${blockId}`,
      ...(result.logs ?? []),
      `VectorSummary short-term drained for ${id}`,
    ],
  };
}

const block: ForgeBlock = {
  id: 'forge_mem_vector_summary',
  name: 'Vector Summary Memory',
  description:
    'In-memory short-term chat buffer + delegation to a persistent vector store for long-term retrieval. Short-term state is LOST on cold start.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'save_message',
      label: 'Save message',
      description: 'Append a message to the short-term window.',
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
      description: 'Return short-term messages for the session.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit (last N)', type: 'number' },
      ],
      run: loadSession,
    },
    {
      id: 'archive_to_vector',
      label: 'Archive to vector store',
      description: 'Forward embeddings to a persistent vector block, then drain the buffer.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'vectorBlockId', label: 'Target vector block id', type: 'text', required: true, placeholder: 'forge_vector_pinecone' },
        { id: 'vectorOptions', label: 'Vector block options (JSON)', type: 'textarea', placeholder: '{ "apiKey": "…", "indexName": "chat" }' },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: archiveToVector,
    },
    {
      id: 'clear_session',
      label: 'Clear session',
      description: 'Drop the short-term buffer for the session.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
      ],
      run: clearSession,
    },
  ],
};

registerForgeBlock(block);
export default block;
