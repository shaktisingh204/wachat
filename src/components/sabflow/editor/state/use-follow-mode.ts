'use client';

/**
 * Follow-user mode (Track A Phase 7 / sub-task 6 of 10).
 *
 * When the local user clicks a peer's avatar, the editor records that peer's
 * `userId` in `followingUserId` and passes it here.  This hook then:
 *
 *  1. Locates the followed peer in the presence list on every render.
 *  2. Smoothly pans the canvas so the peer's cursor stays centered, with a
 *     ~200 ms ease (re-target each update — the underlying `setCenter` does
 *     the lerp for us).
 *  3. Watches for any *local* user-driven pan (wheel, drag, touchmove on the
 *     canvas surface) and auto-exits follow mode when detected.
 *  4. Listens for `Escape` and exits.
 *  5. Cleans up listeners + any pending RAF on unmount.
 *
 * The hook is intentionally renderer-agnostic.  The caller passes a
 * `canvasRef` that wraps the viewport API — for SabFlow that's the React
 * Flow instance, but any object exposing `setCenter(x, y, opts)` and
 * `getZoom()` will do, so this hook stays portable + dep-free.
 *
 * The "Following Alice — press Esc to stop" banner is owned by the caller;
 * we just surface `followedPeer` so the caller can render its name/avatar.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { PresenceEntry } from '@/components/sabflow/presence/usePresence';

/** Subset of the React Flow instance we depend on — keeps the hook portable. */
export type FollowCanvasApi = {
  setCenter: (
    x: number,
    y: number,
    opts?: { duration?: number; zoom?: number },
  ) => void;
  getZoom: () => number;
};

export type UseFollowModeOptions = {
  /** Ref to a viewport controller (e.g. React Flow instance). */
  canvasRef: { current: FollowCanvasApi | null };
  /** Live presence list — typically `usePresence(flowId).others`. */
  presence: PresenceEntry[];
  /** The peer being followed, or `null` when not following. */
  followingUserId: string | null;
  /** Caller-owned setter; we call `setFollowing(null)` to exit. */
  setFollowing: (userId: string | null) => void;
};

export type UseFollowModeResult = {
  /** The presence entry for the followed peer (if still online). */
  followedPeer: PresenceEntry | null;
  /** Imperatively stop following.  Safe to call when already idle. */
  exitFollow: () => void;
};

const PAN_LERP_MS = 200;

export function useFollowMode({
  canvasRef,
  presence,
  followingUserId,
  setFollowing,
}: UseFollowModeOptions): UseFollowModeResult {
  // ---- Resolve the peer we're tracking ------------------------------------
  const followedPeer = useMemo<PresenceEntry | null>(() => {
    if (!followingUserId) return null;
    return presence.find((p) => p.userId === followingUserId) ?? null;
  }, [presence, followingUserId]);

  // Stable exit handler so consumers can wire it into UI without re-renders.
  const exitFollow = useCallback(() => {
    setFollowing(null);
  }, [setFollowing]);

  // ---- Pan the viewport whenever the followed cursor moves ----------------
  // Re-targeting `setCenter` on every presence tick gives a continuous,
  // eased follow — the underlying call handles the 200 ms lerp.
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const cx = followedPeer?.cursor?.x;
  const cy = followedPeer?.cursor?.y;
  useEffect(() => {
    if (!followingUserId) {
      lastPanRef.current = null;
      return;
    }
    if (cx === undefined || cy === undefined) return;
    const api = canvasRef.current;
    if (!api) return;

    // Skip redundant pans — saves the lerp restart when the peer is idle.
    const prev = lastPanRef.current;
    if (prev && prev.x === cx && prev.y === cy) return;
    lastPanRef.current = { x: cx, y: cy };

    try {
      api.setCenter(cx, cy, {
        duration: PAN_LERP_MS,
        zoom: api.getZoom(),
      });
    } catch {
      /* viewport API not ready — ignore; next tick will retry */
    }
  }, [canvasRef, followingUserId, cx, cy]);

  // ---- If the followed peer disappears (left the flow), bail out ----------
  useEffect(() => {
    if (followingUserId && !followedPeer) {
      // Peer dropped off presence — quietly exit.
      setFollowing(null);
    }
  }, [followingUserId, followedPeer, setFollowing]);

  // ---- Escape key exits ---------------------------------------------------
  useEffect(() => {
    if (!followingUserId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setFollowing(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [followingUserId, setFollowing]);

  // ---- Local-pan auto-exit ------------------------------------------------
  // Any user-driven pan on the canvas surface (wheel, mouse-drag with the
  // primary button held, or touch drag) breaks the follow.  We listen on
  // `window` with `capture: true` so we see the gesture before React Flow
  // consumes it, but we *don't* preventDefault — the pan should still happen.
  useEffect(() => {
    if (!followingUserId) return;

    let exited = false;
    const exit = () => {
      if (exited) return;
      exited = true;
      setFollowing(null);
    };

    const onWheel = (e: WheelEvent) => {
      // Ignore pure zoom (ctrl/⌘ + wheel) — only translational scroll exits.
      if (e.ctrlKey || e.metaKey) return;
      exit();
    };
    const onPointerDown = (e: PointerEvent) => {
      // Middle-click or primary-button drag-pan — record the start; exit
      // once the pointer actually moves so a stray click doesn't break follow.
      if (e.button !== 0 && e.button !== 1) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (m: PointerEvent) => {
        if (Math.hypot(m.clientX - startX, m.clientY - startY) > 4) {
          exit();
          cleanup();
        }
      };
      const onUp = () => cleanup();
      const cleanup = () => {
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('pointercancel', onUp, true);
      };
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onUp, true);
    };

    window.addEventListener('wheel', onWheel, { capture: true, passive: true });
    window.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [followingUserId, setFollowing]);

  return { followedPeer, exitFollow };
}
