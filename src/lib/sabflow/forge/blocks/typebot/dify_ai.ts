/**
 * Forge block: Dify.AI (LLM-powered apps + knowledge bases)
 *
 * Source: typebot.io-main/packages/forge/blocks/difyAi/src/actions/
 *
 * Actions:
 *   - create_chat_message
 *       POST <endpoint>/chat-messages
 *       body: { inputs: {}, query, user, conversation_id?, files?, response_mode: 'blocking' }
 *       returns: { answer, conversation_id, message_id }
 *
 *   - query_knowledge_base
 *       POST <endpoint>/datasets/<datasetId>/retrieve
 *       body: { query, retrieval_model: { top_k } }
 *       returns: { records }
 *
 * Auth is `none` at the forge layer — apiKey + endpoint are inline per action.
 * `endpoint` defaults to `https://api.dify.ai/v1` so self-hosted Dify users
 * can point at their own deployment.
 */

import { registerForgeBlock } from '../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../types';
import { apiRequest, asNumber, asString } from '../n8n/_shared/http';

const DEFAULT_ENDPOINT = 'https://api.dify.ai/v1';

function resolveAuth(ctx: ForgeActionContext): { apiKey: string; endpoint: string } {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Dify AI: apiKey is required');
  const endpoint = (asString(ctx.options.endpoint) || DEFAULT_ENDPOINT).replace(/\/+$/, '');
  return { apiKey, endpoint };
}

function parseOptionalJson(input: unknown, label: string): unknown {
  if (input == null) return undefined;
  if (typeof input !== 'string') return input;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Dify AI: ${label} must be valid JSON`);
  }
}

async function createChatMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { apiKey, endpoint } = resolveAuth(ctx);
  const query = asString(ctx.options.query);
  const user = asString(ctx.options.user);
  const conversationId = asString(ctx.options.conversationId);
  const files = parseOptionalJson(ctx.options.files, 'files');
  if (!query) throw new Error('Dify AI: query is required');
  if (!user) throw new Error('Dify AI: user is required');

  const body: Record<string, unknown> = {
    inputs: {},
    query,
    user,
    response_mode: 'blocking',
  };
  if (conversationId) body.conversation_id = conversationId;
  if (files !== undefined) body.files = files;

  const res = await apiRequest({
    service: 'Dify AI',
    method: 'POST',
    url: `${endpoint}/chat-messages`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: body,
  });

  const data = (res.data ?? {}) as {
    answer?: unknown;
    conversation_id?: unknown;
    message_id?: unknown;
  };
  return {
    outputs: {
      answer: data.answer,
      conversation_id: data.conversation_id,
      message_id: data.message_id,
    },
    logs: [`Dify AI create_chat_message → user ${user}`],
  };
}

async function queryKnowledgeBase(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { apiKey, endpoint } = resolveAuth(ctx);
  const query = asString(ctx.options.query);
  const datasetId = asString(ctx.options.datasetId);
  const topK = asNumber(ctx.options.topK) ?? 4;
  if (!query) throw new Error('Dify AI: query is required');
  if (!datasetId) throw new Error('Dify AI: datasetId is required');

  const res = await apiRequest({
    service: 'Dify AI',
    method: 'POST',
    url: `${endpoint}/datasets/${encodeURIComponent(datasetId)}/retrieve`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: { query, retrieval_model: { top_k: topK } },
  });

  const data = (res.data ?? {}) as { records?: unknown };
  return {
    outputs: { records: data.records },
    logs: [`Dify AI query_knowledge_base → ${datasetId} (top_k=${topK})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_typebot_dify_ai',
  name: 'Dify AI (typebot)',
  description: 'Talk to a Dify.AI app — chat messages or knowledge-base retrieval.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'create_chat_message',
      label: 'Create chat message',
      description: 'Blocking call to /chat-messages — returns the answer + conversation/message ids.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        {
          id: 'endpoint',
          label: 'Endpoint',
          type: 'text',
          defaultValue: DEFAULT_ENDPOINT,
          placeholder: DEFAULT_ENDPOINT,
        },
        { id: 'query', label: 'Query', type: 'textarea', required: true },
        { id: 'user', label: 'User identifier', type: 'text', required: true },
        { id: 'conversationId', label: 'Conversation ID', type: 'text', helperText: 'Optional — set to continue an existing conversation.' },
        { id: 'files', label: 'Files (JSON)', type: 'json', placeholder: '[]' },
      ],
      run: createChatMessage,
    },
    {
      id: 'query_knowledge_base',
      label: 'Query knowledge base',
      description: 'Retrieve top-K chunks from a Dify dataset.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        {
          id: 'endpoint',
          label: 'Endpoint',
          type: 'text',
          defaultValue: DEFAULT_ENDPOINT,
          placeholder: DEFAULT_ENDPOINT,
        },
        { id: 'query', label: 'Query', type: 'textarea', required: true },
        { id: 'datasetId', label: 'Dataset ID', type: 'text', required: true },
        { id: 'topK', label: 'Top K', type: 'number', defaultValue: 4 },
      ],
      run: queryKnowledgeBase,
    },
  ],
};

registerForgeBlock(block);
export default block;
