import type { SabmailMessageRow } from "../actions";

/**
 * Client-side conversation grouping (JWZ-style, simplified).
 *
 * IMAP ENVELOPE gives us Message-ID + In-Reply-To for free, so we group
 * without fetching the full References chain: link children to parents via
 * In-Reply-To, then fall back to normalized-subject grouping (the JWZ subject
 * pass) for messages whose parent isn't in the loaded page. Good enough for an
 * inbox page; the full References-chain JWZ moves server-side with the sync
 * engine in Phase 1b.
 */

export interface SabmailThread {
  /** Stable key = latest message uid. */
  key: string;
  latest: SabmailMessageRow;
  /** Newest-first. */
  rows: SabmailMessageRow[];
  uids: number[];
  count: number;
  unread: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  subject: string;
}

function normalizeSubject(s: string): string {
  return s
    .replace(/^(\s*(re|fwd?|aw|wg|sv|antw)\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function ts(date: string | null): number {
  if (!date) return 0;
  const n = Date.parse(date);
  return Number.isNaN(n) ? 0 : n;
}

export function groupThreads(messages: SabmailMessageRow[]): SabmailThread[] {
  const n = messages.length;
  if (n === 0) return [];

  // Union-find.
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) {
      parent[r] = parent[parent[r]];
      r = parent[r];
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // Link by In-Reply-To → parent Message-ID.
  const byMsgId = new Map<string, number>();
  messages.forEach((m, i) => {
    if (m.messageId) byMsgId.set(m.messageId, i);
  });
  messages.forEach((m, i) => {
    if (m.inReplyTo) {
      const p = byMsgId.get(m.inReplyTo);
      if (p !== undefined) union(i, p);
    }
  });

  // Subject fallback (merges roots of the same conversation when the parent
  // isn't in the page).
  const bySubject = new Map<string, number>();
  messages.forEach((m, i) => {
    const s = normalizeSubject(m.subject || "");
    if (!s) return;
    const first = bySubject.get(s);
    if (first !== undefined) union(i, first);
    else bySubject.set(s, i);
  });

  // Collect groups.
  const groups = new Map<number, number[]>();
  messages.forEach((_, i) => {
    const r = find(i);
    const arr = groups.get(r);
    if (arr) arr.push(i);
    else groups.set(r, [i]);
  });

  const threads: SabmailThread[] = [];
  for (const idxs of groups.values()) {
    const rows = idxs
      .map((i) => messages[i])
      .sort((a, b) => ts(b.date) - ts(a.date));
    const latest = rows[0];
    threads.push({
      key: String(latest.uid),
      latest,
      rows,
      uids: rows.map((r) => r.uid),
      count: rows.length,
      unread: rows.some((r) => !r.seen),
      flagged: rows.some((r) => r.flagged),
      hasAttachments: rows.some((r) => r.hasAttachments),
      subject: latest.subject,
    });
  }

  threads.sort((a, b) => ts(b.latest.date) - ts(a.latest.date));
  return threads;
}
