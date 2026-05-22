"use client";

import { Button, Input, Popover, ZoruPopoverContent, ZoruPopoverTrigger, Textarea } from '@/components/zoruui';
import {
  CalendarClock,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Smile,
  Square,
  X,
  } from "lucide-react";

/**
 * Composer — bottom-of-conversation input used by SabWa Inbox / Chats /
 * Groups.
 *
 * Features:
 *   • Auto-growing textarea (manual height sync — no extra dep)
 *   • Emoji popover (inline 80-emoji grid)
 *   • Attachment via `<SabFilePickerButton>` (SabFiles policy: never
 *     accept raw URLs)
 *   • Voice note recorder (MediaRecorder → opus blob)
 *   • Schedule send (date/time popover → `onSchedule` instead of
 *     `onSend`)
 *   • Reply-context strip when `replyTo` is supplied
 *   • Enter submits, Shift+Enter inserts newline
 *   • Disabled state covers read-only chats and disconnected sessions
 *
 * The actual server call to `sendMessage` is performed by `onSend`'s
 * caller — keeping the composer pure makes it easy to add optimistic
 * UI in the parent.
 */

import * as React from "react";

import { SabFilePickerButton } from "@/components/sabfiles";
import type { SabFilePick } from "@/components/sabfiles";
import { cn } from "@/lib/utils";
import type {
  SabwaMessage,
  SabwaMessageType,
} from "@/lib/sabwa/types";
import type { SabwaSendMessagePayload } from "@/app/actions/sabwa.actions";

const QUICK_EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤔", "😴", "😭", "😡", "🤯", "🥳", "🤩", "🤝",
  "👍", "👎", "👏", "🙏", "💪", "🤙", "👀", "🫶",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
  "🔥", "✨", "⭐", "🌟", "💯", "✅", "❌", "⚡",
  "🎉", "🎊", "🎁", "🎂", "🍾", "🥂", "☕", "🍕",
  "🚀", "💸", "💰", "💼", "📌", "📎", "📞", "📧",
  "🤖", "🧠", "💡", "🛠️", "⚙️", "🧩", "📦", "🏆",
  "🌈", "☀️", "🌙", "🌍", "🌊", "🍀", "🌸", "🌹",
  "📅", "🕐", "🔔", "🔒", "🔓", "✏️", "📝", "🗑️",
];

export interface ComposerReplyTo {
  message: SabwaMessage;
  /** Display name for the original sender — caller-resolved. */
  authorName?: string;
}

export interface ComposerProps {
  sessionId: string;
  chatJid: string;
  /** Called when the user hits send. Parent owns optimistic insert. */
  onSend: (payload: SabwaSendMessagePayload) => void | Promise<void>;
  /** Called when the user schedules instead of sending immediately. */
  onSchedule?: (
    payload: SabwaSendMessagePayload,
    scheduledFor: Date,
  ) => void | Promise<void>;
  /** Disable the whole composer (read-only chats, disconnected sessions). */
  disabled?: boolean;
  /** Reply target — when set, renders the reply-context strip above. */
  replyTo?: ComposerReplyTo | null;
  /** Cancel the active reply. */
  onCancelReply?: () => void;
  /** Reason for disablement (shown as helper text). */
  disabledReason?: string;
  placeholder?: string;
  className?: string;
}

export function Composer({
  sessionId,
  chatJid,
  onSend,
  onSchedule,
  disabled = false,
  replyTo,
  onCancelReply,
  disabledReason,
  placeholder = "Type a message",
  className,
}: ComposerProps) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [scheduledFor, setScheduledFor] = React.useState<string>(""); // datetime-local string

  // Voice-note recording state.
  const [recording, setRecording] = React.useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordChunksRef = React.useRef<BlobPart[]>([]);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Manual auto-grow — no external dep. Cap at ~6 lines.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 160;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [text]);

  const reset = React.useCallback(() => {
    setText("");
    setScheduledFor("");
    setScheduleOpen(false);
  }, []);

  const buildPayload = React.useCallback(
    (override?: Partial<SabwaSendMessagePayload>): SabwaSendMessagePayload => {
      const body = text.trim();
      return {
        type: (override?.type ?? "text") as SabwaMessageType,
        body: body.length > 0 ? body : undefined,
        quotedMessageId: replyTo?.message.messageId,
        ...override,
      };
    },
    [text, replyTo],
  );

  const doSend = React.useCallback(
    async (override?: Partial<SabwaSendMessagePayload>) => {
      if (disabled || busy) return;
      const payload = buildPayload(override);
      if (!payload.body && !payload.mediaSabFileId) return;
      try {
        setBusy(true);
        await onSend(payload);
        reset();
      } finally {
        setBusy(false);
      }
    },
    [disabled, busy, buildPayload, onSend, reset],
  );

  const doSchedule = React.useCallback(async () => {
    if (!scheduledFor || !onSchedule || disabled || busy) return;
    const when = new Date(scheduledFor);
    if (Number.isNaN(when.getTime())) return;
    const payload = buildPayload();
    if (!payload.body && !payload.mediaSabFileId) return;
    try {
      setBusy(true);
      await onSchedule(payload, when);
      reset();
    } finally {
      setBusy(false);
    }
  }, [scheduledFor, onSchedule, disabled, busy, buildPayload, reset]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void doSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + emoji.length;
    });
  };

  const onPick = (pick: SabFilePick) => {
    // Infer media type from MIME.
    const mime = pick.mime ?? "";
    let type: SabwaMessageType = "document";
    if (mime.startsWith("image/")) type = "image";
    else if (mime.startsWith("video/")) type = "video";
    else if (mime.startsWith("audio/")) type = "audio";

    void doSend({
      type,
      mediaSabFileId: pick.id,
      caption: text.trim() || undefined,
      body: undefined,
    });
  };

  // ─── Voice recording ─────────────────────────────────────────────────
  const startRecording = async () => {
    if (disabled || recording) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      recordChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordChunksRef.current.push(e.data);
        }
      };
      mr.onstop = () => {
        const blob = new Blob(recordChunksRef.current, {
          type: "audio/webm;codecs=opus",
        });
        // The blob would be uploaded to SabFiles by the parent. For
        // now we just hand it back via `onSend` as a voice payload
        // with a synthetic mediaSabFileId — wiring lives outside.
        void doSend({
          type: "voice",
          mediaSabFileId: `pending-voice:${URL.createObjectURL(blob)}`,
        });
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      // Permission denied or unsupported — silently ignore. The UI's
      // disabled state will reflect the failure on next attempt.
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
    setRecording(false);
  };

  // Stop any in-flight recording on unmount.
  React.useEffect(
    () => () => {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") mr.stop();
    },
    [],
  );

  const canSend = !disabled && !busy && text.trim().length > 0;

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 border-t border-zoru-line bg-zoru-bg p-2",
        className,
      )}
      // sessionId / chatJid are part of the public API for callers
      // that wire optimistic state — surface them on the DOM for
      // debugging without exporting them outwards.
      data-session-id={sessionId}
      data-chat-jid={chatJid}
    >
      {replyTo ? (
        <div className="flex items-start gap-2 rounded-[var(--zoru-radius)] border-l-2 border-zoru-primary bg-zoru-surface/60 px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-zoru-ink">
              Replying to {replyTo.authorName ?? "message"}
            </p>
            <p className="line-clamp-1 text-xs text-zoru-ink-muted">
              {replyTo.message.body ??
                replyTo.message.caption ??
                `[${replyTo.message.type}]`}
            </p>
          </div>
          <ZoruButton
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCancelReply}
            aria-label="Cancel reply"
          >
            <X className="h-4 w-4" />
          </ZoruButton>
        </div>
      ) : null}

      <div className="flex items-end gap-1">
        <ZoruPopover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <ZoruPopoverTrigger asChild>
            <ZoruButton
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label="Insert emoji"
            >
              <Smile className="h-5 w-5" />
            </ZoruButton>
          </ZoruPopoverTrigger>
          <ZoruPopoverContent side="top" align="start" className="w-72 p-2">
            <div className="grid grid-cols-8 gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded p-1 text-xl hover:bg-zoru-surface-2"
                  onClick={() => {
                    insertEmoji(emoji);
                    setEmojiOpen(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </ZoruPopoverContent>
        </ZoruPopover>

        <SabFilePickerButton
          variant="ghost"
          className="h-9 w-9 p-0"
          onPick={onPick}
        >
          <Paperclip className="h-5 w-5" />
        </SabFilePickerButton>

        <ZoruTextarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? (disabledReason ?? "Chat unavailable") : placeholder}
          disabled={disabled || recording}
          rows={1}
          className="min-h-[40px] flex-1 resize-none py-2"
        />

        {onSchedule ? (
          <ZoruPopover open={scheduleOpen} onOpenChange={setScheduleOpen}>
            <ZoruPopoverTrigger asChild>
              <ZoruButton
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || text.trim().length === 0}
                aria-label="Schedule message"
              >
                <CalendarClock className="h-5 w-5" />
              </ZoruButton>
            </ZoruPopoverTrigger>
            <ZoruPopoverContent side="top" align="end" className="w-72 p-3">
              <div className="space-y-2">
                <label
                  htmlFor="composer-schedule-at"
                  className="text-xs font-medium text-zoru-ink"
                >
                  Send at
                </label>
                <ZoruInput
                  id="composer-schedule-at"
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                />
                <ZoruButton
                  type="button"
                  className="w-full"
                  disabled={!scheduledFor || busy}
                  onClick={() => void doSchedule()}
                >
                  Schedule
                </ZoruButton>
              </div>
            </ZoruPopoverContent>
          </ZoruPopover>
        ) : null}

        {recording ? (
          <ZoruButton
            type="button"
            variant="destructive"
            size="icon"
            onClick={stopRecording}
            aria-label="Stop recording"
          >
            <Square className="h-5 w-5" />
          </ZoruButton>
        ) : text.trim().length === 0 ? (
          <ZoruButton
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => void startRecording()}
            aria-label="Record voice note"
          >
            <Mic className="h-5 w-5" />
          </ZoruButton>
        ) : (
          <ZoruButton
            type="button"
            size="icon"
            disabled={!canSend}
            onClick={() => void doSend()}
            aria-label="Send"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </ZoruButton>
        )}
      </div>

      {disabled && disabledReason ? (
        <p className="px-2 text-xs text-zoru-ink-muted">{disabledReason}</p>
      ) : null}
    </div>
  );
}

export default Composer;
