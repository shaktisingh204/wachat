/**
 * Forge block: LangChain Agent (tool-use)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/agents/Agent/Agent.node.ts
 *
 * n8n's Agent node runs a multi-step tool-calling loop in-process. That is too
 * complex for v1 here — instead we expose a single LLM call that surfaces the
 * model's tool selection back to the flow. The caller is expected to execute
 * the chosen tool and feed the result back via a subsequent run if it wants
 * multi-turn behaviour.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

type OpenAIToolCall = {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason?: string;
  }>;
};

function parseJsonField(raw: unknown, label: string): unknown {
  const s = asString(raw).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch (err) {
    throw new Error(`Agent: failed to parse ${label} as JSON — ${(err as Error).message}`);
  }
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Agent: apiKey is required');
  const userMessage = asString(ctx.options.user_message);
  if (!userMessage) throw new Error('Agent: user_message is required');
  const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = asString(ctx.options.model) || 'gpt-4o-mini';
  const systemPrompt = asString(ctx.options.system_prompt);
  const maxIterations = asNumber(ctx.options.max_iterations) ?? 1;

  const tools = parseJsonField(ctx.options.tools, 'tools') as unknown[] | undefined;

  const messages: Array<Record<string, unknown>> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userMessage });

  const payload: Record<string, unknown> = { model, messages };
  if (Array.isArray(tools) && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = 'auto';
  }

  const res = await apiRequest({
    service: 'Agent',
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: payload,
  });
  const body = res.data as OpenAIChatResponse;
  const choice = body?.choices?.[0];
  const toolCalls = choice?.message?.tool_calls ?? [];

  if (toolCalls.length > 0) {
    const call = toolCalls[0];
    let args: unknown = call.function?.arguments ?? '';
    try {
      args = JSON.parse(call.function?.arguments ?? '');
    } catch {
      /* keep raw */
    }
    return {
      outputs: {
        tool_call_pending: true,
        tool_name: call.function?.name ?? '',
        tool_args: args,
        tool_call_id: call.id ?? '',
        all_tool_calls: toolCalls,
        raw: res.data,
      },
      logs: [`Agent → tool call: ${call.function?.name} (iter limit ${maxIterations})`],
    };
  }

  return {
    outputs: {
      tool_call_pending: false,
      content: choice?.message?.content ?? '',
      raw: res.data,
    },
    logs: [`Agent → final answer (${model})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_agent',
  name: 'LangChain Agent',
  description: 'Single-step tool-using agent. Returns either a tool call or a final answer.',
  iconName: 'LuBot',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Run agent step',
      description: 'Run one agent step. If the model selects a tool, surface it for the caller to execute.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
        { id: 'system_prompt', label: 'System prompt', type: 'textarea' },
        { id: 'user_message', label: 'User message', type: 'textarea', required: true },
        {
          id: 'tools',
          label: 'Tools (OpenAI function-call schema, JSON array)',
          type: 'json',
          placeholder: '[{"type":"function","function":{"name":"...","description":"...","parameters":{...}}}]',
        },
        { id: 'max_iterations', label: 'Max iterations (advisory)', type: 'number', defaultValue: 1 },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
