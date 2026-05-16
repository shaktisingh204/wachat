/**
 * Forge block: LangChain Chain (LLM)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/chains/ChainLlm/ChainLlm.node.ts
 *
 * Mustache-style template substitution → chat completion. Replaces `{{name}}`
 * placeholders inside the template with the corresponding key in `variables`
 * before posting to the OpenAI-compatible /chat/completions endpoint.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

function parseVariables(raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (err) {
    throw new Error(`Chain LLM: variables must be a JSON object — ${(err as Error).message}`);
  }
  return {};
}

function fillTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === undefined || v === null) return '';
    return typeof v === 'string' ? v : JSON.stringify(v);
  });
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Chain LLM: apiKey is required');
  const template = asString(ctx.options.template);
  if (!template) throw new Error('Chain LLM: template is required');
  const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = asString(ctx.options.model) || 'gpt-4o-mini';
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const vars = parseVariables(ctx.options.variables);

  const filled = fillTemplate(template, vars);

  const res = await apiRequest({
    service: 'Chain LLM',
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      messages: [{ role: 'user', content: filled }],
      temperature,
    },
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  const text = body?.choices?.[0]?.message?.content ?? '';
  return {
    outputs: { text, prompt: filled, raw: res.data },
    logs: [`Chain LLM → ${model} (${text.length} chars)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_chain_llm',
  name: 'LangChain Chain (LLM)',
  description: 'Fill a prompt template with variables and run it through an LLM.',
  iconName: 'LuLink',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Run chain',
      description: 'Substitute {{var}} placeholders, then call the LLM.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
        { id: 'template', label: 'Prompt template', type: 'textarea', required: true, placeholder: 'Hello {{name}}, summarise {{topic}}…' },
        { id: 'variables', label: 'Variables (JSON object)', type: 'json', placeholder: '{"name":"Ada","topic":"calculus"}' },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
