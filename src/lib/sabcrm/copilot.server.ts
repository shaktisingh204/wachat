import 'server-only';

/**
 * SabCRM — agentic copilot LOOP (server-only).
 *
 * Implements the plan→retrieve(RAG)→call-tools→observe agent loop over the
 * EXISTING SabCRM MCP tool registry. Nothing here redefines a CRM operation:
 *   - retrieval reuses the keyword+semantic RAG (`./crm-rag.server` →
 *     `semanticSearch` / keyword fallback, ACL-scoped) for the grounding block,
 *   - reasoning reuses the single LLM access ladder (`./ai-llm.server`
 *     `generateSabcrmText` — never a raw provider SDK),
 *   - tool execution reuses the MCP tool handlers in
 *     `@/lib/api-platform/mcp/sabcrm-tools` (`SABCRM_TOOL_MAP`), which run the
 *     same Rust SabCRM engine the dashboard uses, as the caller's user.
 *
 * Trust layer (defence in depth):
 *   - the CALLER's RBAC decides `canWrite` (the action gate already proved
 *     `view`); write tools are refused in-prompt AND at execution when the user
 *     lacks `edit`,
 *   - the model can never widen scope — `decideToolCall` forces the caller's
 *     `projectId` onto every tool call (the MCP tool's own membership check
 *     then re-validates), and the MCP handlers run `as-user`, so reads stay
 *     ACL-scoped exactly as the dashboard,
 *   - a step budget bounds the loop; the guardrail screens the question first.
 *
 * Metering: each LLM turn checks `canUse('ai_requests')` and records one
 * idempotency-keyed `ai_requests` unit. The retrieval embedding (if any) is the
 * RAG's own cost; we meter the agent's reasoning turns explicitly.
 *
 * Honest degradation: no LLM provider key → first turn returns the ladder's
 * "AI is not configured" error; no embeddings → keyword retrieval; budget
 * exhausted without a final → we ask the model for a best-effort summary of
 * what it found and return that.
 */

import { randomUUID } from 'crypto';

import { canServer } from '@/lib/rbac-server';
import { canUse } from '@/lib/billing/entitlements';
import { recordUsage } from '@/lib/billing/usage-meter';

import { generateSabcrmText } from './ai-llm.server';
import { semanticSearch } from './embeddings.server';
import { listRecords } from './records.server';
import { listObjects } from './objects.server';
import {
  rankCandidates,
  buildGroundingContext,
  type RagCandidate,
} from './crm-rag';
import {
  buildSystemPrompt,
  buildUserTurn,
  buildObservationTurn,
  parseModelReply,
  decideToolCall,
  clampMaxSteps,
  checkText,
  type CopilotStep,
  type ToolBrief,
  type ToolPolicy,
} from './copilot';

import { SABCRM_TOOL_MAP, type McpTool } from '@/lib/api-platform/mcp/sabcrm-tools';

const MODULE_KEY = 'sabcrm';

/* ── Public result shape ──────────────────────────────────────────────────── */

export interface CopilotRunResult {
  ok: boolean;
  /** The final natural-language answer (or an error/notice). */
  answer: string;
  /** The full reasoning + tool-call transcript the UI renders. */
  steps: CopilotStep[];
  /** Distinct tool names that were actually executed. */
  toolsUsed: string[];
  /** Set when the loop stopped because the step budget ran out. */
  budgetExhausted?: boolean;
  /** Set when the model never produced a parseable action/answer. */
  error?: string;
}

export interface RunCopilotOptions {
  maxSteps?: number;
}

/* ── Retrieval (reuse the RAG) ────────────────────────────────────────────── */

/** Max objects/records scanned for the keyword fallback. */
const MAX_OBJECTS = 6;
const PER_OBJECT = 6;
const RETRIEVE_TOP_K = 10;

/** Owner-scoped keyword retrieval (mirrors crm-rag.server's keywordRetrieve). */
async function keywordRetrieve(
  projectId: string,
  userId: string,
  q: string,
): Promise<RagCandidate[]> {
  const candidates: RagCandidate[] = [];
  try {
    const objects = await listObjects(projectId);
    for (const obj of objects.slice(0, MAX_OBJECTS)) {
      try {
        const page = await listRecords(projectId, userId, {
          object: obj.slug,
          search: q,
          pageSize: PER_OBJECT,
        });
        for (const r of page.records) {
          candidates.push({ id: r._id, object: obj.slug, label: r.label, data: r.data ?? {} });
        }
      } catch {
        /* skip an object that fails to search */
      }
    }
  } catch {
    /* no objects / engine down → empty */
  }
  return rankCandidates(candidates, q, RETRIEVE_TOP_K);
}

/**
 * Build the grounding context block: prefer semantic (ACL-hydrated) retrieval,
 * fall back to keyword. Best-effort — never throws into the loop.
 */
async function retrieveContext(
  projectId: string,
  userId: string,
  question: string,
): Promise<string> {
  let ranked: RagCandidate[] = [];
  try {
    const semantic = await semanticSearch(projectId, userId, question, {
      topK: RETRIEVE_TOP_K,
    });
    if (semantic && semantic.length > 0) {
      ranked = semantic; // already cosine-ranked + ACL-hydrated
    } else {
      ranked = await keywordRetrieve(projectId, userId, question);
    }
  } catch {
    ranked = [];
  }
  return buildGroundingContext(ranked, 3000);
}

/* ── Metering ─────────────────────────────────────────────────────────────── */

/** Record one `ai_requests` unit per LLM turn; never blocks a good result. */
async function meterTurn(userId: string): Promise<void> {
  try {
    await recordUsage({
      tenantId: userId,
      feature: 'ai_requests',
      units: 1,
      idempotencyKey: `sabcrm-copilot:${randomUUID()}`,
      meta: { feature: 'sabcrm', op: 'copilot' },
    });
  } catch {
    /* best-effort */
  }
}

/* ── Tool catalogue helpers ───────────────────────────────────────────────── */

/** Is this MCP tool a mutation? (write scope). */
function isWriteTool(tool: McpTool): boolean {
  return tool.scope === 'sabcrm:write';
}

/** Compact briefs for the system prompt, hiding write tools from read-only users. */
function toolBriefs(canWrite: boolean): ToolBrief[] {
  const out: ToolBrief[] = [];
  for (const tool of SABCRM_TOOL_MAP.values()) {
    const write = isWriteTool(tool);
    if (write && !canWrite) continue; // don't even advertise tools they can't use
    out.push({ name: tool.name, description: tool.description, write });
  }
  return out;
}

/** Flatten an MCP tool result's content into observation text. */
function observationText(result: { content?: Array<{ text?: string }> }): string {
  return (result.content ?? [])
    .map((c) => (typeof c.text === 'string' ? c.text : ''))
    .filter(Boolean)
    .join('\n');
}

/* ── The loop ─────────────────────────────────────────────────────────────── */

/**
 * Run the copilot for `question` in `projectId` as `userId`.
 *
 * Pre-flight: the caller must have already gated `view` (the action does this).
 * Here we (a) screen the question with the guardrail, (b) resolve the caller's
 * write permission to set the trust policy, (c) retrieve grounding context,
 * then (d) loop: meter → LLM → parse → (final ⇒ done | tool ⇒ execute via MCP
 * handler under the trust policy ⇒ observe). On budget exhaustion we make one
 * final un-tooled LLM call asking for a best-effort summary.
 */
export async function runCopilot(
  projectId: string,
  userId: string,
  question: string,
  opts?: RunCopilotOptions,
): Promise<CopilotRunResult> {
  const steps: CopilotStep[] = [];
  const toolsUsed = new Set<string>();

  // 1. Guardrail the question (cheap, before any LLM spend).
  const guard = checkText(question);
  if (!guard.ok) {
    return { ok: false, answer: guard.reason ?? 'Request blocked.', steps, toolsUsed: [], error: guard.reason };
  }

  const maxSteps = clampMaxSteps(opts?.maxSteps);

  // 2. Resolve the caller's write permission (the action already proved view).
  const canWrite = await canServer(MODULE_KEY, 'edit', projectId).catch(() => false);

  // 3. Trust policy + tool catalogue.
  const briefs = toolBriefs(canWrite);
  const knownTools = new Set<string>();
  const writeTools = new Set<string>();
  for (const tool of SABCRM_TOOL_MAP.values()) {
    knownTools.add(tool.name);
    if (isWriteTool(tool)) writeTools.add(tool.name);
  }
  const policy: ToolPolicy = { knownTools, writeTools, canWrite, projectId };

  // 4. Retrieve grounding context (RAG).
  const contextBlock = await retrieveContext(projectId, userId, question);

  // 5. Conversation seed.
  const system = buildSystemPrompt({ tools: briefs, projectId, canWrite, contextBlock });
  // We carry the dialogue as a single growing prompt string (the LLM helper is
  // a single system+prompt completion, not a chat-turns API).
  let convo = buildUserTurn(question);

  // 6. Loop.
  for (let i = 0; i < maxSteps; i++) {
    // Meter + quota-gate every LLM turn.
    if (!(await canUse(userId, 'ai_requests'))) {
      return {
        ok: false,
        answer: 'AI quota exceeded.',
        steps,
        toolsUsed: [...toolsUsed],
        error: 'AI quota exceeded.',
      };
    }
    const llm = await generateSabcrmText({ system, prompt: convo, maxTokens: 1024 });
    await meterTurn(userId);
    if (!llm.ok) {
      // First-turn provider failure → honest error; mid-loop → return progress.
      if (steps.length === 0) {
        return { ok: false, answer: llm.error, steps, toolsUsed: [], error: llm.error };
      }
      return {
        ok: true,
        answer:
          'I could not complete the reasoning, but here is what I gathered:\n' +
          steps
            .filter((s) => s.observation && !s.isError)
            .map((s) => `• ${s.tool}: ${s.observation?.slice(0, 200)}`)
            .join('\n'),
        steps,
        toolsUsed: [...toolsUsed],
        error: llm.error,
      };
    }

    const parsed = parseModelReply(llm.text);

    if (parsed.kind === 'final') {
      steps.push({ index: steps.length, thought: parsed.final.thought });
      return { ok: true, answer: parsed.final.final, steps, toolsUsed: [...toolsUsed] };
    }

    if (parsed.kind === 'error') {
      // Tell the model how to fix its reply and try again (counts as a step).
      // Feed it back as a well-formed observation turn (consistent with the tool
      // branches below) rather than a bare error string.
      steps.push({ index: steps.length, observation: parsed.error, isError: true });
      convo = buildObservationTurn('parse_error', parsed.error, true);
      continue;
    }

    // parsed.kind === 'tool'
    const call = parsed.call;
    const decision = decideToolCall(call, policy);
    if (!decision.allow) {
      steps.push({
        index: steps.length,
        thought: call.thought,
        tool: call.tool,
        args: call.args,
        observation: decision.reason,
        isError: true,
      });
      convo = buildObservationTurn(call.tool, decision.reason, true);
      continue;
    }

    const tool = SABCRM_TOOL_MAP.get(call.tool);
    if (!tool) {
      const msg = `Unknown tool "${call.tool}".`;
      steps.push({ index: steps.length, thought: call.thought, tool: call.tool, observation: msg, isError: true });
      convo = buildObservationTurn(call.tool, msg, true);
      continue;
    }

    // Validate args against the tool's own zod schema (same as the MCP server).
    const checked = tool.schema.safeParse(decision.args);
    if (!checked.success) {
      const issues = checked.error.issues
        .map((iss) => `${iss.path.join('.') || '(root)'}: ${iss.message}`)
        .join('; ');
      const msg = `Invalid arguments for ${tool.name}: ${issues}`;
      steps.push({
        index: steps.length,
        thought: call.thought,
        tool: call.tool,
        args: decision.args,
        observation: msg,
        isError: true,
      });
      convo = buildObservationTurn(call.tool, msg, true);
      continue;
    }

    // Execute the EXISTING MCP handler as the caller (ACL + tenancy enforced
    // inside the handler via denyUnlessMember + rustFetchAsUser).
    let obs: string;
    let isErr = false;
    try {
      const result = await tool.run(userId, checked.data);
      obs = observationText(result) || '(no output)';
      isErr = Boolean(result.isError);
    } catch (e) {
      obs = e instanceof Error ? e.message : 'Tool execution failed.';
      isErr = true;
    }

    toolsUsed.add(call.tool);
    steps.push({
      index: steps.length,
      thought: call.thought,
      tool: call.tool,
      args: decision.args,
      observation: obs,
      isError: isErr,
    });
    convo = buildObservationTurn(call.tool, obs, isErr);
  }

  // 7. Budget exhausted — one final un-tooled summary turn (still metered).
  if (await canUse(userId, 'ai_requests')) {
    const summary = await generateSabcrmText({
      system,
      prompt:
        convo +
        '\n\nYou have reached the step limit. Do NOT call any more tools. ' +
        'Reply with a single JSON object {"final":"<best-effort answer from what ' +
        'you gathered>"} inside a ```json fenced block.',
      maxTokens: 768,
    });
    await meterTurn(userId);
    if (summary.ok) {
      const parsed = parseModelReply(summary.text);
      if (parsed.kind === 'final') {
        return {
          ok: true,
          answer: parsed.final.final,
          steps,
          toolsUsed: [...toolsUsed],
          budgetExhausted: true,
        };
      }
    }
  }

  return {
    ok: true,
    answer:
      'I reached my step limit before finishing. Here is what I gathered:\n' +
      steps
        .filter((s) => s.observation && !s.isError)
        .map((s) => `• ${s.tool ?? 'note'}: ${(s.observation ?? '').slice(0, 200)}`)
        .join('\n'),
    steps,
    toolsUsed: [...toolsUsed],
    budgetExhausted: true,
  };
}
