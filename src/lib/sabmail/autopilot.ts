import 'server-only';

/**
 * SabMail — AI Autopilot proposal engine (plain server lib, no 'use server').
 *
 * Reads the newest INBOX rows for a mailbox (cheap envelope-only listing — no
 * body fetch), asks the SabMail LLM to classify each as
 * archive / label / keep, then joins the model's verdicts back onto the rows.
 *
 * This module ONLY proposes — it never mutates the mailbox. The server action
 * layer (`src/app/sabmail/autopilot/actions.ts`) executes a single approved
 * action via the existing inbox mutations and writes an audit doc. Human stays
 * in the loop.
 *
 * Tenancy: callers pass an explicit `workspaceId`. The underlying
 * `listSabmailMessages` is already session+cookie-scoped to the active
 * workspace; `workspaceId` is threaded so audit writes are correctly scoped
 * and so this lib stays usable from contexts that already resolved it.
 */

import { listSabmailMessages } from '@/app/sabmail/inbox/actions';
import { sabmailLlm } from '@/lib/sabmail/ai';

export type AutopilotSuggestion = 'archive' | 'label' | 'keep';

export interface AutopilotProposal {
  uid: number;
  subject: string;
  from: string;
  suggested: AutopilotSuggestion;
  /** Suggested label name when `suggested === 'label'`. */
  label?: string;
  reason: string;
}

export type ProposeAutopilotResult =
  | { ok: true; proposals: AutopilotProposal[] }
  | { ok: false; error: string };

const SUGGESTION_SET: AutopilotSuggestion[] = ['archive', 'label', 'keep'];
const MAX_ROWS = 15;

/** Tolerant JSON-array extraction (model may wrap in prose / code fences). */
function parseLlmArray(text: string): unknown[] | null {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Propose inbox actions for the ~15 newest INBOX messages.
 *
 * Each proposal is one of:
 *  - `archive` — bulk / done-with mail safe to move out of the inbox
 *  - `label`   — keep in inbox but tag (model also suggests a `label`)
 *  - `keep`    — leave untouched (needs a human)
 */
export async function proposeAutopilotActions(
  workspaceId: string,
  accountId: string,
): Promise<ProposeAutopilotResult> {
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  if (!accountId) return { ok: false, error: 'Pick a mailbox to analyze.' };

  // Cheap envelope-only listing — newest first, no body fetch.
  const listed = await listSabmailMessages(accountId, 'INBOX', 0, MAX_ROWS);
  if (!listed.ok) return { ok: false, error: listed.error };

  const rows = listed.messages.slice(0, MAX_ROWS);
  if (rows.length === 0) return { ok: true, proposals: [] };

  const rowByUid = new Map(rows.map((r) => [r.uid, r]));

  const lines = rows
    .map((r) => {
      const from = r.fromName ? `${r.fromName} <${r.fromEmail}>` : r.fromEmail;
      return `uid=${r.uid} | from: ${from || '(unknown)'} | subject: ${r.subject}`;
    })
    .join('\n');

  const llm = await sabmailLlm({
    system:
      'You are an inbox autopilot that PROPOSES tidy-up actions for a busy professional. ' +
      'For each email choose exactly one action: ' +
      '"archive" (bulk/newsletter/notification/receipt that is safe to move out of the inbox), ' +
      '"label" (keep in the inbox but tag it — also give a short label like "Finance", "Travel", or "Work"), ' +
      'or "keep" (a personal or important message that should be left untouched for a human). ' +
      'Be conservative: when unsure, prefer "keep". ' +
      'Reply with ONLY a JSON array of {"uid":number,"suggested":"archive"|"label"|"keep","label":string,"reason":string}. ' +
      'Omit "label" unless suggested is "label". Keep each "reason" under 12 words. No prose, no code fences.',
    prompt: `Propose an action for each of these ${rows.length} inbox emails:\n${lines}`,
    maxTokens: 1500,
  });
  if (!llm.ok) return { ok: false, error: llm.error };

  const arr = parseLlmArray(llm.text);
  if (!arr) return { ok: false, error: 'AI returned an unexpected format.' };

  const proposals: AutopilotProposal[] = [];
  const seen = new Set<number>();
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as { uid?: unknown; suggested?: unknown; label?: unknown; reason?: unknown };
    const uid = Number(obj.uid);
    if (!Number.isFinite(uid) || seen.has(uid)) continue;
    const row = rowByUid.get(uid);
    if (!row) continue;

    const suggestedRaw = String(obj.suggested ?? '').toLowerCase() as AutopilotSuggestion;
    const suggested: AutopilotSuggestion = SUGGESTION_SET.includes(suggestedRaw)
      ? suggestedRaw
      : 'keep';
    const label =
      suggested === 'label' && typeof obj.label === 'string' && obj.label.trim()
        ? obj.label.trim().slice(0, 40)
        : undefined;
    const reason =
      typeof obj.reason === 'string' && obj.reason.trim()
        ? obj.reason.trim().slice(0, 160)
        : 'No reason given.';

    seen.add(uid);
    proposals.push({
      uid,
      subject: row.subject,
      from: row.fromName ? `${row.fromName} <${row.fromEmail}>` : row.fromEmail,
      suggested,
      ...(label ? { label } : {}),
      reason,
    });
  }

  // Backfill any rows the model skipped as a conservative "keep".
  for (const row of rows) {
    if (seen.has(row.uid)) continue;
    proposals.push({
      uid: row.uid,
      subject: row.subject,
      from: row.fromName ? `${row.fromName} <${row.fromEmail}>` : row.fromEmail,
      suggested: 'keep',
      reason: 'Not classified — left untouched.',
    });
  }

  return { ok: true, proposals };
}
