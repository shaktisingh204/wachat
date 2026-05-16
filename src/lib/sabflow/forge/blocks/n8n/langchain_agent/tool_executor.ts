/**
 * Forge block: LangChain Tool Executor (generic)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/tools/* (generic placeholder)
 *
 * Header note: integrates with SabFlow's own tool system later. For now this
 * is a generic LLM-delegated tool executor: given a tool description + args,
 * ask the model to "run" the tool conceptually and return its output. This
 * unblocks Agent flows that need a tool-call sink without bespoke handlers.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function parseJson(raw: unknown, label: string): unknown {
  const s = asString(raw).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch (err) {
    throw new Error(`Tool Executor: ${label} is not valid JSON — ${(err as Error).message}`);
  }
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Tool Executor: apiKey is required');
  const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = asString(ctx.options.model) || 'gpt-4o-mini';

  const toolDefinition = parseJson(ctx.options.tool_definition, 'tool_definition');
  if (!toolDefinition) throw new Error('Tool Executor: tool_definition is required');
  const toolArgs = parseJson(ctx.options.tool_args, 'tool_args') ?? {};

  const system =
    'You are a tool execution simulator. Given a tool definition (name, description, parameter schema) and a set of arguments, ' +
    'produce the tool\'s most likely structured output as a single JSON object. JSON only.';

  const userPrompt = [
    `Tool definition:\n${JSON.stringify(toolDefinition, null, 2)}`,
    `Arguments:\n${JSON.stringify(toolArgs, null, 2)}`,
  ].join('\n\n');

  const res = await apiRequest({
    service: 'Tool Executor',
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
  let output: unknown = raw;
  try {
    output = JSON.parse(raw);
  } catch {
    /* keep raw text */
  }

  return {
    outputs: { output, tool_definition: toolDefinition, tool_args: toolArgs, raw: res.data },
    logs: [`Tool Executor → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_tool_executor',
  name: 'LangChain Tool Executor',
  description: 'Generic LLM-backed tool executor. Will integrate with SabFlow\'s own tool system later.',
  iconName: 'LuWrench',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Execute tool',
      description: 'Simulate execution of a tool definition with the supplied arguments via the LLM.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
        {
          id: 'tool_definition',
          label: 'Tool definition (JSON)',
          type: 'json',
          required: true,
          placeholder: '{"name":"...","description":"...","parameters":{...}}',
        },
        { id: 'tool_args', label: 'Tool arguments (JSON)', type: 'json', placeholder: '{}' },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
