/**
 * Forge block: LangChain Guardrails (Safety)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/guardrails/
 *
 * LLM-based safety/toxicity check. Returns `{ safe, categories[], severity }`
 * with severity in {low, medium, high}.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

type Severity = 'low' | 'medium' | 'high';

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

function normaliseSeverity(v: unknown): Severity {
  const s = asString(v).toLowerCase().trim();
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  return 'low';
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('Guardrails (Safety): text is required');
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Guardrails (Safety): apiKey is required');
  const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = asString(ctx.options.model) || 'gpt-4o-mini';

  const system =
    'You are a content safety classifier. Inspect the user text for toxicity, harassment, hate, violence, self-harm, sexual, illicit content. Return strict JSON: { "safe": boolean, "categories": string[], "severity": "low"|"medium"|"high" }. JSON only.';
  const res = await apiRequest({
    service: 'Guardrails (Safety)',
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    },
  });

  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  const raw = body?.choices?.[0]?.message?.content ?? '';
  const parsed = (tryParse(raw) ?? tryParse(stripFences(raw))) as
    | { safe?: boolean; categories?: unknown; severity?: unknown }
    | undefined;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Guardrails (Safety): LLM did not return valid JSON');
  }
  const safe = Boolean(parsed.safe);
  const categories = Array.isArray(parsed.categories) ? parsed.categories.map(asString).filter(Boolean) : [];
  const severity = normaliseSeverity(parsed.severity);

  return {
    outputs: { safe, categories, severity },
    logs: [`Guardrails (Safety) → ${safe ? 'safe' : `unsafe (${severity}: ${categories.join(', ') || 'unspecified'})`}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_guardrails_safety',
  name: 'LangChain Guardrails (Safety)',
  description: 'LLM safety/toxicity classifier returning categories and severity.',
  iconName: 'LuShieldAlert',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'check',
      label: 'Check content safety',
      fields: [
        { id: 'text', label: 'Text to check', type: 'textarea', required: true },
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
