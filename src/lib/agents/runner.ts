/**
 * Agent runner.
 *
 * Bridges our `Tool` abstraction onto Genkit's tool-calling protocol and
 * drives the LLM round-trip loop until the model produces a final answer or
 * the budget is exhausted.
 *
 * Genkit's `generate({ tools, maxTurns })` already implements the canonical
 * "LLM call → tool call → result → LLM call" loop. We wrap each of our tools
 * as a Genkit tool whose body invokes our `Tool.run` with a per-run context,
 * and we record every tool invocation into the run transcript via that
 * context. The final `generate` response yields the assistant text plus a
 * full message history.
 */

import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'genkit';

import { ai } from '@/ai/genkit';
import { getAgent, getTool } from './registry';
import { ShortTermMemory } from './memory';
import type {
  Agent,
  AgentMessage,
  AgentRun,
  AgentRunContext,
  AnyTool,
} from './types';

const DEFAULT_MAX_TURNS = 6;
const DEFAULT_MAX_TOOL_CALLS = 16;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_SHORT_TERM_LIMIT = 64;

export interface RunOptions {
  tenantId?: string;
  userId?: string;
  meta?: Record<string, unknown>;
  /** Override the agent's configured model. */
  model?: string;
  /** Inject extra messages (e.g. prior turns from a chat session). */
  history?: Array<{ role: 'user' | 'model'; content: string }>;
}

/** Resolve agent.tools (mix of names and inline tools) to concrete tool objects. */
function resolveTools(agent: Agent): AnyTool[] {
  const out: AnyTool[] = [];
  for (const entry of agent.tools) {
    if (typeof entry === 'string') {
      const t = getTool(entry);
      if (!t) {
        throw new Error(`Agent ${agent.id} references unknown tool '${entry}'`);
      }
      out.push(t);
    } else {
      out.push(entry);
    }
  }
  return out;
}

/**
 * Wrap each of our `Tool` objects as a Genkit tool bound to a specific run.
 *
 * Genkit's tool actions are just `(input) => result`, so we capture the run
 * context in the closure. Each invocation:
 *  - decrements the per-run tool budget,
 *  - records a `model` (request) and `tool` (response) message in the
 *    transcript via `ctx.trace`.
 */
function buildGenkitTools(tools: AnyTool[], ctx: AgentRunContext) {
  return tools.map((tool) =>
    ai.defineTool(
      {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
        outputSchema: z.any(),
      },
      async (input: unknown) => {
        if (ctx.toolCallsRemaining <= 0) {
          const err = `Tool budget exhausted; refusing call to ${tool.name}`;
          ctx.trace({
            role: 'tool',
            content: err,
            toolName: tool.name,
            data: { error: true },
            ts: Date.now(),
          });
          return { error: err };
        }
        ctx.toolCallsRemaining -= 1;
        ctx.trace({
          role: 'model',
          content: `tool_call:${tool.name}`,
          toolName: tool.name,
          data: input,
          ts: Date.now(),
        });
        try {
          const result = await tool.run(input as never, ctx);
          ctx.trace({
            role: 'tool',
            content: typeof result === 'string' ? result : JSON.stringify(result),
            toolName: tool.name,
            data: result,
            ts: Date.now(),
          });
          return result as never;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          ctx.trace({
            role: 'tool',
            content: `error: ${message}`,
            toolName: tool.name,
            data: { error: message },
            ts: Date.now(),
          });
          return { error: message } as never;
        }
      },
    ),
  );
}

/** Map a Genkit `MessageData` content array to a flat string. */
function messageToText(parts: ReadonlyArray<unknown>): string {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => {
      const part = p as { text?: string; toolRequest?: unknown; toolResponse?: unknown };
      if (typeof part.text === 'string') return part.text;
      if (part.toolRequest) return `[tool_request]`;
      if (part.toolResponse) return `[tool_response]`;
      return '';
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Runs the agent. Throws only on configuration errors (missing agent or
 * tool); LLM errors are captured into `AgentRun.error` and the partial
 * transcript is returned.
 */
export async function runAgent(
  agentId: string,
  input: string,
  options: RunOptions = {},
): Promise<AgentRun> {
  const agent = getAgent(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const startedAt = Date.now();
  const runId = randomUUID();
  const transcript: AgentMessage[] = [];

  const budget = agent.budget ?? {};
  const maxTurns = budget.maxTurns ?? DEFAULT_MAX_TURNS;
  const maxToolCalls = budget.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS;
  const timeoutMs = budget.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const shortTermLimit = agent.memory?.shortTermLimit ?? DEFAULT_SHORT_TERM_LIMIT;

  const shortTerm = new ShortTermMemory<unknown>(shortTermLimit);
  const ctx: AgentRunContext = {
    runId,
    agentId,
    tenantId: options.tenantId,
    userId: options.userId,
    shortTerm: shortTerm.asMap(),
    toolCallsRemaining: maxToolCalls,
    meta: options.meta,
    trace: (msg) => transcript.push(msg),
  };

  ctx.trace({ role: 'system', content: agent.systemPrompt, ts: Date.now() });
  ctx.trace({ role: 'user', content: input, ts: startedAt });

  const tools = resolveTools(agent);
  const genkitTools = buildGenkitTools(tools, ctx);

  const messages = (options.history ?? []).map((h) => ({
    role: h.role,
    content: [{ text: h.content }],
  }));

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  let outputText = '';
  let error: string | undefined;
  let budgetExceeded = false;
  let turns = 0;

  try {
    const response = await ai.generate({
      model: options.model ?? agent.model,
      system: agent.systemPrompt,
      prompt: input,
      messages: messages.length ? messages : undefined,
      tools: genkitTools,
      maxTurns,
      config: agent.modelConfig,
      abortSignal: abort.signal,
    });

    outputText = response.text ?? '';
    // `messages` includes the full transcript (system + user + model + tool).
    // Append model-side messages we don't already have for richer auditing.
    const respMessages = (response.messages ?? []) as Array<{
      role: string;
      content: ReadonlyArray<unknown>;
    }>;
    for (const m of respMessages) {
      if (m.role !== 'model') continue;
      const text = messageToText(m.content);
      if (!text) continue;
      transcript.push({ role: 'model', content: text, ts: Date.now() });
    }
    turns = respMessages.filter((m) => m.role === 'model').length;
    if (ctx.toolCallsRemaining <= 0) budgetExceeded = true;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    if (abort.signal.aborted) {
      budgetExceeded = true;
      error = `timeout after ${timeoutMs}ms`;
    }
    transcript.push({ role: 'model', content: `[error] ${error}`, ts: Date.now() });
  } finally {
    clearTimeout(timer);
  }

  const finishedAt = Date.now();
  return {
    runId,
    agentId,
    startedAt,
    finishedAt,
    input,
    output: outputText,
    transcript,
    toolCalls: maxToolCalls - ctx.toolCallsRemaining,
    turns,
    error,
    budgetExceeded: budgetExceeded || undefined,
  };
}
