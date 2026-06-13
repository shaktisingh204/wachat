/**
 * SabCRM — agentic copilot — PURE helpers (no I/O, no LLM call).
 *
 * This is the testable scaffolding for the plan→retrieve→call-tools→observe
 * loop that lives in `./copilot.server.ts`. Everything here is deterministic:
 * prompt assembly, parsing the model's reply into either a tool call or a final
 * answer, a guardrail that blocks prompt-injection / out-of-scope / unsafe
 * requests, and a step budget. The server module does the LLM + MCP-tool I/O.
 *
 * Contract with the model (declared in {@link buildSystemPrompt}): on every
 * turn it emits EXACTLY ONE fenced JSON object, either
 *   { "thought": "...", "tool": "<name>", "args": { ... } }   ← take an action
 * or
 *   { "thought": "...", "final": "<answer to the user>" }     ← stop
 * We parse leniently (fenced block preferred, else the first balanced JSON
 * object) because models drift on formatting, but we never *execute* anything
 * the parser is unsure about — an unparseable reply is surfaced to the loop as
 * a parse error the model can correct on the next turn.
 */

/* ── Step / transcript types (shared with the server loop) ─────────────────── */

/** One tool invocation the model asked for. */
export interface CopilotToolCall {
  /** MCP tool name (e.g. "list_records"). */
  tool: string;
  /** Arguments object for the tool (validated by the tool's own zod schema). */
  args: Record<string, unknown>;
  /** The model's stated reasoning for this step (free text, never executed). */
  thought?: string;
}

/** The model's terminal answer. */
export interface CopilotFinal {
  final: string;
  thought?: string;
}

/** Discriminated result of parsing one model reply. */
export type ParsedReply =
  | { kind: 'tool'; call: CopilotToolCall }
  | { kind: 'final'; final: CopilotFinal }
  | { kind: 'error'; error: string };

/** One recorded step of the loop (for the transcript the UI renders). */
export interface CopilotStep {
  index: number;
  thought?: string;
  /** Present when the step issued a tool call. */
  tool?: string;
  args?: Record<string, unknown>;
  /** Observation fed back to the model (tool result text or an error). */
  observation?: string;
  /** True when the tool returned an in-band error. */
  isError?: boolean;
}

/* ── Step budget ───────────────────────────────────────────────────────────── */

/** Default + hard ceiling on tool-calling turns per question. */
export const DEFAULT_MAX_STEPS = 6;
export const MAX_STEPS_CEILING = 12;

/** Clamp a caller-supplied step budget into the allowed range. */
export function clampMaxSteps(requested?: number): number {
  if (!Number.isFinite(requested) || requested === undefined) {
    return DEFAULT_MAX_STEPS;
  }
  const n = Math.floor(requested as number);
  if (n < 1) return 1;
  if (n > MAX_STEPS_CEILING) return MAX_STEPS_CEILING;
  return n;
}

/* ── Guardrail ─────────────────────────────────────────────────────────────── */

export interface GuardrailVerdict {
  ok: boolean;
  /** When blocked, a short reason safe to show the user. */
  reason?: string;
  /** Machine tag for the kind of block (for metering/telemetry). */
  category?: 'injection' | 'unsafe' | 'out_of_scope' | 'empty';
}

/**
 * Prompt-injection / jailbreak phrases. Matched case-insensitively against the
 * normalised text. Deliberately conservative — these are unambiguous attempts
 * to subvert the agent's instructions or exfiltrate its configuration.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (?:all|any|the)?\s*(?:previous|prior|above)\s+instructions?/i,
  /disregard (?:all|any|the)?\s*(?:previous|prior|above)\s+(?:instructions?|rules?)/i,
  /forget (?:all|any|the|your)?\s*(?:previous|prior|above)?\s*(?:instructions?|rules?)/i,
  /you are now (?:a|an|in)\b/i,
  /\bdeveloper mode\b/i,
  /\bdo anything now\b|\bDAN\b/,
  /\bjailbreak\b/i,
  /reveal (?:your )?(?:system )?prompt/i,
  /(?:print|show|repeat|output) (?:your )?(?:system )?(?:prompt|instructions)/i,
  /override (?:your )?(?:safety|guardrails?|rules?)/i,
  /pretend (?:you are|to be) (?:not )?an? /i,
];

/**
 * Destructive / out-of-scope action phrases. The copilot is scoped to this
 * project's CRM; requests to wipe everything, dump credentials, or act outside
 * the CRM are refused before we ever spend an LLM call.
 */
const UNSAFE_PATTERNS: RegExp[] = [
  /\bdelete\s+(?:all|every|everything|the entire|all of)\b/i,
  /\b(?:drop|truncate|wipe)\s+(?:the\s+)?(?:database|db|collection|table|everything)\b/i,
  /\bmass\s+delete\b/i,
  /\b(?:api[_\s-]?key|secret|password|token|credential)s?\b.*\b(?:show|reveal|print|leak|dump|give me)\b/i,
  /\b(?:show|reveal|print|leak|dump|give me)\b.*\b(?:api[_\s-]?key|secret|password|token|credential)s?\b/i,
  /\bexport\s+(?:all|every)\s+(?:user|customer|contact)s?\b.*\b(?:email|csv|external)\b/i,
];

/** Normalise for matching: collapse whitespace, strip zero-width chars. */
function normaliseForGuardrail(text: string): string {
  return (text || '')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Max characters we accept for a single question (cost / abuse guard). */
export const MAX_QUESTION_CHARS = 4000;

/**
 * Screen a user question before the agent runs. Blocks empty input,
 * prompt-injection, and unmistakably unsafe/out-of-scope requests; lets normal
 * CRM questions through. NOT a content moderator — the real authorization
 * boundary is RBAC + the tool scopes in the server loop. This is the cheap
 * first line that stops obvious abuse from reaching the model.
 */
export function checkText(text: string): GuardrailVerdict {
  const t = normaliseForGuardrail(text);
  if (!t) return { ok: false, reason: 'A question is required.', category: 'empty' };
  if (t.length > MAX_QUESTION_CHARS) {
    return {
      ok: false,
      reason: `Question is too long (max ${MAX_QUESTION_CHARS} characters).`,
      category: 'out_of_scope',
    };
  }
  for (const re of INJECTION_PATTERNS) {
    if (re.test(t)) {
      return {
        ok: false,
        reason:
          'This request looks like an attempt to change my instructions. ' +
          'I can only answer questions and act on your CRM records.',
        category: 'injection',
      };
    }
  }
  for (const re of UNSAFE_PATTERNS) {
    if (re.test(t)) {
      return {
        ok: false,
        reason:
          'I can\'t perform bulk-destructive or out-of-scope actions. ' +
          'I work within your CRM, one record at a time, under your permissions.',
        category: 'unsafe',
      };
    }
  }
  return { ok: true };
}

/* ── System prompt ─────────────────────────────────────────────────────────── */

/** A compact description of one available tool for the system prompt. */
export interface ToolBrief {
  name: string;
  description: string;
  /** Whether this tool mutates data ('sabcrm:write') or only reads. */
  write: boolean;
}

/**
 * Build the agent's system prompt. Declares the strict one-JSON-object-per-turn
 * protocol, lists the tools the caller is allowed to use, states the project
 * scope, and — crucially — tells the model whether it may write. When
 * `canWrite` is false the prompt forbids write tools so the model doesn't waste
 * turns proposing actions the trust layer will refuse anyway.
 */
export function buildSystemPrompt(opts: {
  tools: ToolBrief[];
  projectId: string;
  canWrite: boolean;
  contextBlock?: string;
}): string {
  const { tools, projectId, canWrite, contextBlock } = opts;
  const toolLines = tools
    .map(
      (t) =>
        `- ${t.name}${t.write ? ' (writes data)' : ''}: ${t.description.replace(/\s+/g, ' ').trim()}`,
    )
    .join('\n');

  const writePolicy = canWrite
    ? 'You MAY use write tools, but only to do exactly what the user asked. ' +
      'Confirm destructive intent is explicit before deleting; never delete in bulk.'
    : 'You DO NOT have permission to modify data. Use ONLY read tools. If the ' +
      'user asks you to create/update/delete/move anything, politely refuse and ' +
      'explain you can only read this CRM.';

  return [
    'You are SabCRM Copilot, an assistant that answers questions and performs ' +
      'actions on the user\'s CRM by calling tools. You operate strictly within ' +
      `the project "${projectId}" and only on records the user can already see.`,
    '',
    'PROTOCOL — every reply MUST be EXACTLY ONE JSON object inside a ```json ' +
      'fenced code block, and nothing else. Two shapes are allowed:',
    '  To take an action:',
    '    {"thought":"<brief reasoning>","tool":"<tool name>","args":{ ... }}',
    '  To finish (give the user their answer):',
    '    {"thought":"<brief reasoning>","final":"<your complete answer>"}',
    'Never output prose outside the JSON block. Never call more than one tool ' +
      'per reply. Every tool call MUST include the "projectId" argument set to ' +
      `"${projectId}".`,
    '',
    'TOOLS available to you:',
    toolLines || '(none)',
    '',
    'POLICY:',
    `- ${writePolicy}`,
    '- Ground every factual claim in tool results; do not invent records, ' +
      'fields, numbers, or ids. If a tool returns nothing, say so.',
    '- Prefer the fewest tool calls that answer the question. Discover object ' +
      'slugs and field keys with list_objects before guessing them.',
    '- When you have enough information, STOP and return a "final" answer.',
    contextBlock
      ? '\nRELEVANT RECORDS (retrieved for grounding; may be partial):\n' + contextBlock
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** The first user turn: the question, restating the output contract. */
export function buildUserTurn(question: string): string {
  return (
    `User question: ${question.trim()}\n\n` +
    'Respond with a single JSON object (a tool call or a final answer) inside a ' +
    '```json fenced block.'
  );
}

/** Format a tool observation to feed back to the model on the next turn. */
export function buildObservationTurn(
  toolName: string,
  observation: string,
  isError: boolean,
): string {
  const head = isError
    ? `Tool "${toolName}" returned an ERROR:`
    : `Tool "${toolName}" returned:`;
  // Bound the observation so a huge result can't blow the context window.
  const body = observation.length > 6000 ? observation.slice(0, 6000) + '\n…(truncated)' : observation;
  return (
    `${head}\n${body}\n\n` +
    'Continue: respond with a single JSON object (another tool call or a final ' +
    'answer) inside a ```json fenced block.'
  );
}

/* ── Reply parsing ─────────────────────────────────────────────────────────── */

/**
 * Extract the first JSON object from a model reply. Prefers a ```json (or bare
 * ```) fenced block; otherwise scans for the first balanced `{…}` (brace-
 * counting, string/escape aware so braces inside JSON strings don't fool it).
 * Returns the raw JSON substring or null.
 */
export function extractJsonBlock(text: string): string | null {
  if (!text) return null;
  // 1) Fenced code block.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    const inner = fence[1].trim();
    const balanced = firstBalancedObject(inner);
    if (balanced) return balanced;
  }
  // 2) First balanced object anywhere in the text.
  return firstBalancedObject(text);
}

/** Scan for the first balanced top-level `{…}`, ignoring braces in strings. */
function firstBalancedObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null; // unbalanced
}

/**
 * Parse one model reply into a tool call, a final answer, or an error. Lenient
 * about formatting (uses {@link extractJsonBlock}) but strict about structure:
 * a tool call needs a non-empty string `tool` and an object `args`; a final
 * needs a string `final`. Anything else is an `error` the loop surfaces back to
 * the model rather than executing.
 */
export function parseModelReply(text: string): ParsedReply {
  const json = extractJsonBlock(text);
  if (!json) {
    return {
      kind: 'error',
      error:
        'Your reply was not a JSON object. Reply with a single JSON object ' +
        '(a tool call or a "final" answer) inside a ```json fenced block.',
    };
  }
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return {
      kind: 'error',
      error:
        'Your JSON did not parse. Return one valid JSON object with either ' +
        '"tool"+"args" or "final".',
    };
  }
  if (typeof obj !== 'object' || obj === null) {
    return { kind: 'error', error: 'Expected a JSON object.' };
  }
  const o = obj as Record<string, unknown>;
  const thought = typeof o.thought === 'string' ? o.thought : undefined;

  // Final answer takes precedence (so a stray "tool":null + "final" still ends).
  if (typeof o.final === 'string' && o.final.trim()) {
    return { kind: 'final', final: { final: o.final.trim(), thought } };
  }

  if (typeof o.tool === 'string' && o.tool.trim()) {
    const args =
      typeof o.args === 'object' && o.args !== null && !Array.isArray(o.args)
        ? (o.args as Record<string, unknown>)
        : {};
    return { kind: 'tool', call: { tool: o.tool.trim(), args, thought } };
  }

  return {
    kind: 'error',
    error:
      'Reply had neither a valid "tool"+"args" action nor a "final" answer. ' +
      'Provide one of them.',
  };
}

/** Convenience: just the tool call, or null. */
export function parseToolCall(modelText: string): CopilotToolCall | null {
  const r = parseModelReply(modelText);
  return r.kind === 'tool' ? r.call : null;
}

/** Convenience: just the final answer string, or null. */
export function parseFinalAnswer(modelText: string): string | null {
  const r = parseModelReply(modelText);
  return r.kind === 'final' ? r.final.final : null;
}

/* ── Tool-call trust layer (pure decision) ─────────────────────────────────── */

export interface ToolPolicy {
  /** Names of tools that exist (anything else is rejected). */
  knownTools: Set<string>;
  /** Names of tools that mutate data ('sabcrm:write'). */
  writeTools: Set<string>;
  /** Whether the caller is allowed to write (RBAC 'edit'). */
  canWrite: boolean;
  /** The project the caller is scoped to. */
  projectId: string;
}

export type ToolDecision =
  | { allow: true; args: Record<string, unknown> }
  | { allow: false; reason: string };

/**
 * Decide whether a model-proposed tool call may run, and normalise its args.
 *
 * Enforces (pure, no I/O — the server still re-validates against RBAC + the
 * tool's zod schema):
 *   1. the tool exists,
 *   2. write tools are refused when `canWrite` is false,
 *   3. `projectId` is forced to the caller's project (a model-supplied
 *      `projectId` can never widen scope — defends the two-store/tenancy line).
 */
export function decideToolCall(call: CopilotToolCall, policy: ToolPolicy): ToolDecision {
  if (!policy.knownTools.has(call.tool)) {
    return {
      allow: false,
      reason: `Unknown tool "${call.tool}". Use only the listed tools.`,
    };
  }
  if (policy.writeTools.has(call.tool) && !policy.canWrite) {
    return {
      allow: false,
      reason:
        `You do not have permission to use "${call.tool}" (it modifies data). ` +
        'Answer using read-only tools, or tell the user they lack edit access.',
    };
  }
  // Force the caller's project — never trust a model-supplied projectId.
  const args = { ...call.args, projectId: policy.projectId };
  return { allow: true, args };
}
