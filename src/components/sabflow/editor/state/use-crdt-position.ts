/**
 * Throttled position-drag → CRDT writes.
 *
 * Local React state paints every drag tick so the block tracks the cursor
 * at full screen FPS, while CRDT writes are coalesced to a 30 Hz / 33 ms
 * rAF-aligned window. The final `commit: true` call force-flushes the
 * pending position so the CRDT and any peer replicas agree on the drop
 * coordinate.
 *
 * Each hook invocation owns its own throttle state (refs are per-instance),
 * so two blocks being dragged simultaneously never share a window.
 *
 * Forward-declares sibling #1's `updateNode(doc, blockId, patch)` to avoid
 * a hard import cycle until that module lands; the real export will satisfy
 * this structural type.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// -----------------------------------------------------------------------------
// Forward declarations (sibling #1 — `updateNode` and the CRDT doc handle)
// -----------------------------------------------------------------------------

/** Opaque CRDT document handle owned by sibling #1. */
export type CrdtDoc = unknown;

/** Per-block patch shape that `updateNode` accepts. */
export interface NodePatch {
  position?: Position;
  [key: string]: unknown;
}

/** Structural signature of sibling #1's `updateNode`. */
export type UpdateNodeFn = (
  doc: CrdtDoc,
  blockId: string,
  patch: NodePatch,
) => void;

// Resolved lazily so this file does not have to know sibling #1's exact path
// at import time. Sibling #1 is expected to attach `updateNode` to its module
// and export it; the editor wiring layer will register it via `__setUpdateNode`
// (see bottom of file) before any drag occurs.
let updateNodeImpl: UpdateNodeFn | null = null;

/**
 * Registration hook used by sibling #1's barrel to inject the real
 * implementation without creating an import cycle. Calling this is a no-op
 * if invoked twice with the same function.
 */
export function __setUpdateNode(fn: UpdateNodeFn): void {
  updateNodeImpl = fn;
}

function callUpdateNode(doc: CrdtDoc, blockId: string, patch: NodePatch): void {
  if (!updateNodeImpl) {
    // Sibling #1 not wired yet — drop silently. Local state still paints,
    // so the UI remains responsive during the brief boot window.
    return;
  }
  updateNodeImpl(doc, blockId, patch);
}

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export interface Position {
  x: number;
  y: number;
}

export interface SetPositionOptions {
  /** When true, force-flushes the throttle window immediately. */
  commit?: boolean;
}

export interface UseCrdtPositionResult {
  position: Position;
  setPosition: (next: Position, opts?: SetPositionOptions) => void;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

const THROTTLE_MS = 33; // ~30 Hz, one frame at 30 fps.

const ZERO: Position = { x: 0, y: 0 };

/**
 * `useCrdtPosition(doc, blockId)`
 *
 * Returns a `{ position, setPosition }` pair. `setPosition` is safe to call
 * from a drag handler at full screen rate — local state updates every call,
 * CRDT writes are throttled to ~30 Hz, and `commit: true` flushes immediately.
 */
export function useCrdtPosition(
  doc: CrdtDoc,
  blockId: string,
): UseCrdtPositionResult {
  const [position, setLocalPosition] = useState<Position>(ZERO);

  // Per-instance throttle state. Each hook call gets its own refs so two
  // blocks being dragged at once never collapse into one shared window.
  const rafIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFlushAtRef = useRef<number>(0);
  const pendingRef = useRef<Position | null>(null);
  const mountedRef = useRef<boolean>(true);

  // Track the latest `doc`/`blockId` without re-creating `setPosition`. This
  // also lets the cleanup flush write to the correct target on unmount.
  const docRef = useRef<CrdtDoc>(doc);
  const blockIdRef = useRef<string>(blockId);
  useEffect(() => {
    docRef.current = doc;
    blockIdRef.current = blockId;
  }, [doc, blockId]);

  const clearTimers = useCallback((): void => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (timerIdRef.current !== null) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
  }, []);

  const flushNow = useCallback((): void => {
    const next = pendingRef.current;
    pendingRef.current = null;
    clearTimers();
    if (!next) return;
    lastFlushAtRef.current =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    callUpdateNode(docRef.current, blockIdRef.current, { position: next });
  }, [clearTimers]);

  const scheduleFlush = useCallback((): void => {
    if (rafIdRef.current !== null || timerIdRef.current !== null) return;

    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = now - lastFlushAtRef.current;
    const wait = elapsed >= THROTTLE_MS ? 0 : THROTTLE_MS - elapsed;

    if (wait === 0 && typeof requestAnimationFrame === 'function') {
      // rAF-align to the next paint so we coalesce with React's render.
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (!mountedRef.current) return;
        flushNow();
      });
      return;
    }

    timerIdRef.current = setTimeout(() => {
      timerIdRef.current = null;
      if (!mountedRef.current) return;
      if (typeof requestAnimationFrame === 'function') {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (!mountedRef.current) return;
          flushNow();
        });
      } else {
        flushNow();
      }
    }, wait);
  }, [flushNow]);

  const setPosition = useCallback(
    (next: Position, opts?: SetPositionOptions): void => {
      // 1) Paint immediately — never let the throttle stall the cursor.
      setLocalPosition(next);

      // 2) Coalesce CRDT writes.
      pendingRef.current = next;

      if (opts?.commit) {
        flushNow();
        return;
      }
      scheduleFlush();
    },
    [flushNow, scheduleFlush],
  );

  // Cleanup: flush any pending write, then cancel all timers.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Best-effort final write so an unmount mid-drag doesn't lose the
      // last position observed locally.
      const next = pendingRef.current;
      pendingRef.current = null;
      clearTimers();
      if (next) {
        callUpdateNode(docRef.current, blockIdRef.current, { position: next });
      }
    };
  }, [clearTimers]);

  return { position, setPosition };
}
