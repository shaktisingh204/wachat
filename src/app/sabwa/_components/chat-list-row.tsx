"use client";

import { Avatar, ZoruAvatarFallback, ZoruAvatarImage } from '@/components/sabcrm/20ui/compat';
import { Pin, UsersRound, VolumeX } from "lucide-react";

/**
 * ChatListRow — single row in the SabWa chat list.
 *
 * Renders avatar + name + last-message preview on the left, and
 * timestamp / unread / pinned / muted indicators on the right. Group
 * chats get an overlay icon on the avatar.
 *
 * @example
 *   <ChatListRow chat={chat} selected={chat.jid === activeJid} onClick={() => setActive(chat.jid)} />
 */

import * as React from "react";

import { cn } from "@/lib/utils";
import { useResolveJid, type JidResolver } from "@/lib/sabwa/format-jid";
import { useSabwaSession } from "@/lib/sabwa/session-context";
import type { SabwaChat } from "@/lib/sabwa/types";

export interface ChatListRowProps {
  chat: SabwaChat;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  /**
   * Optional pre-built resolver from the parent. Lets list pages share a
   * single `useResolveJid` instance across many rows instead of each row
   * spinning up its own SWR triple.
   */
  resolve?: JidResolver;
}

// Shared formatter instance — avoid allocating on every render.
const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function formatRelative(ts: Date | string | number | undefined): string {
  if (!ts) return "";
  const date = typeof ts === "object" ? ts : new Date(ts);
  const diffMs = Date.now() - date.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "now";
  const min = Math.round(sec / 60);
  if (min < 60) return RELATIVE.format(-min, "minute");
  const hr = Math.round(min / 60);
  if (hr < 24) return RELATIVE.format(-hr, "hour");
  const day = Math.round(hr / 24);
  if (day < 7) return RELATIVE.format(-day, "day");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initialsFor(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function ChatListRow({
  chat,
  onClick,
  selected = false,
  className,
  resolve,
}: ChatListRowProps) {
  const { current } = useSabwaSession();
  // Always call the hook so React's hook rules stay satisfied — the inner
  // SWR triple is cheap when the parent already pulled the same data.
  const ownResolver = useResolveJid(current?.id);
  const resolver = resolve ?? ownResolver;
  const isGroup = chat.type === "group";
  const name = chat.name?.trim() || resolver(chat.jid);
  const previewBody = chat.lastMessage?.body ?? "";
  const previewPrefix = chat.lastMessage?.fromMe ? "You: " : "";
  const tsLabel = formatRelative(chat.lastMessage?.ts);
  const unread = chat.unreadCount ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group flex w-full items-center gap-3 rounded-[var(--zoru-radius)] px-3 py-2 text-left transition-colors",
        "hover:bg-zoru-surface-2 hover:text-zoru-ink",
        selected && "bg-zoru-surface text-zoru-ink",
        className,
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10">
          {chat.profilePicUrl ? (
            <ZoruAvatarImage src={chat.profilePicUrl} alt={name} />
          ) : null}
          <ZoruAvatarFallback>{initialsFor(name)}</ZoruAvatarFallback>
        </Avatar>
        {isGroup ? (
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-zoru-bg bg-zoru-surface text-zoru-ink"
          >
            <UsersRound className="h-3 w-3" />
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-zoru-ink">{name}</span>
          {chat.muted ? (
            <VolumeX
              className="h-3.5 w-3.5 shrink-0 text-zoru-ink-muted"
              aria-label="Muted"
            />
          ) : null}
        </div>
        <p className="truncate text-xs text-zoru-ink-muted">
          {previewPrefix}
          {previewBody}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            "text-[10px] tabular-nums",
            unread > 0 ? "text-zoru-ink" : "text-zoru-ink-muted",
          )}
        >
          {tsLabel}
        </span>
        <div className="flex items-center gap-1">
          {chat.pinned ? (
            <Pin
              className="h-3 w-3 text-zoru-ink-muted"
              aria-label="Pinned"
            />
          ) : null}
          {unread > 0 ? (
            <span
              className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-zoru-primary px-1.5 text-[10px] font-semibold text-zoru-primary-foreground"
              aria-label={`${unread} unread`}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default ChatListRow;
