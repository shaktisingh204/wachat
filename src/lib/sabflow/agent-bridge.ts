/**
 * Agent ↔ SabFlow bridge.
 *
 * Glue layer that lets a SabFlow block invoke an AI Agent (built by Impl 4 in
 * `@/lib/agents`) and consume its output as if it were any other block result.
 *
 * Responsibilities:
 *  - Resolve {{variable}} tokens in the block's input template against the
 *    flow's current variable scope.
 *  - Call into the agents runner with a per-call budget (timeoutMs, max-cost).
 *  - Persist the agent transcript into the flow run-data collection so it
 *    shows up in the flow's run history alongside block-level traces.
 *  - Return a minimal `{ output, transcript, cost }` shape that the calling
 *    block can spread into the engine's `BlockExecutionResult`.
 *
 * Impl 4 dependency:
 *   At time of writing, `@/lib/agents` is expected to expose `runAgent` and
 *   `listAgents`. If those are missing at runtime, this module falls back to
 *   a stub that emits a `console.warn` so the rest of the flow keeps working
 *   in isolation tests.
 */

import { substituteVariables } from './engine/substituteVariables';

/* ── Types we expect from `@/lib/agents` ─────────────────────────────────── */
/**
 * Mirror of `AgentRun` from `@/lib/agents/types`. Re-declared here so this
 * module compiles even if Impl 4 ships later or renames internal types.
 */
export interface AgentRunSummary {
  runId: string;
  agentId: string;
  startedAt: number;
  finishedAt: number;
  input: string;
  output: string;
  transcript: Array<{
    role: 'system' | 'user' | 'model' | 'tool';
    content: string;
    toolName?: string;
    data?: unknown;
    ts: number;
  }>;
  toolCalls: number;
  turns: number;
  error?: string;
  budgetExceeded?: boolean;
  /** Approximate cost in USD-cents reported by the runner (when available). */
  costCents?: number;
}

/** Options copied off the block at call time. Strings are pre-resolved. */
export interface AgentBlockOptions {
  /** Registered agent id (e.g. `sales-sdr`). */
  agentId?: string;
  /** Free-text template with {{variable}} placeholders. */
  inputTemplate?: string;
  /** Variable name (or id) in which to store agent.output. */
  outputVariable?: string;
  /** Override the agent's default timeout. */
  timeoutMs?: number;
  /** Halt the run if estimated cost exceeds this many cents. */
  maxCostCents?: number;
  /** When true, the agent picks an outgoing edge label instead of free text. */
  branchMode?: boolean;
  /** Branch labels available to the agent (used by agent-conditional). */
  branchLabels?: string[];
}

/** Slim view of the SabFlow execution context we need at the bridge layer. */
export interface SabflowAgentContext {
  /** Current resolved variables map (string-serialised). */
  variables: Record<string, string>;
  /** Optional tenant id (workspace) — forwarded to the agent runner. */
  tenantId?: string;
  /** Optional acting user id. */
  userId?: string;
  /** Optional flow run id — used to scope persisted transcripts. */
  runId?: string;
  /** Optional flow id — used to scope persisted transcripts. */
  flowId?: string;
  /**
   * Optional override hook for tests. When supplied the bridge calls this
   * instead of importing `@/lib/agents`.
   */
  agentRunner?: AgentRunner;
  /**
   * Optional persistence hook for tests. When supplied the bridge calls this
   * instead of writing to Mongo.
   */
  persistTranscript?: TranscriptPersister;
}

export type AgentRunner = (
  agentId: string,
  input: string,
  options: {
    tenantId?: string;
    userId?: string;
    timeoutMs?: number;
    maxCostCents?: number;
    meta?: Record<string, unknown>;
  },
) => Promise<AgentRunSummary>;

export type TranscriptPersister = (record: PersistedTranscript) => Promise<void>;

export interface PersistedTranscript {
  flowId?: string;
  runId?: string;
  blockAgentId: string;
  agentRunId: string;
  startedAt: number;
  finishedAt: number;
  output: string;
  costCents: number;
  transcript: AgentRunSummary['transcript'];
  error?: string;
}

export interface AgentBridgeResult {
  /** The agent's final assistant text. Empty string when the run errored. */
  output: string;
  /** Full transcript for downstream UI (already persisted by this call). */
  transcript: AgentRunSummary['transcript'];
  /** Approx cost in USD-cents. 0 when the runner does not report cost. */
  cost: number;
  /** Selected branch label — only populated in branch mode. */
  branchLabel?: string;
  /** Run id — for cross-referencing in the UI. */
  agentRunId: string;
  /** Whether the bridge stubbed the call because Impl 4 is missing. */
  stubbed?: boolean;
  /** Captured runner error (if any). */
  error?: string;
}

/* ── Lazy import wrapper around `@/lib/agents` ───────────────────────────── */

type AgentsModule = {
  runAgent?: (
    agentId: string,
    input: string,
    options?: {
      tenantId?: string;
      userId?: string;
      meta?: Record<string, unknown>;
      model?: string;
    },
  ) => Promise<AgentRunSummary>;
};

let cachedRunner: AgentRunner | null = null;

/**
 * Resolve the agent runner from `@/lib/agents`. If the module is missing, the
 * runner returns a stubbed result so the bridge stays callable.
 */
async function resolveDefaultRunner(): Promise<AgentRunner> {
  if (cachedRunner) return cachedRunner;
  try {
    const mod = (await import('@/lib/agents')) as AgentsModule;
    if (typeof mod.runAgent === 'function') {
      const realRunner = mod.runAgent;
      cachedRunner = async (agentId, input, options) => {
        const run = await realRunner(agentId, input, {
          tenantId: options.tenantId,
          userId: options.userId,
          meta: options.meta,
        });
        return run;
      };
      return cachedRunner;
    }
  } catch {
    // fall through to stub
  }
  console.warn(
    '[sabflow/agent-bridge] @/lib/agents.runAgent unavailable — using stub runner. ' +
      'Impl 4 has not shipped yet; agent blocks will return an empty result.',
  );
  cachedRunner = async (agentId, input) => ({
    runId: `stub-${Date.now()}`,
    agentId,
    startedAt: Date.now(),
    finishedAt: Date.now(),
    input,
    output: '',
    transcript: [
      {
        role: 'system',
        content: '[stub] @/lib/agents not implemented yet',
        ts: Date.now(),
      },
    ],
    toolCalls: 0,
    turns: 0,
    error: 'agents-module-missing',
  });
  return cachedRunner;
}

/* ── Default Mongo persistence (no-op in tests) ──────────────────────────── */

async function defaultPersistTranscript(record: PersistedTranscript): Promise<void> {
  // Avoid bringing Mongo into the unit-test path: only persist when the env
  // actually has a connection (Next.js runtime). In Node/test environments
  // that import this file directly, the dynamic import is allowed to fail.
  try {
    const mongo = (await import('@/lib/mongodb')) as {
      connectToDatabase?: () => Promise<{ db: { collection: (n: string) => unknown } }>;
    };
    if (typeof mongo.connectToDatabase !== 'function') return;
    const { db } = await mongo.connectToDatabase();
    const col = db.collection('flow_run_agent_transcripts') as {
      insertOne: (d: unknown) => Promise<unknown>;
    };
    await col.insertOne({ ...record, createdAt: new Date() });
  } catch (e) {
    // Persistence is best-effort — never block the flow on a logging miss.
    console.warn('[sabflow/agent-bridge] failed to persist transcript:', e);
  }
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Resolve the input template against the flow's variable scope. */
export function resolveAgentInput(
  template: string | undefined,
  variables: Record<string, string>,
): string {
  if (!template) return '';
  return substituteVariables(template, variables);
}

/**
 * Pick a branch label from the agent's free-text output. Returns the first
 * label whose lower-cased name appears in the output, or `undefined` when no
 * label matches. The caller is expected to fall back to the default edge.
 */
export function pickBranchLabel(
  output: string,
  labels: ReadonlyArray<string>,
): string | undefined {
  if (!output) return undefined;
  const lower = output.toLowerCase();
  // Prefer exact-line matches (the agent is told to answer with one label).
  for (const label of labels) {
    const trimmed = output.trim().toLowerCase();
    if (trimmed === label.toLowerCase()) return label;
  }
  // Fall back to substring lookup ordered by label length (longest first) so
  // 'high-priority' is matched before 'high'.
  const ordered = [...labels].sort((a, b) => b.length - a.length);
  for (const label of ordered) {
    if (lower.includes(label.toLowerCase())) return label;
  }
  return undefined;
}

/* ── Main entry point ────────────────────────────────────────────────────── */

/**
 * Run an AI agent inside a SabFlow execution and return a normalised result.
 *
 * Throws only on configuration errors (no agent id selected). Runtime errors
 * from the agent runner are captured in `result.error` so the engine's
 * onError strategies still drive routing.
 */
export async function runAgentInFlow(
  blockOptions: AgentBlockOptions,
  ctx: SabflowAgentContext,
): Promise<AgentBridgeResult> {
  const agentId = blockOptions.agentId?.trim();
  if (!agentId) {
    throw new Error('runAgentInFlow: agentId is required');
  }

  const runner = ctx.agentRunner ?? (await resolveDefaultRunner());
  const persist = ctx.persistTranscript ?? defaultPersistTranscript;

  const input = resolveAgentInput(blockOptions.inputTemplate, ctx.variables);
  const startedAt = Date.now();

  let run: AgentRunSummary;
  try {
    run = await runner(agentId, input, {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      timeoutMs: blockOptions.timeoutMs,
      maxCostCents: blockOptions.maxCostCents,
      meta: { source: 'sabflow', flowId: ctx.flowId, runId: ctx.runId },
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    run = {
      runId: `errored-${Date.now()}`,
      agentId,
      startedAt,
      finishedAt: Date.now(),
      input,
      output: '',
      transcript: [
        { role: 'system', content: `[bridge-error] ${err}`, ts: Date.now() },
      ],
      toolCalls: 0,
      turns: 0,
      error: err,
    };
  }

  const cost = typeof run.costCents === 'number' ? run.costCents : 0;

  // Enforce client-side max-cost check. The runner is the source of truth for
  // budget enforcement, but we double-check so an old runner doesn't silently
  // overshoot. We don't refund — costs are already incurred — but we mark the
  // result as errored so the block can take its 'error' edge.
  let costError: string | undefined;
  if (
    typeof blockOptions.maxCostCents === 'number' &&
    blockOptions.maxCostCents >= 0 &&
    cost > blockOptions.maxCostCents
  ) {
    costError = `agent run cost ${cost}¢ exceeded max ${blockOptions.maxCostCents}¢`;
  }

  const branchLabel =
    blockOptions.branchMode && blockOptions.branchLabels?.length
      ? pickBranchLabel(run.output, blockOptions.branchLabels)
      : undefined;

  // Persist the transcript (best-effort).
  await persist({
    flowId: ctx.flowId,
    runId: ctx.runId,
    blockAgentId: agentId,
    agentRunId: run.runId,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    output: run.output,
    costCents: cost,
    transcript: run.transcript,
    error: run.error ?? costError,
  });

  return {
    output: run.output,
    transcript: run.transcript,
    cost,
    branchLabel,
    agentRunId: run.runId,
    stubbed: run.error === 'agents-module-missing' || undefined,
    error: run.error ?? costError,
  };
}
