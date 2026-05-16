/**
 * Forge block: Map-Reduce Chain
 *
 * Runs a "map" prompt over every input text, then a single "reduce" prompt
 * over the joined map outputs. Backed by any OpenAI-compatible chat endpoint.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

function toTexts(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x)));
  if (typeof v === 'string') {
    const t = v.trim();
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return parsed.map((x) => (typeof x === 'string' ? x : JSON.stringify(x)));
      } catch {
        /* fallthrough */
      }
    }
    return t.split(/\n---+\n/g).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

async function chat(
  baseUrl: string,
  apiKey: string,
  model: string,
  temperature: number,
  prompt: string,
): Promise<string> {
  const result = await apiRequest({
    service: 'Map-Reduce Chain',
    method: 'POST',
    url: `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      temperature,
      messages: [{ role: 'user', content: prompt }],
    },
  });
  const data = result.data as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Map-Reduce: apiKey is required');
  const baseUrl = asString(ctx.options.baseUrl) || 'https://api.openai.com/v1';
  const model = asString(ctx.options.model) || 'gpt-4o-mini';
  const mapPrompt = asString(ctx.options.mapPrompt) || 'Summarise the following text:\n\n{{text}}';
  const reducePrompt =
    asString(ctx.options.reducePrompt) || 'Combine these summaries into one coherent summary:\n\n{{summaries}}';
  const temperature = asNumber(ctx.options.temperature) ?? 0;
  const texts = toTexts(ctx.options.texts);
  if (texts.length === 0) throw new Error('Map-Reduce: texts must be a non-empty array');

  const mapped: string[] = [];
  for (const t of texts) {
    const out = await chat(baseUrl, apiKey, model, temperature, mapPrompt.replace(/\{\{\s*text\s*\}\}/g, t));
    mapped.push(out);
  }
  const reduced = await chat(
    baseUrl,
    apiKey,
    model,
    temperature,
    reducePrompt.replace(/\{\{\s*summaries\s*\}\}/g, mapped.join('\n\n---\n\n')),
  );
  return {
    outputs: { result: reduced, mapped, count: texts.length },
    logs: [`Map-Reduce → mapped ${texts.length} → reduced (${reduced.length} chars)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_chain_map_reduce',
  name: 'Map-Reduce Chain',
  description: 'Map a prompt over a list of texts then reduce the outputs into a single answer.',
  iconName: 'LuShuffle',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Map-Reduce over texts',
      fields: [
        { id: 'apiKey', label: 'API Key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'gpt-4o-mini' },
        { id: 'texts', label: 'Texts (JSON array or "---" separated)', type: 'textarea', required: true },
        { id: 'mapPrompt', label: 'Map prompt (use {{text}})', type: 'textarea' },
        { id: 'reducePrompt', label: 'Reduce prompt (use {{summaries}})', type: 'textarea' },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0 },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
