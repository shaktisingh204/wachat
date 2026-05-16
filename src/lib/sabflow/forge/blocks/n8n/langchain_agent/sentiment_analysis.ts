/**
 * Forge block: LangChain Sentiment Analysis
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/transform/SentimentAnalysis/SentimentAnalysis.node.ts
 *
 * Asks the LLM to classify the polarity of a chunk of text and return a
 * structured object (sentiment / score / reasoning).
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const VALID = new Set(['positive', 'neutral', 'negative']);

function stripCodeFences(s: string): string {
  return s.replace(/^```(?:json)?\s*\n?/i, '').replace(/```\s*$/i, '').trim();
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Sentiment: apiKey is required');
  const text = asString(ctx.options.text);
  if (!text) throw new Error('Sentiment: text is required');
  const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = asString(ctx.options.model) || 'gpt-4o-mini';

  const system =
    'You are a sentiment analyser. Reply with a single JSON object containing: ' +
    '"sentiment" (one of "positive","neutral","negative"), ' +
    '"score" (number between -1 and 1 — negative for negative sentiment), ' +
    '"reasoning" (short one-sentence justification). JSON only.';

  const res = await apiRequest({
    service: 'Sentiment',
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

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    try {
      parsed = JSON.parse(stripCodeFences(raw)) as Record<string, unknown>;
    } catch {
      throw new Error('Sentiment: model did not return valid JSON');
    }
  }

  const sentimentRaw = asString(parsed.sentiment).toLowerCase().trim();
  const sentiment = VALID.has(sentimentRaw) ? sentimentRaw : 'neutral';
  const score = typeof parsed.score === 'number' ? parsed.score : Number(parsed.score) || 0;
  const reasoning = asString(parsed.reasoning);

  return {
    outputs: { sentiment, score, reasoning, raw: res.data },
    logs: [`Sentiment → ${sentiment} (${score})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_sentiment',
  name: 'LangChain Sentiment Analysis',
  description: 'Classify text polarity and return sentiment / score / reasoning.',
  iconName: 'LuSmile',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Analyse sentiment',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
