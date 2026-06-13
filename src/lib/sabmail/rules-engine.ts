import 'server-only';

/**
 * SabMail rules engine — natural-language → structured inbox rule.
 *
 * A "rule" is a tiny, deterministic matcher over INBOX messages plus a single
 * action. The compiler here turns a free-text description ("archive anything
 * from notifications@ older than 30 days") into the structured `compiled` shape
 * the rest of the module stores + runs.
 *
 * This is a PLAIN server lib (no `'use server'`) so it can export helpers,
 * constants, and types freely. The LLM call goes through `sabmailLlm` (same
 * provider ladder as the rest of SabMail's AI); the model output is parsed,
 * validated, and defaulted defensively — the model is never trusted to return
 * a clean shape.
 */

import { sabmailLlm } from '@/lib/sabmail/ai';

export type SabmailRuleAction = 'label' | 'archive' | 'markRead';

const RULE_ACTIONS: SabmailRuleAction[] = ['label', 'archive', 'markRead'];

/** The structured matcher + action a compiled rule runs. */
export interface SabmailRuleCompiled {
  match: {
    fromContains?: string;
    subjectContains?: string;
    olderThanDays?: number;
  };
  action: SabmailRuleAction;
  /** Required only when `action === 'label'`. */
  label?: string;
}

export type CompileSabmailRuleResult =
  | { ok: true; compiled: SabmailRuleCompiled }
  | { ok: false; error: string };

const COMPILE_SYSTEM = [
  'You convert a natural-language inbox rule into a strict JSON object.',
  'Return ONLY JSON (no prose, no code fences) with this exact shape:',
  '{',
  '  "match": {',
  '    "fromContains": string (optional — a sender substring, e.g. "notifications@"),',
  '    "subjectContains": string (optional — a subject substring),',
  '    "olderThanDays": number (optional — match mail older than N days)',
  '  },',
  '  "action": "label" | "archive" | "markRead",',
  '  "label": string (REQUIRED only when action is "label")',
  '}',
  'Rules:',
  '- Pick exactly one action. "archive" moves the mail out of the inbox; "markRead" marks it seen; "label" tags it (you MUST also return a short "label").',
  '- Only include match keys that the instruction actually implies. Omit the rest.',
  '- fromContains / subjectContains must be lowercase plain substrings (no quotes, no operators).',
  '- olderThanDays must be a positive integer.',
  '- If the instruction is ambiguous about the action, prefer "label".',
].join('\n');

/** Pull the first balanced `{...}` JSON object out of a model response. */
function extractJsonObject(text: string): unknown | null {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function asCleanSubstring(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed.slice(0, 200) : undefined;
}

function asPositiveInt(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(n)) return undefined;
  const rounded = Math.round(n);
  return rounded > 0 ? Math.min(rounded, 36500) : undefined;
}

/**
 * Validate + default the model's raw object into a `SabmailRuleCompiled`, or
 * return an error string describing what's missing.
 */
function validateCompiled(raw: unknown): CompileSabmailRuleResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'AI returned an unexpected format.' };
  }
  const obj = raw as Record<string, unknown>;

  const actionRaw = String(obj.action ?? '').trim() as SabmailRuleAction;
  const action: SabmailRuleAction = RULE_ACTIONS.includes(actionRaw) ? actionRaw : 'label';

  const matchRaw =
    obj.match && typeof obj.match === 'object'
      ? (obj.match as Record<string, unknown>)
      : {};

  const match: SabmailRuleCompiled['match'] = {};
  const fromContains = asCleanSubstring(matchRaw.fromContains);
  if (fromContains) match.fromContains = fromContains;
  const subjectContains = asCleanSubstring(matchRaw.subjectContains);
  if (subjectContains) match.subjectContains = subjectContains;
  const olderThanDays = asPositiveInt(matchRaw.olderThanDays);
  if (olderThanDays !== undefined) match.olderThanDays = olderThanDays;

  if (Object.keys(match).length === 0) {
    return {
      ok: false,
      error: 'Could not work out a condition from that — try naming a sender, a subject phrase, or an age.',
    };
  }

  const compiled: SabmailRuleCompiled = { match, action };

  if (action === 'label') {
    const label = typeof obj.label === 'string' ? obj.label.trim().slice(0, 60) : '';
    if (!label) {
      return { ok: false, error: 'A "label" rule needs a label name — try rephrasing with the label to apply.' };
    }
    compiled.label = label;
  }

  return { ok: true, compiled };
}

/**
 * Compile a natural-language rule into the structured matcher + action.
 * Never throws — returns a discriminated result.
 */
export async function compileSabmailRule(nl: string): Promise<CompileSabmailRuleResult> {
  const text = (nl ?? '').trim();
  if (!text) return { ok: false, error: 'Describe the rule in a sentence first.' };

  const llm = await sabmailLlm({
    system: COMPILE_SYSTEM,
    prompt: `Compile this inbox rule:\n\n${text.slice(0, 1000)}`,
    maxTokens: 400,
  });
  if (!llm.ok) return { ok: false, error: llm.error };

  const raw = extractJsonObject(llm.text);
  if (raw === null) return { ok: false, error: 'AI returned an unexpected format.' };

  return validateCompiled(raw);
}

/* ── runtime matcher (used by the preview action + future sync engine) ──── */

/** A normalized message the matcher reasons over. */
export interface SabmailRuleCandidate {
  fromName: string;
  fromEmail: string;
  subject: string;
  /** ISO date string (or null). */
  date: string | null;
}

/** Does a single message satisfy the compiled rule's match clause? */
export function matchesSabmailRule(
  compiled: SabmailRuleCompiled,
  msg: SabmailRuleCandidate,
  now: Date = new Date(),
): boolean {
  const m = compiled.match ?? {};
  let any = false;

  if (m.fromContains) {
    any = true;
    const haystack = `${msg.fromName} ${msg.fromEmail}`.toLowerCase();
    if (!haystack.includes(m.fromContains)) return false;
  }

  if (m.subjectContains) {
    any = true;
    if (!(msg.subject ?? '').toLowerCase().includes(m.subjectContains)) return false;
  }

  if (typeof m.olderThanDays === 'number') {
    any = true;
    const ts = msg.date ? Date.parse(msg.date) : NaN;
    if (!Number.isFinite(ts)) return false;
    const ageDays = (now.getTime() - ts) / 86_400_000;
    if (ageDays < m.olderThanDays) return false;
  }

  // No conditions → never matches (defensive; the compiler rejects empty match).
  return any;
}

/** Human-readable one-liner for the compiled rule (UI + preview copy). */
export function describeSabmailRule(compiled: SabmailRuleCompiled): string {
  const conds: string[] = [];
  if (compiled.match.fromContains) conds.push(`from contains “${compiled.match.fromContains}”`);
  if (compiled.match.subjectContains) conds.push(`subject contains “${compiled.match.subjectContains}”`);
  if (typeof compiled.match.olderThanDays === 'number') {
    conds.push(`older than ${compiled.match.olderThanDays} day${compiled.match.olderThanDays === 1 ? '' : 's'}`);
  }
  const when = conds.length ? conds.join(' and ') : 'any message';
  const act =
    compiled.action === 'archive'
      ? 'archive it'
      : compiled.action === 'markRead'
        ? 'mark it read'
        : `label it “${compiled.label ?? ''}”`;
  return `When ${when}, ${act}.`;
}
