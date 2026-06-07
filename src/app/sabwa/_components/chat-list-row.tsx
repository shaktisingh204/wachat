"use client";

/**
 * ChatListRow - single row in the SabWa chat list.
 *
 * Renders avatar + name + last-message preview on the left, and
 * timestamp / unread / pinned / muted indicators on the right. Group
 * chats get an overlay icon on the avatar.
 *
 * The row is a pure-20ui pressable: a ghost `Button` whose fixed geometry is
 * reset so it stretches to a full-height, two-line list item. Press scale and
 * the focus ring come from the 20ui button (motion is built in, never
 * hand-rolled).
 *
 * @example
 *   <ChatListRow chat={chat} selected={chat.jid === activeJid} onClick={() => setActive(chat.jid)} />
 */

import * as React from "react";
import { Pin, UsersRound, VolumeX } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
} from "@/components/sabcrm/20ui";
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

// Shared formatter instance - avoid allocating on every render.
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
  // Always call the hook so React's hook rules stay satisfied - the inner
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
    <Button
      variant="ghost"
      block
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        // Reset the button's fixed pill geometry into a full-height, two-line
        // list row. The ghost variant keeps the press scale + focus ring.
        "group h-auto items-center justify-start gap-3 rounded-[var(--st-radius)] border-transparent px-3 py-2 text-left",
        "[&_.u-btn__label]:flex [&_.u-btn__label]:w-full [&_.u-btn__label]:items-center [&_.u-btn__label]:gap-3 [&_.u-btn__label]:overflow-visible",
        selected && "bg-[var(--st-bg-secondary)] text-[var(--st-text)]",
        className,
      )}
    >
      <span className="relative shrink-0">
        <Avatar className="h-10 w-10">
          {chat.profilePicUrl ? (
            <AvatarImage src={chat.profilePicUrl} alt={name} />
          ) : null}
          <AvatarFallback>{initialsFor(name)}</AvatarFallback>
        </Avatar>
        {isGroup ? (
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--st-bg)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
          >
            <UsersRound className="h-3 w-3" />
          </span>
        ) : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-[var(--st-text)]">{name}</span>
          {chat.muted ? (
            <VolumeX
              className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]"
              aria-label="Muted"
            />
          ) : null}
        </span>
        <span className="block truncate text-xs text-[var(--st-text-secondary)]">
          {previewPrefix}
          {previewBody}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            "text-[10px] tabular-nums",
            unread > 0 ? "text-[var(--st-text)]" : "text-[var(--st-text-secondary)]",
          )}
        >
          {tsLabel}
        </span>
        <span className="flex items-center gap-1">
          {chat.pinned ? (
            <Pin
              className="h-3 w-3 text-[var(--st-text-secondary)]"
              aria-label="Pinned"
            />
          ) : null}
          {unread > 0 ? (
            <span
              className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--st-text)] px-1.5 text-[10px] font-semibold text-[var(--st-text-inverted)]"
              aria-label={`${unread} unread`}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </span>
      </span>
    </Button>
  );
}

export default ChatListRow;
