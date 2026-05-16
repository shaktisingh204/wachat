/**
 * Forge block: OpenAI Assistant
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/agents/OpenAiAssistant/OpenAiAssistant.node.ts
 *
 * Wraps OpenAI's Assistants v2 thread/run flow as a single synchronous call:
 *   1. Create a thread if `thread_id` is empty.
 *   2. Append the user's message.
 *   3. Start a run.
 *   4. Poll until the run completes (or fails / requires action).
 *   5. Fetch the latest assistant message and return it.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const ASSISTANTS_HEADERS = { 'OpenAI-Beta': 'assistants=v2' };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('OpenAI Assistant: apiKey is required');
  const assistantId = asString(ctx.options.assistant_id);
  if (!assistantId) throw new Error('OpenAI Assistant: assistant_id is required');
  const userMessage = asString(ctx.options.user_message);
  if (!userMessage) throw new Error('OpenAI Assistant: user_message is required');
  const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const pollInterval = asNumber(ctx.options.poll_interval_ms) ?? 1000;
  const maxWaitMs = asNumber(ctx.options.max_wait_ms) ?? 120000;

  const auth = {
    Authorization: `Bearer ${apiKey}`,
    ...ASSISTANTS_HEADERS,
  };

  // 1. Resolve thread.
  let threadId = asString(ctx.options.thread_id);
  if (!threadId) {
    const created = await apiRequest({
      service: 'OpenAI Assistant',
      method: 'POST',
      url: `${baseUrl}/threads`,
      headers: auth,
      json: {},
    });
    threadId = (created.data as { id?: string })?.id ?? '';
    if (!threadId) throw new Error('OpenAI Assistant: failed to create thread');
  }

  // 2. Post user message.
  await apiRequest({
    service: 'OpenAI Assistant',
    method: 'POST',
    url: `${baseUrl}/threads/${threadId}/messages`,
    headers: auth,
    json: { role: 'user', content: userMessage },
  });

  // 3. Start a run.
  const started = await apiRequest({
    service: 'OpenAI Assistant',
    method: 'POST',
    url: `${baseUrl}/threads/${threadId}/runs`,
    headers: auth,
    json: { assistant_id: assistantId },
  });
  const runId = (started.data as { id?: string })?.id ?? '';
  if (!runId) throw new Error('OpenAI Assistant: failed to start run');

  // 4. Poll.
  const deadline = Date.now() + maxWaitMs;
  let status = (started.data as { status?: string })?.status ?? 'queued';
  let lastBody: unknown = started.data;
  while (Date.now() < deadline) {
    if (status === 'completed') break;
    if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      throw new Error(`OpenAI Assistant: run ${status}`);
    }
    if (status === 'requires_action') {
      return {
        outputs: {
          thread_id: threadId,
          run_id: runId,
          status,
          requires_action: true,
          raw: lastBody,
        },
        logs: [`OpenAI Assistant → requires_action (thread ${threadId})`],
      };
    }
    await sleep(pollInterval);
    const polled = await apiRequest({
      service: 'OpenAI Assistant',
      method: 'GET',
      url: `${baseUrl}/threads/${threadId}/runs/${runId}`,
      headers: auth,
    });
    lastBody = polled.data;
    status = (polled.data as { status?: string })?.status ?? status;
  }

  if (status !== 'completed') {
    throw new Error(`OpenAI Assistant: timed out waiting for run (last status: ${status})`);
  }

  // 5. Fetch latest assistant message.
  const messages = await apiRequest({
    service: 'OpenAI Assistant',
    method: 'GET',
    url: `${baseUrl}/threads/${threadId}/messages?limit=10&order=desc`,
    headers: auth,
  });
  const list = (messages.data as {
    data?: Array<{
      role?: string;
      content?: Array<{ type?: string; text?: { value?: string } }>;
    }>;
  })?.data ?? [];
  const assistantMsg = list.find((m) => m.role === 'assistant');
  const text = (assistantMsg?.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text?.value ?? '')
    .join('\n');

  return {
    outputs: {
      thread_id: threadId,
      run_id: runId,
      status,
      content: text,
      messages: list,
      raw: messages.data,
    },
    logs: [`OpenAI Assistant → completed (thread ${threadId})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_openai_assistant',
  name: 'OpenAI Assistant',
  description: 'Run an OpenAI Assistant against a thread (creates one if missing) and return the reply.',
  iconName: 'LuBot',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Run assistant',
      description: 'Append a user message and wait for the assistant to reply.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'assistant_id', label: 'Assistant ID', type: 'text', required: true },
        { id: 'thread_id', label: 'Thread ID (optional, created if blank)', type: 'text' },
        { id: 'user_message', label: 'User message', type: 'textarea', required: true },
        { id: 'poll_interval_ms', label: 'Poll interval (ms)', type: 'number', defaultValue: 1000 },
        { id: 'max_wait_ms', label: 'Max wait (ms)', type: 'number', defaultValue: 120000 },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
