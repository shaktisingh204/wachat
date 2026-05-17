'use client';

/**
 * Client hook for the polling-based presence system (Step 33).
 *
 * Posts a heartbeat every 5 s while mounted; emits the latest list of
 * "other" viewers.  Sends a DELETE on unmount so the avatar disappears
 * promptly when a tab closes (best-effort — TTL on the server also cleans
 * up abandoned entries after 15 s).
 *
 * Usage:
 *
 *   const { others, you } = usePresence(flowId);
 *
 * Cursor coordinates are optional — pass an updating ref via the second
 * arg if you want cursor sharing.  The default 5 s heartbeat is plenty
 * for "who's looking" UX; for live cursors, drop it to 1 s.
 */

import { useEffect, useState } from 'react';

type Cursor = { x: number; y: number };

export type PresenceEntry = {
  userId: string;
  name?: string;
  avatarUrl?: string;
  cursor?: Cursor;
  lastSeen: number;
};

export function usePresence(
  flowId: string,
  opts: {
    intervalMs?: number;
    cursorRef?: { current: Cursor | undefined };
  } = {},
): { you: PresenceEntry | null; others: PresenceEntry[] } {
  const [you, setYou] = useState<PresenceEntry | null>(null);
  const [others, setOthers] = useState<PresenceEntry[]>([]);

  useEffect(() => {
    if (!flowId) return;
    let cancelled = false;
    const intervalMs = Math.max(1_000, opts.intervalMs ?? 5_000);

    const beat = async () => {
      try {
        const res = await fetch(`/api/sabflow/${flowId}/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursor: opts.cursorRef?.current }),
          cache: 'no-store',
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          you: PresenceEntry;
          others: PresenceEntry[];
        };
        setYou(json.you);
        setOthers(json.others);
      } catch {
        /* network blip — try again on next tick */
      }
    };

    void beat();
    const id = setInterval(beat, intervalMs);

    // Tell the server we're gone when the tab closes.
    const onLeave = () => {
      void fetch(`/api/sabflow/${flowId}/presence`, {
        method: 'DELETE',
        keepalive: true,
      });
    };
    window.addEventListener('beforeunload', onLeave);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('beforeunload', onLeave);
      onLeave();
    };
  }, [flowId, opts.intervalMs, opts.cursorRef]);

  return { you, others };
}
