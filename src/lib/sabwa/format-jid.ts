import * as React from 'react';

/**
 * Convert a WhatsApp JID into a human-friendly display string.
 *
 * - `91XXXXXXXXXX@s.whatsapp.net` → `+91 XXXXX XXXXX` (formatted)
 * - `12345@lid`                    → `Linked ID · 12345`
 * - `1234567890-1234@g.us`         → `Group · 1234567890`  (truncated)
 * - `status@broadcast`             → `Status`
 * - falls back to the raw JID
 *
 * Pass a `displayName` (chat.name / contact.pushName) to short-circuit.
 */
export function formatJid(
  jid: string | undefined,
  displayName?: string | null,
): string {
  if (displayName?.trim()) return displayName.trim();
  if (!jid) return 'Unknown';
  const at = jid.indexOf('@');
  if (at === -1) return jid;
  const local = jid.slice(0, at);
  const host = jid.slice(at + 1);
  if (host === 's.whatsapp.net' || host === 'c.us') {
    // Format as international phone: take all digits, prepend +.
    const digits = local.replace(/\D/g, '');
    if (digits.length >= 10) {
      const cc = digits.slice(0, digits.length - 10);
      const ten = digits.slice(-10);
      return `+${cc} ${ten.slice(0, 5)} ${ten.slice(5)}`;
    }
    return `+${digits}`;
  }
  if (host === 'lid') {
    return `Linked ID · ${local.slice(-6)}`;
  }
  if (host === 'g.us') {
    return `Group · ${local.slice(0, 12)}`;
  }
  if (host === 'broadcast') return local === 'status' ? 'Status' : `Broadcast · ${local}`;
  return jid;
}

// ─── Name-resolution helpers ────────────────────────────────────────────────
//
// `formatJid` only knows how to prettify a JID string. For real UI we usually
// have richer context — the user's chat list, address book, and group
// roster — and should prefer the human name stored there. `resolveDisplayName`
// is the single place that walks that priority chain so every SabWa page
// produces the same label for the same JID. Pair it with the
// `useResolveJid(sessionId)` hook (see `./use-sabwa-data`) to get a memoised
// resolver wired up to live SWR data.

export interface JidResolveContext {
  chats?: Array<{ jid: string; name?: string | null; type?: string | null }>;
  contacts?: Array<{ jid: string; name?: string | null; pushName?: string | null }>;
  groups?: Array<{ jid: string; subject?: string | null; name?: string | null }>;
}

/**
 * Resolve a WhatsApp JID to its best human-readable name.
 *
 * Priority: contact name → contact pushName → chat name → group subject
 * → formatted phone / JID fallback.
 */
export function resolveDisplayName(
  jid: string | undefined,
  ctx?: JidResolveContext,
): string {
  if (!jid) return 'Unknown';
  const contact = ctx?.contacts?.find((c) => c.jid === jid);
  if (contact?.name?.trim()) return contact.name.trim();
  if (contact?.pushName?.trim()) return contact.pushName.trim();
  const chat = ctx?.chats?.find((c) => c.jid === jid);
  if (chat?.name?.trim()) return chat.name.trim();
  const group = ctx?.groups?.find((g) => g.jid === jid);
  const subject = group?.subject ?? group?.name;
  if (subject?.trim()) return subject.trim();
  return formatJid(jid);
}

// ─── useResolveJid ──────────────────────────────────────────────────────────
//
// Client-side hook returning a stable `resolver(jid)` callback. Reads the
// session's contacts / chats / groups caches (via the existing SWR-style
// hooks) and falls back to `formatJid` when no friendly name is known.
//
// Imports are inside the function body to keep this module's top-level
// safe to consume from anywhere — including server components that only
// touch `formatJid` / `resolveDisplayName`.

export type JidResolver = (jid: string | undefined | null) => string;

/**
 * Resolve any WhatsApp JID to its best human-readable name for the given
 * session. The returned function is memoised; pass it freely into render
 * paths without worrying about identity churn.
 *
 * Priority: contact.name → contact.pushName → chat.name → group.subject
 * → `formatJid(jid)`.
 */
export function useResolveJid(
  sessionId: string | undefined | null,
): JidResolver {
  // Lazy require to dodge a top-level import cycle: use-sabwa-data ↔ format-jid.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const dataHooks = require('./use-sabwa-data') as typeof import('./use-sabwa-data');
  const { data: contacts } = dataHooks.useContacts(sessionId);
  const { data: chats } = dataHooks.useChats(sessionId);
  const { data: groups } = dataHooks.useGroups(sessionId);

  const map = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contacts ?? []) {
      const name = c.name?.trim() || c.pushName?.trim();
      if (name && c.jid) m.set(c.jid, name);
    }
    for (const chat of chats ?? []) {
      const name = chat.name?.trim();
      if (name && chat.jid && !m.has(chat.jid)) m.set(chat.jid, name);
    }
    for (const g of groups ?? []) {
      const subject =
        (g as { subject?: string | null; name?: string | null }).subject?.trim() ||
        (g as { name?: string | null }).name?.trim();
      if (subject && g.jid && !m.has(g.jid)) m.set(g.jid, subject);
    }
    return m;
  }, [contacts, chats, groups]);

  return React.useCallback<JidResolver>(
    (jid) => {
      if (!jid) return formatJid(undefined);
      const hit = map.get(jid);
      if (hit) return hit;
      return formatJid(jid);
    },
    [map],
  );
}
