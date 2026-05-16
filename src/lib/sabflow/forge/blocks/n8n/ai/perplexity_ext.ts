/**
 * Forge block: Perplexity (extended)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Perplexity/Perplexity.node.ts
 * Credential type: 'perplexity' (expects { apiKey }).
 *
 * Endpoint: https://api.perplexity.ai/chat/completions
 *
 * Operations:
 *   - chat            POST /chat/completions (full param surface)
 *   - chat_simple     POST /chat/completions with a single user prompt
 *   - search          POST /chat/completions with `return_citations`
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const ENDPOINT = 'https://api.perplexity.ai/chat/completions';

function bearer(ctx: ForgeActionContext): string {
  const cred = requireCredential('Perplexity', ctx.credential);
  const key = cred.apiKey ?? cred.accessToken;
  if (!key) throw new Error('Perplexity: credential is missing `apiKey`');
  return `Bearer ${key}`;
}

function parseMessages(raw: unknown): Array<{ role: string; content: string }> {
  const s = asString(raw).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fallthrough */
  }
  return [{ role: 'user', content: s }];
}

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'sonar-medium-chat';
  const messages = parseMessages(ctx.options.messages);
  if (messages.length === 0) throw new Error('Perplexity chat: messages are required');

  const payload: Record<string, unknown> = { model, messages };
  if (ctx.options.temperature !== undefined && ctx.options.temperature !== '') {
    payload.temperature = Number(ctx.options.temperature);
  }
  if (ctx.options.maxTokens) payload.max_tokens = Number(ctx.options.maxTokens);

  const res = await apiRequest({
    service: 'Perplexity',
    method: 'POST',
    url: ENDPOINT,
    headers: { Authorization: bearer(ctx) },
    json: payload,
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  return {
    outputs: { content: body?.choices?.[0]?.message?.content ?? '', raw: res.data },
    logs: [`Perplexity chat → ${model}`],
  };
}

async function chatSimple(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Perplexity simple: prompt is required');
  const model = asString(ctx.options.model) || 'sonar-small-chat';

  const res = await apiRequest({
    service: 'Perplexity',
    method: 'POST',
    url: ENDPOINT,
    headers: { Authorization: bearer(ctx) },
    json: { model, messages: [{ role: 'user', content: prompt }] },
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  return {
    outputs: { content: body?.choices?.[0]?.message?.content ?? '', raw: res.data },
    logs: [`Perplexity simple → ${model}`],
  };
}

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  if (!query) throw new Error('Perplexity search: query is required');
  const model = asString(ctx.options.model) || 'sonar-online';

  const res = await apiRequest({
    service: 'Perplexity',
    method: 'POST',
    url: ENDPOINT,
    headers: { Authorization: bearer(ctx) },
    json: {
      model,
      messages: [{ role: 'user', content: query }],
      return_citations: true,
    },
  });
  const body = res.data as {
    choices?: Array<{ message?: { content?: string } }>;
    citations?: string[];
  };
  return {
    outputs: {
      content: body?.choices?.[0]?.message?.content ?? '',
      citations: body?.citations ?? [],
      raw: res.data,
    },
    logs: [`Perplexity search → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_perplexity_ext',
  name: 'Perplexity (extended)',
  description: 'Chat and web-aware search against Perplexity sonar models.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'perplexity' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      description: 'Full chat call with a messages array.',
      fields: [
        { id: 'model', label: 'Model', type: 'select', options: [
          { label: 'sonar-small-chat', value: 'sonar-small-chat' },
          { label: 'sonar-medium-chat', value: 'sonar-medium-chat' },
          { label: 'sonar-online', value: 'sonar-online' },
        ] },
        { id: 'messages', label: 'Messages', type: 'textarea', required: true, placeholder: '[{"role":"user","content":"Hi"}]' },
        { id: 'temperature', label: 'Temperature', type: 'number' },
        { id: 'maxTokens', label: 'Max tokens', type: 'number' },
      ],
      run: chat,
    },
    {
      id: 'chat_simple',
      label: 'Quick chat',
      description: 'Single-prompt convenience wrapper.',
      fields: [
        { id: 'prompt', label: 'Prompt', type: 'textarea', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'sonar-small-chat' },
      ],
      run: chatSimple,
    },
    {
      id: 'search',
      label: 'Web search',
      description: 'Use sonar-online for web-aware answers with citations.',
      fields: [
        { id: 'query', label: 'Query', type: 'textarea', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'sonar-online' },
      ],
      run: search,
    },
  ],
};

registerForgeBlock(block);
export default block;
