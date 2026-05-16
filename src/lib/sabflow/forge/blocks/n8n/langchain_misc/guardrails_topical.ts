/**
 * Forge block: LangChain Guardrails (Topical)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/guardrails/
 *
 * LLM-based check that a prompt or response stays within an allowed set of
 * topics. Asks the LLM to return `{ on_topic, reason }` as strict JSON.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function stripFences(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : s.trim();
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Guardrails (Topical): prompt is required');
  const allowed = asString(ctx.options.allowed_topics);
  if (!allowed) throw new Error('Guardrails (Topical): allowed_topics is required');
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Guardrails (Topical): apiKey is required');
  const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = asString(ctx.options.model) || 'gpt-4o-mini';

  const system =
    'You are a strict topical guardrail. Decide whether the user text falls within the allowed topics. Reply with a JSON object: { "on_topic": boolean, "reason": string }. JSON only.';
  const user = `Allowed topics: ${allowed}\n\nText:\n${prompt}`;

  const res = await apiRequest({
    service: 'Guardrails (Topical)',
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    },
  });

  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  const raw = body?.choices?.[0]?.message?.content ?? '';
  const parsed = (tryParse(raw) ?? tryParse(stripFences(raw))) as
    | { on_topic?: boolean; reason?: string }
    | undefined;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Guardrails (Topical): LLM did not return valid JSON');
  }
  const onTopic = Boolean(parsed.on_topic);
  const reason = asString(parsed.reason);

  return {
    outputs: { on_topic: onTopic, reason },
    logs: [`Guardrails (Topical) → ${onTopic ? 'on-topic' : 'off-topic'} (${reason || 'no reason given'})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_guardrails_topical',
  name: 'LangChain Guardrails (Topical)',
  description: 'LLM check that text stays within an allowed set of topics.',
  iconName: 'LuCompass',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'check',
      label: 'Check topical compliance',
      fields: [
        { id: 'prompt', label: 'Text to check', type: 'textarea', required: true },
        {
          id: 'allowed_topics',
          label: 'Allowed topics (comma-separated or free text)',
          type: 'textarea',
          required: true,
          placeholder: 'cooking, recipes, ingredients',
        },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
