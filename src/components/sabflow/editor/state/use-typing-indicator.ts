'use client';

/**
 * Track Audit A · Phase 7 · Sub-task 5/10 — Typing indicators.
 *
 * `useTypingIndicator(presence, blockId, isTyping)` writes a `{ typing:
 * { blockId, at } }` patch into the caller's local presence slot whenever
 * `isTyping` flips to `true`, then clears the key after a 2 s debounce of
 * stillness. The companion `<TypingIndicators />` overlay reads those slots
 * out of `peers` and renders a "Alice is typing…" pill below the matching
 * block.
 *
 * The hook is intentionally side-effect-only — it returns helpers for
 * block editors that prefer to bind the typing flag to raw `input` / `change`
 * DOM events rather than a React-controlled `isTyping` prop. Both modes
 * write into the same underlying presence slot, so callers can mix and
 * match without double-bookkeeping.
 *
 * No external deps — just `useEffect` / `useRef` / `useCallback` from React.
 */

import { useCallback, useEffect, useRef } from 'react';

/** Per-block typing slot we stash on the local presence entry. */
export type TypingSignal = {
  blockId: string;
  /** `Date.now()` at the moment the heartbeat fired. */
  at: number;
};

/** Minimal duck-typed contract for the presence store this hook talks to. */
export type PresenceLike = {
  setLocal: (patch: { typing?: TypingSignal | null }) => void;
};

/** How long after the last keystroke we keep advertising "still typing". */
const TYPING_DEBOUNCE_MS = 2_000;

/** Refresh cadence while continuously typing so peers see fresh `at` values. */
const TYPING_HEARTBEAT_MS = 1_500;

export type UseTypingIndicatorResult = {
  /**
   * Imperatively mark the local user as typing on the bound block. Useful
   * for block editors that aren't React-controlled — wire this directly
   * into `onInput` / `onChange`.
   */
  ping: () => void;
  /**
   * Attach `input` / `change` listeners to a DOM node so any keystroke
   * triggers a `ping()`. Returns a cleanup function. Designed to be called
   * from a `ref` callback, e.g.
   *
   *     <textarea ref={(el) => el && bind(el)} />
   */
  bind: (el: HTMLElement | null) => () => void;
};

/**
 * Publish a "user X is editing block Y" signal into shared presence.
 *
 * - When `isTyping` is `true` the hook writes a fresh `{ blockId, at }`
 *   slot and re-heartbeats it every {@link TYPING_HEARTBEAT_MS}.
 * - After {@link TYPING_DEBOUNCE_MS} of stillness (no `ping()` and
 *   `isTyping === false`) the slot is cleared with `setLocal({ typing:
 *   null })` so consumers can drop the pill immediately.
 */
export function useTypingIndicator(
  presence: PresenceLike | null | undefined,
  blockId: string,
  isTyping: boolean,
): UseTypingIndicatorResult {
  // Keep a stable handle to the live presence reference so the effect
  // below doesn't re-run on every parent re-render. `setLocal` is
  // typically a stable function on the presence store, but we don't
  // assume that.
  const presenceRef = useRef<PresenceLike | null | undefined>(presence);
  presenceRef.current = presence;

  const blockIdRef = useRef(blockId);
  blockIdRef.current = blockId;

  /** Timer that fires the clear-after-stillness. */
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Timer that re-emits the slot while the user is actively typing. */
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Track whether we've already published a slot — avoids redundant writes. */
  const activeRef = useRef(false);

  const clearSlot = useCallback(() => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (!activeRef.current) return;
    activeRef.current = false;
    presenceRef.current?.setLocal({ typing: null });
  }, []);

  const writeSlot = useCallback(() => {
    const p = presenceRef.current;
    if (!p) return;
    p.setLocal({ typing: { blockId: blockIdRef.current, at: Date.now() } });
    activeRef.current = true;
  }, []);

  /**
   * Public `ping()` — debounced clear + heartbeat scheduler.  Safe to call
   * on every keystroke; the underlying writes are coalesced.
   */
  const ping = useCallback(() => {
    writeSlot();

    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(clearSlot, TYPING_DEBOUNCE_MS);

    if (!heartbeatTimerRef.current) {
      heartbeatTimerRef.current = setInterval(writeSlot, TYPING_HEARTBEAT_MS);
    }
  }, [writeSlot, clearSlot]);

  /**
   * DOM-binding helper.  Returns a cleanup function so callers using
   * `useEffect` can wire it up imperatively when refs aren't available.
   */
  const bind = useCallback(
    (el: HTMLElement | null): (() => void) => {
      if (!el) return () => {};
      const handler = () => ping();
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
      return () => {
        el.removeEventListener('input', handler);
        el.removeEventListener('change', handler);
      };
    },
    [ping],
  );

  // React-controlled path: whenever the caller flips `isTyping` we drive
  // the same machinery.  When it falls back to `false`, we schedule the
  // 2 s debounce instead of clearing immediately so a quick keyup-then-
  // keydown stays continuous to peers.
  useEffect(() => {
    if (isTyping) {
      ping();
      return;
    }
    if (!activeRef.current) return;
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(clearSlot, TYPING_DEBOUNCE_MS);
  }, [isTyping, ping, clearSlot]);

  // If the block this hook is bound to changes (rare — usually the hook
  // is mounted per-block), drop the old slot so the previous block
  // doesn't keep showing the pill.
  useEffect(() => {
    return () => {
      clearSlot();
    };
  }, [blockId, clearSlot]);

  // Final unmount cleanup — guarantee no orphan slot lingers in presence.
  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (activeRef.current) presenceRef.current?.setLocal({ typing: null });
      activeRef.current = false;
    };
  }, []);

  return { ping, bind };
}
