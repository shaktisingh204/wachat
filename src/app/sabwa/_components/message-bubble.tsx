"use client";

/**
 * MessageBubble — a single rendered message inside the SabWa
 * conversation pane.
 *
 * Handles text + WA-style markdown, media (image/video/audio/document),
 * quoted replies, reactions, delivery ticks, edit indicator, starred
 * indicator, and a context (right-click) menu with reply / copy /
 * delete actions. We use shadcn's `DropdownMenu` for the menu (the
 * project doesn't ship a `ContextMenu` primitive); pointer events
 * dispatched via right-click + long-press both open it.
 */

import * as React from "react";
import Image from "next/image";
import {
  Check,
  CheckCheck,
  Copy,
  CornerUpLeft,
  Download,
  FileIcon,
  Forward,
  Pencil,
  SmilePlus,
  Star,
  Trash2,
} from "lucide-react";

import { Card, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, cn } from '@/components/sabcrm/20ui';
import { formatJid, type JidResolver } from "@/lib/sabwa/format-jid";
import type { SabwaMessage, SabwaMessageStatus } from "@/lib/sabwa/types";

export interface MessageBubbleAction {
  kind:
    | "reply"
    | "react"
    | "star"
    | "copy"
    | "forward"
    | "delete_me"
    | "delete_all";
  message: SabwaMessage;
}

export interface MessageBubbleProps {
  message: SabwaMessage;
  fromMe: boolean;
  /**
   * Whether to render the quoted-author avatar in the reply pill (used
   * in group chats; not yet wired to a real avatar source).
   */
  showAvatar?: boolean;
  /** The previous messages window — used to resolve `quotedMessageId`. */
  messages?: SabwaMessage[];
  /** Triggered by the context menu (or React/Star/Copy items). */
  onAction?: (action: MessageBubbleAction) => void;
  /**
   * Optional JID-to-name resolver — used for the "quoted author" label
   * and reaction-author labels. Falls back to `formatJid` when omitted.
   */
  resolveJid?: JidResolver;
}

// 15-minute "delete for everyone" cut-off per WA spec.
const DELETE_FOR_EVERYONE_WINDOW_MS = 15 * 60 * 1000;

// Hoisted regexes — avoid recompiling per render.
const RE_BOLD = /\*([^*\n]+)\*/g;
const RE_ITALIC = /_([^_\n]+)_/g;
const RE_STRIKE = /~([^~\n]+)~/g;
const RE_CODE = /`([^`\n]+)`/g;

/**
 * Apply WhatsApp markdown to a string. Returns React nodes so styling
 * isn't lost. Sequential passes are safe because each regex consumes
 * its own delimiters and we re-encode plain text between matches.
 *
 * Note: this is *not* a full WA parser — it doesn't handle nested
 * markup or URLs. That's OK for the inbox preview-grade render.
 */
function formatWAText(s: string): React.ReactNode {
  // Token-based replacement so React keys stay stable.
  let parts: Array<string | React.ReactElement> = [s];

  function transform(
    re: RegExp,
    wrap: (inner: string, key: string) => React.ReactElement,
  ) {
    const next: Array<string | React.ReactElement> = [];
    for (let i = 0; i < parts.length; i += 1) {
      const chunk = parts[i];
      if (typeof chunk !== "string") {
        next.push(chunk);
        continue;
      }
      let lastIndex = 0;
      let m: RegExpExecArray | null;
      const fresh = new RegExp(re.source, re.flags);
      let matchIdx = 0;
      while ((m = fresh.exec(chunk)) !== null) {
        if (m.index > lastIndex) {
          next.push(chunk.slice(lastIndex, m.index));
        }
        next.push(wrap(m[1], `t-${i}-${matchIdx}`));
        lastIndex = m.index + m[0].length;
        matchIdx += 1;
      }
      if (lastIndex < chunk.length) {
        next.push(chunk.slice(lastIndex));
      }
    }
    parts = next;
  }

  transform(RE_BOLD, (inner, key) => <strong key={key}>{inner}</strong>);
  transform(RE_ITALIC, (inner, key) => <em key={key}>{inner}</em>);
  transform(RE_STRIKE, (inner, key) => (
    <span key={key} className="line-through">
      {inner}
    </span>
  ));
  transform(RE_CODE, (inner, key) => (
    <code
      key={key}
      className="rounded bg-[var(--st-bg-secondary)] px-1 py-0.5 font-mono text-[0.85em]"
    >
      {inner}
    </code>
  ));

  return parts;
}

function formatTime(ts: Date | string | number | undefined): string {
  if (!ts) return "";
  const d = typeof ts === "object" ? ts : new Date(ts);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function StatusTicks({ status }: { status: SabwaMessageStatus }) {
  if (status === "sending" || status === "failed") {
    return (
      <span aria-label={status} className="text-[10px] opacity-70">
        {status === "failed" ? "!" : "…"}
      </span>
    );
  }
  if (status === "sent") {
    return <Check aria-label="Sent" className="h-3 w-3 text-[var(--st-text-secondary)]" />;
  }
  if (status === "delivered") {
    return (
      <CheckCheck aria-label="Delivered" className="h-3 w-3 text-[var(--st-text-secondary)]" />
    );
  }
  if (status === "read") {
    return <CheckCheck aria-label="Read" className="h-3 w-3 text-[var(--st-text)]" />;
  }
  return null;
}

function QuotedPreview({
  quoted,
  showAvatar,
  resolveJid,
}: {
  quoted: SabwaMessage;
  showAvatar?: boolean;
  resolveJid?: JidResolver;
}) {
  const authorLabel = quoted.fromMe
    ? "You"
    : resolveJid
      ? resolveJid(quoted.fromJid)
      : formatJid(quoted.fromJid);
  return (
    <div className="mb-1 flex items-stretch gap-2 rounded-[var(--st-radius)] border-l-2 border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-1.5">
      {showAvatar ? (
        <div
          aria-hidden
          className="h-6 w-6 shrink-0 rounded-full bg-[var(--st-border)]"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
          {authorLabel}
        </p>
        <p className="line-clamp-1 text-[11px] text-[var(--st-text-secondary)]">
          {quoted.body ?? quoted.caption ?? `[${quoted.type}]`}
        </p>
      </div>
    </div>
  );
}

function MediaContent({ message }: { message: SabwaMessage }) {
  const { type, mediaUrl, mediaMime, mediaSize, caption, body } = message;

  if (type === "image" && mediaUrl) {
    return (
      <div className="overflow-hidden rounded-md">
        <Image
          src={mediaUrl}
          alt={caption ?? "Image"}
          width={320}
          height={320}
          className="h-auto max-h-80 w-auto max-w-full object-contain"
          unoptimized
        />
        {caption ? (
          <p className="mt-1 text-sm">{formatWAText(caption)}</p>
        ) : null}
      </div>
    );
  }

  if (type === "video" && mediaUrl) {
    return (
      <div>
        <video
          src={mediaUrl}
          controls
          className="max-h-80 max-w-full rounded-md"
        />
        {caption ? (
          <p className="mt-1 text-sm">{formatWAText(caption)}</p>
        ) : null}
      </div>
    );
  }

  if ((type === "audio" || type === "voice") && mediaUrl) {
    return <audio src={mediaUrl} controls className="w-64" />;
  }

  if (type === "document" && mediaUrl) {
    const name = (body ?? caption ?? "Document").toString();
    return (
      <Card className="flex w-72 max-w-full items-center gap-3 p-2">
        <div
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
        >
          <FileIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--st-text)]">{name}</p>
          <p className="truncate text-xs text-[var(--st-text-secondary)]">
            {mediaMime ?? ""}
            {mediaSize ? ` · ${formatSize(mediaSize)}` : ""}
          </p>
        </div>
        <a
          href={mediaUrl}
          download
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] hover:bg-[var(--st-bg-secondary)]"
          aria-label="Download"
        >
          <Download className="h-4 w-4" />
        </a>
      </Card>
    );
  }

  return null;
}

function ReactionsRow({ message }: { message: SabwaMessage }) {
  if (!message.reactions?.length) return null;
  // Group reactions by emoji.
  const counts = new Map<string, number>();
  for (const r of message.reactions) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  }
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {Array.from(counts.entries()).map(([emoji, count]) => (
        <span
          key={emoji}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--st-border)] bg-[var(--st-bg)] px-1.5 py-0.5 text-[11px]"
        >
          <span>{emoji}</span>
          {count > 1 ? <span className="tabular-nums">{count}</span> : null}
        </span>
      ))}
    </div>
  );
}

export function MessageBubble({
  message,
  fromMe,
  showAvatar = false,
  messages,
  onAction,
  resolveJid,
}: MessageBubbleProps) {
  const quoted = React.useMemo(() => {
    if (!message.quotedMessageId || !messages?.length) return null;
    return messages.find((m) => m.messageId === message.quotedMessageId) ?? null;
  }, [message.quotedMessageId, messages]);

  const canDeleteForEveryone =
    fromMe &&
    Date.now() - new Date(message.ts).getTime() < DELETE_FOR_EVERYONE_WINDOW_MS;

  const [open, setOpen] = React.useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(true);
  };

  // Long-press detection for touch users — opens the dropdown after
  // 500ms of held-finger contact.
  const pressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    pressTimer.current = setTimeout(() => setOpen(true), 500);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const fire = (kind: MessageBubbleAction["kind"]) => {
    onAction?.({ kind, message });
    setOpen(false);
  };

  return (
    <div
      className={cn(
        "flex w-full",
        fromMe ? "justify-end" : "justify-start",
      )}
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <Ui20DropdownMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onContextMenu={handleContextMenu}
            onPointerDown={onPointerDown}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            className={cn(
              "relative max-w-[min(80%,32rem)] rounded-[var(--st-radius)] px-3 py-2 text-sm shadow-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]",
              fromMe
                ? "bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/30"
                : "border border-[var(--st-border)] bg-[var(--st-bg)]",
            )}
          >
            {quoted ? (
              <QuotedPreview
                quoted={quoted}
                showAvatar={showAvatar}
                resolveJid={resolveJid}
              />
            ) : null}

            <MediaContent message={message} />

            {message.body && message.type === "text" ? (
              <p className="whitespace-pre-wrap break-words">
                {formatWAText(message.body)}
              </p>
            ) : null}

            <ReactionsRow message={message} />

            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[var(--st-text-secondary)]">
              {message.starred ? (
                <Star
                  className="h-3 w-3 text-[var(--st-text)]"
                  fill="currentColor"
                  aria-label="Starred"
                />
              ) : null}
              {message.editedAt ? (
                <span className="italic">edited</span>
              ) : null}
              <span className="tabular-nums">{formatTime(message.ts)}</span>
              {fromMe ? <StatusTicks status={message.status} /> : null}
            </div>
          </div>
        </Ui20DropdownMenuTrigger>

        <Ui20DropdownMenuContent align={fromMe ? "end" : "start"}>
          <Ui20DropdownMenuItem onSelect={() => fire("reply")}>
            <CornerUpLeft className="mr-2 h-4 w-4" /> Reply
          </Ui20DropdownMenuItem>
          <Ui20DropdownMenuItem onSelect={() => fire("react")}>
            <SmilePlus className="mr-2 h-4 w-4" /> React
          </Ui20DropdownMenuItem>
          <Ui20DropdownMenuItem onSelect={() => fire("star")}>
            <Star className="mr-2 h-4 w-4" /> Star
          </Ui20DropdownMenuItem>
          <Ui20DropdownMenuItem onSelect={() => fire("copy")}>
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Ui20DropdownMenuItem>
          <Ui20DropdownMenuItem onSelect={() => fire("forward")}>
            <Forward className="mr-2 h-4 w-4" /> Forward
          </Ui20DropdownMenuItem>
          <Ui20DropdownMenuSeparator />
          {fromMe ? (
            <Ui20DropdownMenuItem onSelect={() => fire("delete_me")}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete for me
            </Ui20DropdownMenuItem>
          ) : null}
          {canDeleteForEveryone ? (
            <Ui20DropdownMenuItem
              onSelect={() => fire("delete_all")}
              className="text-[var(--st-danger)]"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete for everyone
            </Ui20DropdownMenuItem>
          ) : null}
          {fromMe && message.editedAt ? null : null}
        </Ui20DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Pencil import is retained for future "Edit message" support — silence
// the unused-warning until that lands.
void Pencil;

export default MessageBubble;
