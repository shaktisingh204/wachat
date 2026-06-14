'use client';

/**
 * useSabmailCollabBinding — two-way bind a draft's body + subject to a Yjs doc.
 *
 * Body lives in `Y.Text('body')` (HTML treated as a plain string — Yjs merges
 * concurrent edits character-by-character); subject lives in `Y.Map('meta')`.
 *
 * Caret safety: remote updates that arrive while the local user is actively
 * typing (within {@link ACTIVE_EDIT_MS}) are deferred and flushed once typing
 * settles, so a collaborator's keystroke never yanks your cursor mid-word.
 *
 * Only engages when a live, synced gateway connection exists (`live`); with no
 * gateway the returned `onLocalBody`/`onLocalSubject` are no-ops and the
 * composer behaves exactly as single-user.
 */

import { useCallback, useEffect, useRef } from 'react';
import type * as Y from 'yjs';

const ACTIVE_EDIT_MS = 1_200;
const LOCAL_ORIGIN = Symbol('sabmail-local');

interface BindingApi {
  applyBody: (html: string) => void;
  getBody: () => string;
  applySubject: (subject: string) => void;
  getSubject: () => string;
}

function replaceText(
  doc: Y.Doc,
  ytext: Y.Text,
  next: string,
  origin: symbol,
): void {
  const prev = ytext.toString();
  if (prev === next) return;
  let start = 0;
  const min = Math.min(prev.length, next.length);
  while (start < min && prev[start] === next[start]) start += 1;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev -= 1;
    endNext -= 1;
  }
  doc.transact(() => {
    if (endPrev > start) ytext.delete(start, endPrev - start);
    if (endNext > start) ytext.insert(start, next.slice(start, endNext));
  }, origin);
}

export function useSabmailCollabBinding(
  doc: Y.Doc | null,
  live: boolean,
  api: BindingApi,
) {
  // Keep the latest getters/setters in a ref so the subscription effect only
  // re-runs when the doc/connection changes, not on every parent render.
  const apiRef = useRef(api);
  apiRef.current = api;
  const lastLocalEditRef = useRef(0);

  useEffect(() => {
    if (!doc || !live) return;
    const ytext = doc.getText('body');
    const ymeta = doc.getMap('meta');
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingBody: string | null = null;

    // Seed: first editor in the room publishes their draft; later joiners adopt
    // whatever the shared doc already holds.
    if (ytext.length === 0) {
      const initial = apiRef.current.getBody();
      if (initial) replaceText(doc, ytext, initial, LOCAL_ORIGIN);
    } else {
      apiRef.current.applyBody(ytext.toString());
    }
    const seedSubject = ymeta.get('subject');
    if (typeof seedSubject === 'string' && seedSubject && seedSubject !== apiRef.current.getSubject()) {
      apiRef.current.applySubject(seedSubject);
    } else if (apiRef.current.getSubject()) {
      doc.transact(() => ymeta.set('subject', apiRef.current.getSubject()), LOCAL_ORIGIN);
    }

    const flush = () => {
      flushTimer = null;
      if (pendingBody == null) return;
      if (Date.now() - lastLocalEditRef.current < ACTIVE_EDIT_MS) {
        flushTimer = setTimeout(flush, ACTIVE_EDIT_MS);
        return;
      }
      apiRef.current.applyBody(pendingBody);
      pendingBody = null;
    };

    const onBody = (_e: Y.YTextEvent, txn: Y.Transaction) => {
      if (txn.origin === LOCAL_ORIGIN) return;
      const remote = ytext.toString();
      if (Date.now() - lastLocalEditRef.current < ACTIVE_EDIT_MS) {
        pendingBody = remote;
        if (!flushTimer) flushTimer = setTimeout(flush, ACTIVE_EDIT_MS);
      } else {
        apiRef.current.applyBody(remote);
      }
    };

    const onMeta = (_e: Y.YMapEvent<unknown>, txn: Y.Transaction) => {
      if (txn.origin === LOCAL_ORIGIN) return;
      const s = ymeta.get('subject');
      if (typeof s === 'string' && s !== apiRef.current.getSubject()) {
        apiRef.current.applySubject(s);
      }
    };

    ytext.observe(onBody);
    ymeta.observe(onMeta);

    return () => {
      ytext.unobserve(onBody);
      ymeta.unobserve(onMeta);
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [doc, live]);

  const onLocalBody = useCallback(
    (html: string) => {
      lastLocalEditRef.current = Date.now();
      if (!doc || !live) return;
      replaceText(doc, doc.getText('body'), html, LOCAL_ORIGIN);
    },
    [doc, live],
  );

  const onLocalSubject = useCallback(
    (subject: string) => {
      if (!doc || !live) return;
      doc.transact(() => doc.getMap('meta').set('subject', subject), LOCAL_ORIGIN);
    },
    [doc, live],
  );

  return { onLocalBody, onLocalSubject };
}
