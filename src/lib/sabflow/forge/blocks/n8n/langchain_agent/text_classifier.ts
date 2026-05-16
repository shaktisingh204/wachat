/**
 * Forge block: LangChain Text Classifier
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/transform/TextClassifier/TextClassifier.node.ts
 *
 * Asks the LLM to label a text with one of the supplied categories. The model
 * must reply with a JSON object so we get a structured result + confidence.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function parseCategories(raw: unknown): string[] {
  const s = asString(raw).trim();
  if (!s) throw new Error('Text Classifier: categories is required');
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) {
      return parsed.map((v) => asString(v)).filter(Boolean);
    }
  } catch {
    /* fall through — try CSV */
  }
  return s
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

function stripCodeFences(s: string): string {
  return s.replace(/^```(?:json)?\s*\n?/i, '').replace(/```\s*$/i, '').trim();
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Text Classifier: apiKey is required');
  const text = asString(ctx.options.text);
  if (!text) throw new Error('Text Classifier: text is required');
  const categories = parseCategories(ctx.options.categories);
  if (categories.length === 0) throw new Error('Text Classifier: at least one category is required');
  const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = asString(ctx.options.model) || 'gpt-4o-mini';

  const system =
    'You classify a single text into exactly one of the provided categories. ' +
    'Reply with a single JSON object: {"category": <one-of-categories>, "confidence": <0..1>}. ' +
    'If unsure, pick the most likely category and set a low confidence. JSON only.';

  const userPrompt = `Categories: ${JSON.stringify(categories)}\n\nText:\n"""\n${text}\n"""`;

  const res = await apiRequest({
    service: 'Text Classifier',
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

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    try {
      parsed = JSON.parse(stripCodeFences(raw)) as Record<string, unknown>;
    } catch {
      throw new Error('Text Classifier: model did not return valid JSON');
    }
  }

  const categoryRaw = asString(parsed.category).trim();
  const category = categories.includes(categoryRaw)
    ? categoryRaw
    : categories.find((c) => c.toLowerCase() === categoryRaw.toLowerCase()) ?? categories[0];
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence) || 0;

  return {
    outputs: { category, confidence, raw: res.data },
    logs: [`Text Classifier → ${category} (${confidence})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_text_classifier',
  name: 'LangChain Text Classifier',
  description: 'Classify text into one of N categories with a confidence score.',
  iconName: 'LuTags',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Classify',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        {
          id: 'categories',
          label: 'Categories (JSON array or comma-separated)',
          type: 'textarea',
          required: true,
          placeholder: '["billing","support","sales"]',
        },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
