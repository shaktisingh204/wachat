/**
 * Forge block: LangChain Tool — Wolfram Alpha
 *
 * Source: @n8n/nodes-langchain/nodes/tools/ToolWolframAlpha/
 *
 * The short-answer endpoint `api.wolframalpha.com/v1/result` returns a plain
 * text response. App-id is inlined per action.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

async function query(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const appId = asString(ctx.options.appId).trim();
  const input = asString(ctx.options.input).trim();
  if (!appId) throw new Error('Wolfram Alpha: appId is required');
  if (!input) throw new Error('Wolfram Alpha: input is required');

  const url =
    `https://api.wolframalpha.com/v1/result?appid=${encodeURIComponent(appId)}&i=${encodeURIComponent(input)}`;

  const res = await apiRequest({
    service: 'Wolfram Alpha',
    method: 'GET',
    url,
    throwOnError: false,
  });

  // The endpoint returns 200 + text on success and 501 on "no result".
  if (!res.ok && res.status !== 501) {
    const clip = res.text.length > 200 ? `${res.text.slice(0, 200)}…` : res.text;
    throw new Error(`Wolfram Alpha failed (${res.status}): ${clip}`);
  }

  const answer = res.ok ? asString(res.text) : '';
  return {
    outputs: { answer, text: answer, ok: res.ok, status: res.status },
    logs: [`Wolfram Alpha "${input}" → ${res.status}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_wolframalpha',
  name: 'LangChain Tool — Wolfram Alpha',
  description: 'Answer factual / computational questions via Wolfram Alpha v1/result.',
  iconName: 'LuFunctionSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'query',
      label: 'Ask Wolfram Alpha',
      fields: [
        { id: 'appId', label: 'App ID', type: 'password', required: true },
        { id: 'input', label: 'Question', type: 'text', required: true, placeholder: 'population of France' },
      ],
      run: query,
    },
  ],
};

registerForgeBlock(block);
export default block;
