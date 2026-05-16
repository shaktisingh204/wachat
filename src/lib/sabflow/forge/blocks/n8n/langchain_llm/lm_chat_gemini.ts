/**
 * Forge block: LM Chat Google Gemini
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/llms/LmChatGoogleGemini/LmChatGoogleGemini.node.ts
 *
 * Posts to Google AI Studio's `generateContent` REST endpoint.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Gemini: apiKey is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Gemini: prompt is required');
  const model = asString(ctx.options.model) || 'gemini-1.5-flash';
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  if (system) {
    payload.systemInstruction = { role: 'system', parts: [{ text: system }] };
  }

  const res = await apiRequest({
    service: 'Gemini',
    method: 'POST',
    url,
    json: payload,
  });
  const body = res.data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (body?.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('');
  return {
    outputs: { text, raw: res.data },
    logs: [`Gemini chat → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_chat_gemini',
  name: 'LM Chat Google Gemini',
  description: 'Send a chat completion request to Google Gemini.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gemini-1.5-flash' },
        { id: 'system', label: 'System prompt', type: 'textarea' },
        { id: 'prompt', label: 'User prompt', type: 'textarea', required: true },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
        { id: 'maxTokens', label: 'Max tokens', type: 'number', defaultValue: 1024 },
      ],
      run: chat,
    },
  ],
};

registerForgeBlock(block);
export default block;
