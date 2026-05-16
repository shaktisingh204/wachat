/**
 * Forge block: Refine Chain
 *
 * LangChain "refine" pattern: iterate over chunks, each step refines the
 * running answer using the next chunk. Falls back to an OpenAI-compatible
 * chat-completions endpoint so it's provider-neutral.
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
        /* ignore */
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
    service: 'Refine Chain',
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
  if (!apiKey) throw new Error('Refine Chain: apiKey is required');
  const baseUrl = asString(ctx.options.baseUrl) || 'https://api.openai.com/v1';
  const model = asString(ctx.options.model) || 'gpt-4o-mini';
  const question = asString(ctx.options.question) || 'Summarise the following content.';
  const initialPrompt =
    asString(ctx.options.initialPrompt) || 'Answer based on this chunk:\n\nQuestion: {{question}}\n\nChunk:\n{{chunk}}';
  const refinePrompt =
    asString(ctx.options.refinePrompt) ||
    'Existing answer:\n{{answer}}\n\nUse the new chunk below to refine the answer. If the chunk adds nothing, return the existing answer unchanged.\n\nQuestion: {{question}}\n\nNew chunk:\n{{chunk}}';
  const temperature = asNumber(ctx.options.temperature) ?? 0;
  const chunks = toTexts(ctx.options.chunks);
  if (chunks.length === 0) throw new Error('Refine Chain: chunks must be a non-empty array');

  let answer = '';
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const tmpl = i === 0 ? initialPrompt : refinePrompt;
    const prompt = tmpl
      .replace(/\{\{\s*question\s*\}\}/g, question)
      .replace(/\{\{\s*chunk\s*\}\}/g, chunk)
      .replace(/\{\{\s*answer\s*\}\}/g, answer);
    answer = await chat(baseUrl, apiKey, model, temperature, prompt);
  }
  return {
    outputs: { answer, chunks: chunks.length },
    logs: [`Refine Chain → ${chunks.length} step(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_chain_refine',
  name: 'Refine Chain',
  description: 'Iteratively refine an answer across an ordered list of text chunks.',
  iconName: 'LuRefreshCcw',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Refine across chunks',
      fields: [
        { id: 'apiKey', label: 'API Key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'gpt-4o-mini' },
        { id: 'question', label: 'Question / task', type: 'textarea' },
        { id: 'chunks', label: 'Chunks (JSON array or "---" separated)', type: 'textarea', required: true },
        { id: 'initialPrompt', label: 'Initial prompt template', type: 'textarea' },
        { id: 'refinePrompt', label: 'Refine prompt template', type: 'textarea' },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0 },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
