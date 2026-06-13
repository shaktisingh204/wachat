'use server';

import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { sabmailLlm } from '@/lib/sabmail/ai';
import { ragSearch } from '@/lib/sabmail/rag';
import {
  searchSabmailMessages,
  getSabmailMessage,
} from '@/app/sabmail/inbox/actions';
import { getErrorMessage } from '@/lib/utils';

const ANSWER_SYSTEM =
  'You answer questions about a user\'s inbox using ONLY the provided emails. Each email is tagged with a number like [1], [2]. Answer concisely and cite the emails you used inline with their bracketed numbers, e.g. "Your invoice is due Friday [2]." If the emails do not contain the answer, say so plainly. Never invent facts not in the emails.';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail Ask-AI — RAG-lite over the inbox (no vector DB).
 *
 * Retrieval uses IMAP SEARCH (the existing `searchSabmailMessages`) keyed on
 * 1–3 keywords derived from the question; the top candidates' bodies are
 * fetched (capped) for context, then the LLM answers with inline [n]
 * citations. Degrades gracefully when search returns nothing or the LLM is
 * not configured.
 * ──────────────────────────────────────────────────────────────────── */

export interface SabmailAiSource {
  n: number;
  subject: string;
  from: string;
  uid: number;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Tiny stop-word list — enough to keep keyword extraction signal-rich. */
const STOP_WORDS = new Set<string>([
  'about', 'after', 'again', 'against', 'above', 'with', 'what',
  'when', 'where', 'which', 'while', 'would', 'could', 'should', 'there',
  'their', 'these', 'those', 'this', 'that', 'than', 'then', 'they', 'them',
  'have', 'from', 'into', 'your', 'yours', 'mine', 'ours', 'will', 'shall',
  'does', 'done', 'doing', 'been', 'being', 'were', 'was', 'are', 'and', 'the',
  'for', 'but', 'not', 'you', 'all', 'any', 'can', 'did', 'how', 'why', 'who',
  'whom', 'whose', 'email', 'emails', 'inbox', 'mail', 'mails', 'message',
  'messages', 'find', 'show', 'tell', 'give', 'please', 'regarding',
]);

/**
 * Derive 1–3 keywords from a question: strip punctuation, drop stop-words and
 * short tokens, then keep the longest distinct words (best signal).
 */
function deriveKeywords(question: string): string[] {
  const tokens = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !STOP_WORDS.has(t));

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      unique.push(t);
    }
  }
  // Longest-first — longer words tend to be the more specific search terms.
  unique.sort((a, b) => b.length - a.length);
  return unique.slice(0, 3);
}

const MAX_CANDIDATES = 6;
const MAX_BODY_CHARS = 2_000;

function bodyExcerpt(text: string | null, html: string | null): string {
  const raw =
    (text && text.trim()) ||
    (html
      ? html
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
      : '');
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_BODY_CHARS);
}

/**
 * Ask a natural-language question over the connected mailbox's INBOX.
 * Returns a cited answer + the source messages it drew from.
 */
export async function askSabmailInbox(input: {
  accountId: string;
  question: string;
}): Promise<Result<{ answer: string; sources: SabmailAiSource[] }>> {
  // (1) auth workspace.
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  const accountId = input.accountId?.trim();
  if (!accountId) return { ok: false, error: 'Pick a mailbox to ask about.' };
  const question = input.question?.trim();
  if (!question) return { ok: false, error: 'Type a question first.' };

  try {
    // (2a) Prefer vector RAG when this workspace has an ingested index;
    // fall back to IMAP-keyword retrieval otherwise (graceful degrade).
    const rag = await ragSearch(workspaceId, question, MAX_CANDIDATES);
    if (rag.ok && rag.hits && rag.hits.length > 0) {
      const sources: SabmailAiSource[] = [];
      const contextBlocks: string[] = [];
      let rn = 0;
      for (const hit of rag.hits) {
        rn += 1;
        sources.push({
          n: rn,
          subject: hit.subject || '(no subject)',
          from: hit.from || '(unknown sender)',
          uid: Number(hit.uid) || 0,
        });
        contextBlocks.push(
          `[${rn}] From: ${hit.from || '(unknown sender)'}\nSubject: ${
            hit.subject || '(no subject)'
          }\nDate: ${hit.date ?? 'unknown'}\nBody: ${(hit.text || '').slice(0, MAX_BODY_CHARS)}`,
        );
      }
      const llm = await sabmailLlm({
        system: ANSWER_SYSTEM,
        prompt: `Question: ${question}\n\nEmails:\n\n${contextBlocks.join('\n\n---\n\n')}`,
        maxTokens: 800,
      });
      if (llm.ok) return { ok: true, answer: llm.text.trim(), sources };
      // LLM failed on the RAG path → fall through to keyword retrieval.
    }

    // (2) retrieve — IMAP SEARCH over a few keywords, de-duplicated by uid.
    const keywords = deriveKeywords(question);
    const seen = new Set<number>();
    const candidates: Array<{
      uid: number;
      subject: string;
      fromName: string;
      fromEmail: string;
      date: string | null;
    }> = [];

    for (const keyword of keywords) {
      if (candidates.length >= MAX_CANDIDATES) break;
      const found = await searchSabmailMessages(accountId, 'INBOX', keyword);
      if (!found.ok) {
        // Search unavailable (e.g. mailbox unreachable) — surface it honestly.
        return { ok: false, error: found.error };
      }
      for (const row of found.messages) {
        if (seen.has(row.uid)) continue;
        seen.add(row.uid);
        candidates.push({
          uid: row.uid,
          subject: row.subject,
          fromName: row.fromName,
          fromEmail: row.fromEmail,
          date: row.date,
        });
        if (candidates.length >= MAX_CANDIDATES) break;
      }
    }

    // (3) answer — fetch bodies for context, then ask the LLM with citations.
    if (candidates.length === 0) {
      const llm = await sabmailLlm({
        system:
          'You are an inbox assistant. The user asked a question, but no matching emails were found in their inbox. Reply in one short, friendly sentence saying you could not find related emails, and (if helpful) suggest rephrasing or different keywords. Do not invent email contents.',
        prompt: `Question: ${question}\n\nNo matching emails were found.`,
        maxTokens: 200,
      });
      if (!llm.ok) {
        return { ok: true, answer: "I couldn't find related emails.", sources: [] };
      }
      return { ok: true, answer: llm.text.trim(), sources: [] };
    }

    const sources: SabmailAiSource[] = [];
    const contextBlocks: string[] = [];
    let n = 0;
    for (const cand of candidates) {
      const full = await getSabmailMessage(accountId, 'INBOX', cand.uid, {
        markSeen: false,
      });
      n += 1;
      const fromLabel = cand.fromName
        ? `${cand.fromName} <${cand.fromEmail}>`
        : cand.fromEmail || '(unknown sender)';
      sources.push({ n, subject: cand.subject, from: fromLabel, uid: cand.uid });

      const excerpt = full.ok
        ? bodyExcerpt(full.message.text, full.message.html)
        : '(could not read this message body)';
      contextBlocks.push(
        `[${n}] From: ${fromLabel}\nSubject: ${cand.subject}\nDate: ${
          cand.date ?? 'unknown'
        }\nBody: ${excerpt}`,
      );
    }

    const llm = await sabmailLlm({
      system:
        'You answer questions about a user\'s inbox using ONLY the provided emails. Each email is tagged with a number like [1], [2]. Answer the question concisely and cite the emails you used inline with their bracketed numbers, e.g. "Your invoice is due Friday [2]." If the emails do not contain the answer, say so plainly. Never invent facts that are not in the emails.',
      prompt: `Question: ${question}\n\nEmails:\n\n${contextBlocks.join('\n\n---\n\n')}`,
      maxTokens: 800,
    });
    if (!llm.ok) return { ok: false, error: llm.error };

    return { ok: true, answer: llm.text.trim(), sources };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
