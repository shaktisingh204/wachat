/**
 * Core types for the SabNode AI Agent Ecosystem.
 *
 * Agents are model-driven workers that loop over LLM calls + tool invocations.
 * Each agent has a stable id, a model, a system prompt, a list of available
 * tools, and optional memory configuration.
 */

import { z } from 'genkit';

/**
 * A function-style tool the agent may invoke. Parameters are described with
 * a Zod schema, which Genkit converts to JSON Schema for the model.
 */
export interface Tool<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O = unknown,
> {
  name: string;
  description: string;
  parameters: I;
  /**
   * Run the tool with validated args. The runtime context provides per-run
   * data (tenant, userId, memory) and is opaque to the model.
   */
  run: (args: z.infer<I>, ctx: AgentRunContext) => Promise<O>;
}

/** Erased tool type used in collections to avoid generic propagation. */
export type AnyTool = Tool<z.ZodTypeAny, unknown>;

/** Memory configuration for an agent. */
export interface AgentMemoryConfig {
  /** Hard cap on short-term entries kept in RAM during a run. */
  shortTermLimit?: number;
  /** Whether long-term memory is persisted in `agent_memories` Mongo collection. */
  longTerm?: boolean;
  /** Optional namespace for long-term memory rows. Defaults to agent.id. */
  namespace?: string;
}

/** Per-run budget guardrails. */
export interface AgentBudget {
  /** Max LLM turns (tool round-trips). */
  maxTurns?: number;
  /** Max tool invocations across the run. */
  maxToolCalls?: number;
  /** Wall-clock deadline in ms from start. */
  timeoutMs?: number;
}

/** Definition of an agent. */
export interface Agent {
  id: string;
  name: string;
  description: string;
  /** Genkit model identifier, e.g. `googleai/gemini-1.5-flash`. */
  model: string;
  /** Tool names from the global tool registry, or inline Tool objects. */
  tools: Array<string | AnyTool>;
  systemPrompt: string;
  memory?: AgentMemoryConfig;
  budget?: AgentBudget;
  /** Optional model-specific config (temperature, etc). */
  modelConfig?: Record<string, unknown>;
}

/** A single message exchanged during an agent run. */
export interface AgentMessage {
  role: 'system' | 'user' | 'model' | 'tool';
  content: string;
  /** Populated when role === 'tool' */
  toolName?: string;
  /** Tool call arguments (for model role) or tool result (for tool role). */
  data?: unknown;
  ts: number;
}

/** Per-run context passed to tools. */
export interface AgentRunContext {
  runId: string;
  agentId: string;
  /** Tenant identifier — usually a Mongo ObjectId string. */
  tenantId?: string;
  userId?: string;
  /** Short-term memory for this run only. */
  shortTerm: Map<string, unknown>;
  /** Append a structured trace entry; runner uses this. */
  trace: (msg: AgentMessage) => void;
  /** Tool budget tracker. */
  toolCallsRemaining: number;
  /** Free-form metadata supplied by the caller. */
  meta?: Record<string, unknown>;
}

/** Result of a complete agent run. */
export interface AgentRun {
  runId: string;
  agentId: string;
  startedAt: number;
  finishedAt: number;
  input: string;
  output: string;
  transcript: AgentMessage[];
  toolCalls: number;
  turns: number;
  /** Set when the run failed or was cut short. */
  error?: string;
  /** True when the budget halted execution. */
  budgetExceeded?: boolean;
}

/** A single eval example. */
export interface AgentEval {
  input: string;
  expected: string;
  /** "exact" | "contains" | "llm" — how the result is judged. */
  judge: 'exact' | 'contains' | 'llm';
  /** Optional metadata attached to the example. */
  meta?: Record<string, unknown>;
}

/** Aggregate eval result. */
export interface EvalResult {
  agentId: string;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  details: Array<{
    input: string;
    expected: string;
    actual: string;
    pass: boolean;
    reason?: string;
  }>;
}
