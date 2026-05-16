/**
 * Forge block: LangChain Summarization chain
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/chains/ChainSummarization/ChainSummarization.node.ts
 *
 * Single-shot summarization (the "stuff" strategy). Map-reduce and refine
 * strategies are not ported — the caller can chunk upstream and re-invoke.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const PROMPTS = {
  short:
    'Summarise the text below in 2-3 concise sentences capturing only the most important point.',
  detailed:
    'Summarise the text below as a structured, faithful summary. Preserve numerics, names, and dates. Use Markdown bullets.',
};

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Summarization: apiKey is required');
  const text = asString(ctx.options.text);
  if (!text) throw new Error('Summarization: text is required');
  const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = asString(ctx.options.model) || 'gpt-4o-mini';
  const modeRaw = asString(ctx.options.mode).toLowerCase();
  const mode: 'short' | 'detailed' = modeRaw === 'detailed' ? 'detailed' : 'short';

  const res = await apiRequest({
    service: 'Summarization',
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      messages: [
        { role: 'system', content: PROMPTS[mode] },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
    },
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  const summary = body?.choices?.[0]?.message?.content ?? '';
  return {
    outputs: { summary, mode, raw: res.data },
    logs: [`Summarization → ${mode} (${summary.length} chars)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_chain_summarization',
  name: 'LangChain Summarization',
  description: 'Summarise input text in short or detailed mode.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Summarise',
      description: 'Single-shot summarization (use upstream chunking for long inputs).',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        {
          id: 'mode',
          label: 'Mode',
          type: 'select',
          defaultValue: 'short',
          options: [
            { label: 'Short', value: 'short' },
            { label: 'Detailed', value: 'detailed' },
          ],
        },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
