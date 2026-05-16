/**
 * Forge block: LangChain Information Extractor
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/transform/InformationExtractor/InformationExtractor.node.ts
 *
 * Uses OpenAI's JSON-mode response format to ask the model to extract values
 * matching the provided JSON schema. Falls back to fenced-code parsing if the
 * model still returns prose.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function parseSchema(raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) throw new Error('Information Extractor: schema is required');
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error('schema must be a JSON object');
  } catch (err) {
    throw new Error(`Information Extractor: invalid schema — ${(err as Error).message}`);
  }
}

function stripCodeFences(s: string): string {
  return s.replace(/^```(?:json)?\s*\n?/i, '').replace(/```\s*$/i, '').trim();
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Information Extractor: apiKey is required');
  const text = asString(ctx.options.text);
  if (!text) throw new Error('Information Extractor: text is required');
  const schema = parseSchema(ctx.options.schema);
  const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = asString(ctx.options.model) || 'gpt-4o-mini';

  const system =
    'You are an information extraction engine. Read the user text and emit a single JSON object matching the supplied schema. Use null for fields that cannot be confidently filled. Return JSON only — no commentary.';
  const userPrompt = `Schema:\n${JSON.stringify(schema, null, 2)}\n\nText:\n"""\n${text}\n"""`;

  const res = await apiRequest({
    service: 'Information Extractor',
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    },
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  const raw = body?.choices?.[0]?.message?.content ?? '';
  let extracted: unknown;
  try {
    extracted = JSON.parse(raw);
  } catch {
    try {
      extracted = JSON.parse(stripCodeFences(raw));
    } catch {
      throw new Error('Information Extractor: model did not return valid JSON');
    }
  }

  return {
    outputs: { extracted, raw: res.data, raw_text: raw },
    logs: [`Information Extractor → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_information_extractor',
  name: 'LangChain Information Extractor',
  description: 'Extract structured fields from text against a JSON schema.',
  iconName: 'LuListChecks',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Extract',
      description: 'Ask the LLM to produce a JSON object matching the supplied schema.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        {
          id: 'schema',
          label: 'JSON schema (object describing fields)',
          type: 'json',
          required: true,
          placeholder: '{"name":"string","email":"string","age":"number"}',
        },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
