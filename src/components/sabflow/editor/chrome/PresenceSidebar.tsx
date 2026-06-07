'use client';

/**
 * PresenceSidebar - Track A Phase 7 / sub-task 7.
 *
 * Sticky right-side panel (240 px) listing every active peer in the current
 * flow editor session. Each row surfaces avatar + name + activity status
 * + Follow / Jump-to-cursor actions. The local user is pinned to the top
 * with a "(you)" suffix; remaining peers sort by most-recent activity.
 *
 * Collapsible state is persisted in localStorage under the key
 * `sabflow:presence-sidebar:open`, and a 5 s tick refreshes the relative
 * "last seen" labels without forcing parent re-renders.
 *
 * Usage:
 *
 *   <PresenceSidebar
 *     peers={peers}
 *     localUserId={me.id}
 *     onFollow={(id) => follow(id)}
 *     onJumpTo={(id) => jumpToCursor(id)}
 *   />
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, MousePointer2, Users } from 'lucide-react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Dot,
  EmptyState,
  IconButton,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'sabflow:presence-sidebar:open';
const TICK_MS = 5_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresencePeerStatus = 'active' | 'idle' | 'away';

export type PresencePeer = {
  userId: string;
  name?: string;
  avatarUrl?: string;
  status?: PresencePeerStatus;
  /** ms epoch - used to compute "last seen" labels and to sort. */
  lastSeen: number;
  /** Optional cursor coordinates for the "Jump to cursor" affordance. */
  cursor?: { x: number; y: number };
};

export type PresenceSidebarProps = {
  peers: PresencePeer[];
  localUserId: string;
  onFollow: (peerId: string) => void;
  onJumpTo: (peerId: string) => void;
  className?: string;
};

// ---------------------------------------------------------------------------
// Pure helpers (hoisted - never recreated per render)
// ---------------------------------------------------------------------------

function initialOf(peer: PresencePeer): string {
  const source = (peer.name ?? peer.userId ?? '?').trim();
  return source.charAt(0).toUpperCase() || '?';
}

function deriveStatus(peer: PresencePeer, nowMs: number): PresencePeerStatus {
  if (peer.status) return peer.status;
  const delta = nowMs - peer.lastSeen;
  if (delta < 15_000) return 'active';
  if (delta < 60_000) return 'idle';
  return 'away';
}

const STATUS_LABEL: Record<PresencePeerStatus, string> = {
  active: 'Active',
  idle: 'Idle',
  away: 'Away',
};

/** Status maps to a 20ui tone so colour carries meaning consistently. */
const STATUS_TONE: Record<PresencePeerStatus, BadgeTone> = {
  active: 'success',
  idle: 'warning',
  away: 'neutral',
};

function formatRelative(lastSeen: number, nowMs: number): string {
  const delta = Math.max(0, nowMs - lastSeen);
  if (delta < 10_000) return 'just now';
  if (delta < 60_000) return `${Math.floor(delta / 1_000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

function readPersistedOpen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw === '1' || raw === 'true';
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Sub-components (extracted to keep the parent slim & memoisable)
// ---------------------------------------------------------------------------

type PeerRowProps = {
  peer: PresencePeer;
  isSelf: boolean;
  nowMs: number;
  onFollow: (peerId: string) => void;
  onJumpTo: (peerId: string) => void;
};

function PeerRow({ peer, isSelf, nowMs, onFollow, onJumpTo }: PeerRowProps) {
  const status = deriveStatus(peer, nowMs);
  const displayName = peer.name?.trim() || peer.userId;
  const canJump = Boolean(peer.cursor) && !isSelf;
  const canFollow = !isSelf;

  const handleFollow = useCallback(() => onFollow(peer.userId), [onFollow, peer.userId]);
  const handleJump = useCallback(() => onJumpTo(peer.userId), [onJumpTo, peer.userId]);

  return (
    <li className="group flex flex-col gap-1.5 rounded-[var(--st-radius)] px-2 py-2 hover:bg-[var(--st-bg-secondary)]">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Avatar className="h-7 w-7">
            {peer.avatarUrl ? <AvatarImage src={peer.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-[10px] font-semibold">
              {initialOf(peer)}
            </AvatarFallback>
          </Avatar>
          <Dot
            tone={STATUS_TONE[status]}
            aria-label={STATUS_LABEL[status]}
            className="absolute -right-0.5 -bottom-0.5 ring-2 ring-[var(--st-bg)]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 truncate text-xs font-medium text-[var(--st-text)]">
            <span className="truncate">{displayName}</span>
            {isSelf ? (
              <span className="shrink-0 text-[10px] font-normal text-[var(--st-text-secondary)]">
                (you)
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--st-text-secondary)]">
            <span>{STATUS_LABEL[status]}</span>
            <span aria-hidden>&middot;</span>
            <span>{formatRelative(peer.lastSeen, nowMs)}</span>
          </div>
        </div>
      </div>
      {canFollow || canJump ? (
        <div className="flex items-center gap-1 pl-9 opacity-80 transition-opacity group-hover:opacity-100">
          {canFollow ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              iconLeft={Eye}
              onClick={handleFollow}
            >
              Follow
            </Button>
          ) : null}
          {canJump ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              iconLeft={MousePointer2}
              onClick={handleJump}
            >
              Jump to cursor
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PresenceSidebar({
  peers,
  localUserId,
  onFollow,
  onJumpTo,
  className,
}: PresenceSidebarProps) {
  const [open, setOpen] = useState<boolean>(readPersistedOpen);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Persist collapsed state.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      /* storage disabled - non-fatal */
    }
  }, [open]);

  // Tick every 5 s so relative-time labels stay fresh without forcing the
  // parent to re-render the whole editor.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Sort: self first, then by most-recent activity.
  const ordered = useMemo(() => {
    const self: PresencePeer[] = [];
    const rest: PresencePeer[] = [];
    for (const peer of peers) {
      if (peer.userId === localUserId) self.push(peer);
      else rest.push(peer);
    }
    rest.sort((a, b) => b.lastSeen - a.lastSeen);
    return [...self, ...rest];
  }, [peers, localUserId]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const peerCount = ordered.length;
  const onlySelf = peerCount <= 1 && ordered[0]?.userId === localUserId;

  if (!open) {
    return (
      <aside
        aria-label="Presence sidebar (collapsed)"
        className={cn(
          'sticky top-0 flex h-full w-8 shrink-0 flex-col items-center border-l border-[var(--st-border)] bg-[var(--st-bg)] py-2',
          className,
        )}
      >
        <IconButton
          label="Expand presence sidebar"
          icon={ChevronLeft}
          variant="ghost"
          size="sm"
          onClick={toggle}
        />
        <div className="mt-2 flex flex-col items-center gap-1 text-[10px] text-[var(--st-text-secondary)]">
          <Users className="h-3.5 w-3.5" aria-hidden />
          <span>{peerCount}</span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Presence sidebar"
      className={cn(
        'sticky top-0 flex h-full w-60 shrink-0 flex-col border-l border-[var(--st-border)] bg-[var(--st-bg)]',
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-[var(--st-border)] px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--st-text)]">
          <Users className="h-3.5 w-3.5" aria-hidden />
          <span>People</span>
          <Badge tone="neutral" kind="soft">
            {peerCount}
          </Badge>
        </div>
        <IconButton
          label="Collapse presence sidebar"
          icon={ChevronRight}
          variant="ghost"
          size="sm"
          onClick={toggle}
        />
      </header>

      <div className="flex-1 overflow-y-auto px-1 py-1">
        {onlySelf ? (
          <EmptyState
            size="sm"
            icon={Users}
            title="Only you"
            description="Invite teammates to start collaborating."
          />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {ordered.map((peer) => (
              <PeerRow
                key={peer.userId}
                peer={peer}
                isSelf={peer.userId === localUserId}
                nowMs={nowMs}
                onFollow={onFollow}
                onJumpTo={onJumpTo}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

export default PresenceSidebar;
