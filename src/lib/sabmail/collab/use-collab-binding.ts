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

const isHighSurrogate = (c: number) => c >= 0xd800 && c <= 0xdbff;
const isLowSurrogate = (c: number) => c >= 0xdc00 && c <= 0xdfff;

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
  // Never cut between the halves of a surrogate pair (emoji etc.) — back the
  // prefix boundary off a trailing high surrogate so the pair stays whole.
  if (start > 0 && isHighSurrogate(prev.charCodeAt(start - 1))) start -= 1;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev -= 1;
    endNext -= 1;
  }
  // ...and don't let the common suffix begin on a lone low surrogate.
  if (endPrev < prev.length && isLowSurrogate(prev.charCodeAt(endPrev))) {
    endPrev += 1;
    endNext += 1;
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

    // Seed without ever discarding the local user's in-progress text: if they
    // already typed something (the gateway can go live AFTER they start),
    // publish THAT into the shared doc; only an empty composer adopts the
    // existing shared draft.
    const localBody = apiRef.current.getBody();
    if (localBody) {
      replaceText(doc, ytext, localBody, LOCAL_ORIGIN);
    } else if (ytext.length > 0) {
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
