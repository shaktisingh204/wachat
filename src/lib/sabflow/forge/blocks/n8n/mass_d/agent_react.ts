/**
 * Forge block: ReAct Agent
 *
 * A minimal ReAct (Reason + Act) loop. The agent emits text containing
 * `Thought:`, `Action:`, `Action Input:` lines; the executor parses them, runs
 * the tool (a user-supplied JS map of tool-name → static string output, since
 * we can't safely exec arbitrary tools client-side), feeds back `Observation:`
 * and loops until a `Final Answer:` is emitted (or max iterations).
 *
 * Tools are passed as a JSON map: `{ "search": "search result text…", … }`.
 * For real tool execution wire downstream forge tool blocks via SabFlow.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

type ParsedStep = { thought?: string; action?: string; actionInput?: string; finalAnswer?: string };

function parseStep(text: string): ParsedStep {
  const out: ParsedStep = {};
  const final = /Final Answer:\s*([\s\S]+)$/i.exec(text);
  if (final) out.finalAnswer = final[1].trim();
  const thought = /Thought:\s*([^\n]+)/i.exec(text);
  if (thought) out.thought = thought[1].trim();
  const action = /Action:\s*([^\n]+)/i.exec(text);
  if (action) out.action = action[1].trim();
  const input = /Action Input:\s*([\s\S]*?)(?:\n[A-Z][a-z]+:|$)/i.exec(text);
  if (input) out.actionInput = input[1].trim();
  return out;
}

async function chat(
  baseUrl: string,
  apiKey: string,
  model: string,
  temperature: number,
  messages: { role: string; content: string }[],
): Promise<string> {
  const result = await apiRequest({
    service: 'ReAct Agent',
    method: 'POST',
    url: `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: { model, temperature, messages, stop: ['Observation:'] },
  });
  const data = result.data as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('ReAct Agent: apiKey is required');
  const baseUrl = asString(ctx.options.baseUrl) || 'https://api.openai.com/v1';
  const model = asString(ctx.options.model) || 'gpt-4o-mini';
  const question = asString(ctx.options.question);
  if (!question) throw new Error('ReAct Agent: question is required');
  const maxIter = asNumber(ctx.options.maxIter) ?? 5;
  const temperature = asNumber(ctx.options.temperature) ?? 0;

  let tools: Record<string, string> = {};
  const rawTools = ctx.options.tools;
  if (typeof rawTools === 'string' && rawTools.trim()) {
    try {
      const parsed = JSON.parse(rawTools);
      if (parsed && typeof parsed === 'object') tools = parsed as Record<string, string>;
    } catch {
      throw new Error('ReAct Agent: tools must be valid JSON');
    }
  } else if (rawTools && typeof rawTools === 'object') {
    tools = rawTools as Record<string, string>;
  }

  const toolList = Object.keys(tools).join(', ') || '(none)';
  const sys = `You are a ReAct agent. Use this format strictly:\n\nThought: <reason>\nAction: <one of: ${toolList}>\nAction Input: <input>\nObservation: <will be supplied>\n... (repeat) ...\nThought: I now know the final answer\nFinal Answer: <answer>`;
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: sys },
    { role: 'user', content: question },
  ];
  const trace: ParsedStep[] = [];
  let finalAnswer = '';

  for (let i = 0; i < maxIter; i++) {
    const out = await chat(baseUrl, apiKey, model, temperature, messages);
    const step = parseStep(out);
    trace.push(step);
    if (step.finalAnswer) {
      finalAnswer = step.finalAnswer;
      break;
    }
    const obs = step.action && tools[step.action] !== undefined ? tools[step.action] : `Tool "${step.action ?? ''}" not available`;
    messages.push({ role: 'assistant', content: out });
    messages.push({ role: 'user', content: `Observation: ${obs}` });
  }

  return {
    outputs: { answer: finalAnswer, trace, iterations: trace.length },
    logs: [`ReAct → ${trace.length} step(s), final: ${finalAnswer ? 'yes' : 'no'}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_agent_react',
  name: 'ReAct Agent',
  description: 'Thought/Action/Observation loop using a chat-completion endpoint and a JSON tool map.',
  iconName: 'LuBot',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Run ReAct loop',
      fields: [
        { id: 'apiKey', label: 'API Key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'gpt-4o-mini' },
        { id: 'question', label: 'Question', type: 'textarea', required: true },
        { id: 'tools', label: 'Tools (JSON map: name → result)', type: 'json' },
        { id: 'maxIter', label: 'Max iterations', type: 'number', defaultValue: 5 },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0 },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
