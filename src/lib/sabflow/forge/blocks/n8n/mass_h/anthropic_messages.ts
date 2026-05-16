/**
 * Forge block: Anthropic Messages (extended)
 *
 * `/v1/messages` with tool use + streaming-disabled. Auth: x-api-key header.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.anthropic.com/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Anthropic: apiKey is required');
  return {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
}

function parseJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`Anthropic: ${label} must be valid JSON`);
  }
}

async function createMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'claude-3-5-sonnet-latest';
  const prompt = asString(ctx.options.prompt);
  const system = asString(ctx.options.system);
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;
  const temperature = asNumber(ctx.options.temperature);
  const messagesJson = parseJson(ctx.options.messagesJson, 'messagesJson');
  if (!prompt && !messagesJson) {
    throw new Error('Anthropic: prompt or messagesJson is required');
  }
  const messages = Array.isArray(messagesJson)
    ? messagesJson
    : [{ role: 'user', content: prompt }];
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
    stream: false,
  };
  if (system) body.system = system;
  if (typeof temperature === 'number') body.temperature = temperature;
  const res = await apiRequest({
    service: 'Anthropic',
    method: 'POST',
    url: `${API}/messages`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { message: res.data }, logs: [`Anthropic messages → ${model}`] };
}

async function createMessageWithTools(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'claude-3-5-sonnet-latest';
  const prompt = asString(ctx.options.prompt);
  const toolsJson = parseJson(ctx.options.toolsJson, 'toolsJson');
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;
  const toolChoice = asString(ctx.options.toolChoice);
  if (!prompt) throw new Error('Anthropic: prompt is required');
  if (!Array.isArray(toolsJson)) throw new Error('Anthropic: toolsJson must be a JSON array');
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
    tools: toolsJson,
    stream: false,
  };
  if (toolChoice) {
    body.tool_choice = toolChoice === 'auto' || toolChoice === 'any'
      ? { type: toolChoice }
      : { type: 'tool', name: toolChoice };
  }
  const res = await apiRequest({
    service: 'Anthropic',
    method: 'POST',
    url: `${API}/messages`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { message: res.data }, logs: [`Anthropic messages (tools) → ${model}`] };
}

async function countTokens(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'claude-3-5-sonnet-latest';
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Anthropic: prompt is required');
  const res = await apiRequest({
    service: 'Anthropic',
    method: 'POST',
    url: `${API}/messages/count_tokens`,
    headers: authHeaders(ctx),
    json: { model, messages: [{ role: 'user', content: prompt }] },
  });
  return { outputs: { tokens: res.data }, logs: [`Anthropic count_tokens → ${model}`] };
}

const block: ForgeBlock = {
  id: 'forge_anthropic_messages',
  name: 'Anthropic Messages',
  description: 'Call Anthropic /v1/messages with optional tools and token counting.',
  iconName: 'LuBot',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'create_message',
      label: 'Create message',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'claude-3-5-sonnet-latest' },
        { id: 'prompt', label: 'Prompt', type: 'textarea' },
        { id: 'system', label: 'System', type: 'textarea' },
        { id: 'maxTokens', label: 'Max tokens', type: 'number', defaultValue: 1024 },
        { id: 'temperature', label: 'Temperature', type: 'number' },
        { id: 'messagesJson', label: 'Messages JSON (overrides prompt)', type: 'json' },
      ],
      run: createMessage,
    },
    {
      id: 'create_message_tools',
      label: 'Create message with tools',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'claude-3-5-sonnet-latest' },
        { id: 'prompt', label: 'Prompt', type: 'textarea', required: true },
        { id: 'toolsJson', label: 'Tools JSON', type: 'json', required: true },
        { id: 'toolChoice', label: 'Tool choice (auto/any/<tool name>)', type: 'text' },
        { id: 'maxTokens', label: 'Max tokens', type: 'number', defaultValue: 1024 },
      ],
      run: createMessageWithTools,
    },
    {
      id: 'count_tokens',
      label: 'Count tokens',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'claude-3-5-sonnet-latest' },
        { id: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      ],
      run: countTokens,
    },
  ],
};

registerForgeBlock(block);
export default block;
