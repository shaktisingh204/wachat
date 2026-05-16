/**
 * Forge block: Plan-and-Execute Agent
 *
 * Two-stage agent: a planner LLM call breaks the goal into ordered steps,
 * then an executor LLM call runs each step. The executor receives a static
 * JSON tool map (same shape as ReAct) for observations. Self-contained — no
 * model SDKs, uses OpenAI-compatible chat completions.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

async function chat(
  baseUrl: string,
  apiKey: string,
  model: string,
  temperature: number,
  messages: { role: string; content: string }[],
): Promise<string> {
  const result = await apiRequest({
    service: 'Plan-Execute Agent',
    method: 'POST',
    url: `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: { model, temperature, messages },
  });
  const data = result.data as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

function parsePlan(text: string): string[] {
  // Accept "1. step", "- step", "* step", or bare lines.
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : [text.trim()];
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Plan-Execute: apiKey is required');
  const baseUrl = asString(ctx.options.baseUrl) || 'https://api.openai.com/v1';
  const model = asString(ctx.options.model) || 'gpt-4o-mini';
  const goal = asString(ctx.options.goal);
  if (!goal) throw new Error('Plan-Execute: goal is required');
  const temperature = asNumber(ctx.options.temperature) ?? 0;

  let tools: Record<string, string> = {};
  const rawTools = ctx.options.tools;
  if (typeof rawTools === 'string' && rawTools.trim()) {
    try {
      const parsed = JSON.parse(rawTools);
      if (parsed && typeof parsed === 'object') tools = parsed as Record<string, string>;
    } catch {
      throw new Error('Plan-Execute: tools must be valid JSON');
    }
  } else if (rawTools && typeof rawTools === 'object') {
    tools = rawTools as Record<string, string>;
  }

  const toolList = Object.keys(tools).join(', ') || '(none)';
  const plannerOut = await chat(baseUrl, apiKey, model, temperature, [
    {
      role: 'system',
      content: 'You are a planner. Break the user goal into 3–6 concise numbered steps. Reply with the list only.',
    },
    { role: 'user', content: goal },
  ]);
  const steps = parsePlan(plannerOut);
  const results: { step: string; output: string }[] = [];
  for (const step of steps) {
    const exec = await chat(baseUrl, apiKey, model, temperature, [
      {
        role: 'system',
        content: `You are an executor. Available tool results (use them when relevant): ${toolList}. Return ONLY the result of executing the step.`,
      },
      { role: 'user', content: `Goal: ${goal}\nStep: ${step}\nTool results JSON: ${JSON.stringify(tools)}` },
    ]);
    results.push({ step, output: exec });
  }

  const final = await chat(baseUrl, apiKey, model, temperature, [
    { role: 'system', content: 'You are a summariser. Combine the step outputs into a single concise final answer.' },
    {
      role: 'user',
      content: `Goal: ${goal}\n\nStep outputs:\n${results.map((r, i) => `${i + 1}. ${r.step}\n→ ${r.output}`).join('\n\n')}`,
    },
  ]);

  return {
    outputs: { plan: steps, results, answer: final },
    logs: [`Plan-Execute → ${steps.length} step(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_agent_plan_execute',
  name: 'Plan-and-Execute Agent',
  description: 'Two-stage agent: plan steps with an LLM, then execute each step and summarise.',
  iconName: 'LuListChecks',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Plan and execute',
      fields: [
        { id: 'apiKey', label: 'API Key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'gpt-4o-mini' },
        { id: 'goal', label: 'Goal', type: 'textarea', required: true },
        { id: 'tools', label: 'Tools (JSON map: name → result)', type: 'json' },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0 },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
