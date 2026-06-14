'use client';

/**
 * useSabmailDraftPresence — collision detection for collaborative drafting.
 *
 * Heartbeats the caller's presence on `draftId` every {@link HEARTBEAT_MS} and
 * surfaces everyone ELSE editing the same draft. Pure server-action polling —
 * no WebSocket — so it works with zero extra infrastructure and is the
 * always-on baseline beneath the optional real-time CRDT layer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  syncSabmailDraftPresence,
  leaveSabmailDraft,
  type SabmailDraftEditor,
} from '@/app/sabmail/inbox/collab-actions';

const HEARTBEAT_MS = 12_000;

export interface DraftPresence {
  /** Other people currently editing this draft. */
  others: SabmailDraftEditor[];
  /** True when at least one other person is editing — show a collision banner. */
  collision: boolean;
  /** My own colour, so the composer can tint its own affordances consistently. */
  myColor: string | null;
}

export function useSabmailDraftPresence(
  draftId: string | null,
  active: boolean,
): DraftPresence {
  const [others, setOthers] = useState<SabmailDraftEditor[]>([]);
  const [myColor, setMyColor] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const beat = useCallback(async (id: string) => {
    try {
      const res = await syncSabmailDraftPresence(id);
      if (res.ok) {
        setOthers(res.others);
        setMyColor(res.me.color);
      }
    } catch {
      /* transient — keep the last roster, retry on next tick */
    }
  }, []);

  useEffect(() => {
    if (!draftId || !active) {
      setOthers([]);
      return;
    }
    let cancelled = false;
    void beat(draftId);
    timerRef.current = setInterval(() => {
      if (!cancelled) void beat(draftId);
    }, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      // Fire-and-forget release so collaborators see us drop promptly.
      void leaveSabmailDraft(draftId);
    };
  }, [draftId, active, beat]);

  return { others, collision: others.length > 0, myColor };
}
