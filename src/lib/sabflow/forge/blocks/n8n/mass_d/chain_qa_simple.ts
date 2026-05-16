/**
 * Forge block: Simple QA Chain
 *
 * LangChain-style "stuff" QA chain: glue a context blob + question into a
 * single prompt and dispatch to a chat completions endpoint. No model SDKs —
 * any OpenAI-compatible `/v1/chat/completions` endpoint works.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

function buildPrompt(question: string, context: string, system?: string): { role: string; content: string }[] {
  const sys =
    system ||
    'You are a precise question-answering assistant. Use ONLY the context below; if the answer is not present, reply "I don\'t know".';
  const user = `Context:\n"""\n${context}\n"""\n\nQuestion: ${question}\nAnswer:`;
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('QA Chain: apiKey is required');
  const baseUrl = asString(ctx.options.baseUrl) || 'https://api.openai.com/v1';
  const model = asString(ctx.options.model) || 'gpt-4o-mini';
  const question = asString(ctx.options.question);
  const context = asString(ctx.options.context);
  if (!question) throw new Error('QA Chain: question is required');
  if (!context) throw new Error('QA Chain: context is required');
  const system = asString(ctx.options.system) || undefined;
  const temperature = asNumber(ctx.options.temperature) ?? 0;

  const result = await apiRequest({
    service: 'QA Chain',
    method: 'POST',
    url: `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      temperature,
      messages: buildPrompt(question, context, system),
    },
  });

  const data = result.data as { choices?: { message?: { content?: string } }[] };
  const answer = data.choices?.[0]?.message?.content ?? '';
  return { outputs: { answer, raw: data }, logs: [`QA Chain → ${answer.length} chars`] };
}

const block: ForgeBlock = {
  id: 'forge_chain_qa_simple',
  name: 'QA Chain (Simple)',
  description: 'Stuff a question + context into a single chat-completion call and return the answer.',
  iconName: 'LuMessageSquareText',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'ask',
      label: 'Ask question over context',
      fields: [
        { id: 'apiKey', label: 'API Key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'gpt-4o-mini' },
        { id: 'question', label: 'Question', type: 'textarea', required: true },
        { id: 'context', label: 'Context', type: 'textarea', required: true },
        { id: 'system', label: 'System prompt override', type: 'textarea' },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0 },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
