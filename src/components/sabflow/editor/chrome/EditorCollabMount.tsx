'use client';

/**
 * SabFlow editor — collaboration mount (Phase C.8.2).
 *
 * Wires the existing presence components (`PresenceAvatarStack` and
 * `RemoteCursors`) into the live editor. All three components already exist
 * in `src/components/sabflow/editor/{chrome,overlays}/` but were not mounted
 * anywhere — `docs/inventory/collab-state.md §3` flagged this gap.
 *
 * This file deliberately doesn't modify the underlying components; it just
 * adapts the `usePresence` polling hook's `{ userId, name, avatarUrl, lastSeen }`
 * entries into the shapes those components expect, and gates the whole thing
 * behind the `NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED` flag so the polling /
 * presence beacon stays off by default until ops opt in.
 *
 * One presence beacon per editor
 * ──────────────────────────────
 * We run `usePresence(flowId)` exactly once at the `<CollabProvider>` shell,
 * then fan the result out through React Context. That way the header avatar
 * stack and the canvas cursor overlay share the same polling cycle instead
 * of each opening their own 5 s beacon.
 *
 * Typing indicators (`overlays/TypingIndicators.tsx`) are per-block — they
 * need a `blockId` and a peers array, so they live inside the block-card
 * renderer rather than at the editor shell level. See the TODO at the bottom
 * of this file for the follow-up that mounts them block-side.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { PresenceAvatarStack, type PresencePeer as AvatarPeer } from './PresenceAvatarStack';
import {
  RemoteCursors,
  type RemoteCursorCanvasHandle,
  type RemoteCursorPeer,
} from '../overlays/RemoteCursors';
import { usePresence, type PresenceEntry } from '@/components/sabflow/presence/usePresence';
import { colorForUserId } from '@/lib/sabflow/client/user-color';

// ─────────────────────────────────────────────────────────────────────────────
// Feature flag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single source of truth for the SabFlow collab gate. Re-exported so other
 * editor sub-trees (e.g. typing-indicator block wrapper, future cursor
 * broadcast) can `import { isCollabEnabled } from './EditorCollabMount'`
 * without duplicating the env-string parsing logic.
 *
 * Defaults to `false` so the polling presence beacon doesn't start hitting
 * `/api/sabflow/[flowId]/presence` until ops explicitly flip the flag.
 */
export function isCollabEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED;
  return raw === '1' || raw === 'true';
}

// ─────────────────────────────────────────────────────────────────────────────
// Idle threshold — kept in sync with PresenceAvatarStack's visual contract.
// usePresence doesn't compute `idle`, so we derive it here from `lastSeen`.
// ─────────────────────────────────────────────────────────────────────────────

const IDLE_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Mapping helpers (hoisted — pure functions, no per-render allocation)
// ─────────────────────────────────────────────────────────────────────────────

function toAvatarPeer(entry: PresenceEntry, now: number): AvatarPeer {
  const trimmed = (entry.name ?? '').trim();
  return {
    id: entry.userId,
    name: trimmed.length > 0 ? trimmed : entry.userId,
    color: colorForUserId(entry.userId),
    avatarUrl: entry.avatarUrl ?? null,
    lastActiveAt: entry.lastSeen,
    idle: now - entry.lastSeen > IDLE_MS,
  };
}

function toCursorPeer(entry: PresenceEntry): RemoteCursorPeer {
  const trimmed = (entry.name ?? '').trim();
  return {
    userId: entry.userId,
    name: trimmed.length > 0 ? trimmed : entry.userId,
    color: colorForUserId(entry.userId),
    cursor: entry.cursor ?? null,
    lastSeen: entry.lastSeen,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Context — shared presence state for the editor shell
// ─────────────────────────────────────────────────────────────────────────────

interface CollabContextValue {
  readonly enabled: boolean;
  readonly you: PresenceEntry | null;
  readonly others: readonly PresenceEntry[];
}

const EMPTY_CONTEXT: CollabContextValue = {
  enabled: false,
  you: null,
  others: [],
};

const CollabContext = createContext<CollabContextValue>(EMPTY_CONTEXT);

export interface CollabProviderProps {
  readonly flowId: string;
  readonly children: ReactNode;
}

/**
 * Editor-shell provider that runs the presence beacon once and exposes the
 * result to descendants. When the collab flag is off we pass an empty flowId
 * to `usePresence` so its polling effect short-circuits, and the context
 * stays at its empty default — descendants render `null`.
 */
export function CollabProvider({ flowId, children }: CollabProviderProps) {
  const enabled = isCollabEnabled();
  const presence = usePresence(enabled ? flowId : '');

  const value = useMemo<CollabContextValue>(
    () => ({ enabled, you: presence.you, others: presence.others }),
    [enabled, presence.you, presence.others],
  );

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}

function useCollabContext(): CollabContextValue {
  return useContext(CollabContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Header mount — PresenceAvatarStack
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders the active-collaborator avatar stack in the editor header. Returns
 * `null` when the collab flag is off OR no peers (including the local user)
 * are connected yet — the header shouldn't reserve dead space.
 */
export function CollabAvatarStack() {
  const { enabled, you, others } = useCollabContext();

  const peers = useMemo<AvatarPeer[]>(() => {
    if (!enabled) return [];
    const now = Date.now();
    const merged: PresenceEntry[] = [];
    if (you) merged.push(you);
    for (const o of others) merged.push(o);
    return merged.map((e) => toAvatarPeer(e, now));
  }, [enabled, you, others]);

  if (!enabled || peers.length === 0) return null;

  return (
    <div
      className="flex items-center"
      data-testid="sabflow-collab-avatar-stack"
      aria-label="Active collaborators"
    >
      <PresenceAvatarStack peers={peers} max={5} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas overlay — RemoteCursors
// ─────────────────────────────────────────────────────────────────────────────

export interface CollabRemoteCursorsProps {
  /**
   * Optional canvas handle exposing `getViewport()`. When absent (current
   * `WorkflowCanvas` — see C.8.2 inventory note), RemoteCursors falls back
   * to an identity viewport (`zoom: 1, pan: 0, 0`), which still renders the
   * cursors in screen-space — useful for the initial mount until the canvas
   * exposes a proper imperative handle in a follow-up sub-task.
   */
  readonly canvasRef?: { readonly current: RemoteCursorCanvasHandle | null };
}

/** Stable identity viewport so RemoteCursors paints cursors in screen-space. */
const IDENTITY_HANDLE: RemoteCursorCanvasHandle = {
  getViewport() {
    return { x: 0, y: 0, zoom: 1 };
  },
};
const IDENTITY_REF = { current: IDENTITY_HANDLE } as const;

/**
 * Mounts the remote-cursors overlay as an absolutely-positioned sibling of
 * the canvas. The overlay sets `pointer-events: none` itself, so this just
 * needs to be inside the same relatively-positioned parent as the canvas.
 *
 * Renders `null` when collab is disabled or there are no remote peers — the
 * overlay never reserves layout space (it's `position: absolute; inset: 0`),
 * but skipping the React tree entirely avoids paying for the rAF loop while
 * gated off.
 */
export function CollabRemoteCursors({ canvasRef }: CollabRemoteCursorsProps) {
  const { enabled, others } = useCollabContext();

  const peers = useMemo<RemoteCursorPeer[]>(() => {
    if (!enabled) return [];
    return others.map(toCursorPeer);
  }, [enabled, others]);

  if (!enabled || peers.length === 0) return null;

  return (
    <RemoteCursors
      presence={{ others: peers }}
      canvasRef={canvasRef ?? IDENTITY_REF}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TODO — Typing indicators (Phase C.8.3+)
// ─────────────────────────────────────────────────────────────────────────────
// `overlays/TypingIndicators.tsx` is a per-block pill (`<TypingIndicators
// blockId=... peers=... />`). It belongs inside the BlockCard renderer, not
// here at the editor shell. Tracking as a follow-up: thread the peers array
// from this mount down to BlockCard via context, then render the pill below
// each block whose `id` appears in a peer's `typing.blockId` slot.
