'use server';

import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import {
  listSabmailMessages,
  getSabmailMessage,
} from '@/app/sabmail/inbox/actions';
import { ingestSabmailRag, type SabmailRagChunkInput } from '@/lib/sabmail/rag';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail AI ingest — build the vector index for "ask your inbox".
 *
 * User-triggered (a button in the AI surface, wired separately). Reads the
 * newest INBOX envelopes via the existing inbox actions, fetches each body
 * WITHOUT marking it seen (`markSeen: false`), trims to a clean text chunk,
 * and upserts the batch through `ingestSabmailRag` (which embeds + stores per
 * `{ workspaceId, accountId, uid }`, so re-running is idempotent).
 *
 * Defensive + capped: only the ~40 newest messages are indexed per run, body
 * fetches that fail are skipped (one bad message never aborts the batch), and
 * when embeddings are unavailable `ingestSabmailRag` returns `{ ok:false }` —
 * we surface its error verbatim rather than throwing.
 * ──────────────────────────────────────────────────────────────────── */

type IngestActionResult = { ok: true; count: number } | { ok: false; error: string };

/** Upper bound on messages indexed in a single run (caps IMAP work + embeds). */
const MAX_MESSAGES = 40;
/** Per-chunk text cap (chars) — mirrors the rag layer's own truncation. */
const MAX_CHUNK_CHARS = 2000;

/** Minimal plain-text fallback when a message has no `text/plain` part. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Index the newest ~40 INBOX messages for an account into the SabMail RAG
 * store. Returns the number of chunks ingested, or a clear error when the
 * mailbox can't be read or embeddings are not configured.
 */
export async function ingestSabmailInbox(
  accountId: string,
): Promise<IngestActionResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  if (!accountId) return { ok: false, error: 'Invalid account id.' };

  try {
    // Newest-first envelopes from INBOX (page 0 = most recent page).
    const listed = await listSabmailMessages(accountId, 'INBOX', 0, MAX_MESSAGES);
    if (!listed.ok) return { ok: false, error: listed.error };

    const rows = (listed.messages ?? []).slice(0, MAX_MESSAGES);
    if (rows.length === 0) return { ok: true, count: 0 };

    const chunks: SabmailRagChunkInput[] = [];
    for (const row of rows) {
      try {
        const full = await getSabmailMessage(accountId, 'INBOX', row.uid, {
          markSeen: false,
        });
        if (!full.ok) continue; // skip the odd unreadable message

        const msg = full.message;
        const body =
          (msg.text && msg.text.trim()) ||
          (msg.html ? stripHtml(msg.html) : '') ||
          '';
        const text = body.slice(0, MAX_CHUNK_CHARS);
        if (!text) continue; // nothing useful to embed

        chunks.push({
          accountId,
          uid: String(row.uid),
          subject: row.subject ?? msg.subject ?? '',
          from:
            row.fromName || row.fromEmail
              ? `${row.fromName ?? ''}${row.fromEmail ? ` <${row.fromEmail}>` : ''}`.trim()
              : msg.from?.email ?? '',
          date: row.date ?? msg.date ?? '',
          text,
        });
      } catch {
        // One bad fetch never aborts the batch — keep ingesting the rest.
        continue;
      }
    }

    if (chunks.length === 0) return { ok: true, count: 0 };

    const result = await ingestSabmailRag(workspaceId, chunks);
    if (!result.ok) {
      return {
        ok: false,
        error: result.error ?? 'Could not build the AI index.',
      };
    }
    return { ok: true, count: result.count };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
