'use client';

import { Button } from '@/components/zoruui';
import {
  ChevronDown,
  Loader2,
  MessageSquare } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Conversation pane — the middle column of the SabWa inbox.
 *
 * Owns:
 *   - day-grouped, scroll-anchored message list
 *   - infinite scroll up (calls `loadOlder` when scrollTop hits 0)
 *   - "near-bottom" detection so incoming messages don't yank an
 *     actively-reading user back to the bottom
 *   - mark-as-read on first focus (debounced — one call per chat open)
 *   - optimistic-send wiring with temp ids
 *   - reply context + per-message context-menu actions
 */

import * as React from 'react';

import { Composer } from '@/app/sabwa/_components/composer';
import { ConversationHeader } from '@/app/sabwa/_components/conversation-header';
import { EmptyState } from '@/app/sabwa/_components/empty-state';
import { MessageBubble } from '@/app/sabwa/_components/message-bubble';
import { useResolveJid } from '@/lib/sabwa/format-jid';
import {
  markRead,
  sendMessage,
  updateChatState,
  updateMessage,
  type SabwaSendMessagePayload,
} from '@/app/actions/sabwa.actions';
import {
  useChatMessages,
  useSabwaInboxStream,
} from '@/lib/sabwa/use-sabwa-data';
import { cn } from '@/lib/utils';
import type {
  SabwaChat,
  SabwaMessage,
  SabwaMessageStatus,
} from '@/lib/sabwa/types';
import type { ObjectId } from 'mongodb';

export interface ConversationProps {
  sessionId: string;
  chat: SabwaChat;
  /** Mobile back button — clears the URL `?chat=` query. */
  onBack?: () => void;
  /** Toggles the right contact panel; `null` hides the toggle. */
  onTogglePanel?: () => void;
  panelOpen?: boolean;
  /** Hand the parent the latest in-memory messages (for the contact panel). */
  onMessagesChange?: (messages: SabwaMessage[]) => void;
  className?: string;
}

interface MessageGroup {
  /** Day key — `YYYY-MM-DD` in local time. */
  dayKey: string;
  /** Human-readable label rendered in the sticky separator. */
  label: string;
  messages: SabwaMessage[];
}

const NEAR_BOTTOM_PX = 120;

function dayKey(d: Date): string {
  const yyyy = d.getFullYear().toString().padStart(4, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function dayLabel(d: Date): string {
  const now = new Date();
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const key = dayKey(d);
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function groupByDay(messages: SabwaMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const m of messages) {
    const d = m.ts instanceof Date ? m.ts : new Date(m.ts);
    const key = dayKey(d);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === key) {
      last.messages.push(m);
    } else {
      groups.push({ dayKey: key, label: dayLabel(d), messages: [m] });
    }
  }
  return groups;
}

/**
 * Build a placeholder Mongo `ObjectId`-shaped value from a uuid string —
 * just enough to satisfy `SabwaMessage`'s structural types. The server
 * will replace this with the real id when the message lands.
 */
function tempObjectId(id: string): ObjectId {
  return id as unknown as ObjectId;
}

export function Conversation({
  sessionId,
  chat,
  onBack,
  onTogglePanel,
  panelOpen,
  onMessagesChange,
  className,
}: ConversationProps) {
  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    loadOlder,
    appendLocal,
    replaceLocal,
  } = useChatMessages(sessionId, chat.jid);
  const { subscribe } = useSabwaInboxStream(sessionId);
  const resolve = useResolveJid(sessionId);

  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const [replyTo, setReplyTo] = React.useState<SabwaMessage | null>(null);
  const [presence, setPresence] = React.useState<string | null>(null);
  const [showJumpToBottom, setShowJumpToBottom] = React.useState(false);
  const nearBottomRef = React.useRef(true);
  const markedReadRef = React.useRef<string | null>(null);

  // Notify the parent of any messages-list changes (used by ContactPanel).
  React.useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  // Reset reply state and mark-read flag whenever the chat changes.
  React.useEffect(() => {
    setReplyTo(null);
    markedReadRef.current = null;
  }, [chat.jid]);

  // Mark the chat as read once after the first successful load.
  React.useEffect(() => {
    if (loading) return;
    if (markedReadRef.current === chat.jid) return;
    if (chat.unreadCount <= 0 && messages.length === 0) return;
    markedReadRef.current = chat.jid;
    void markRead(sessionId, chat.jid).catch(() => {});
  }, [loading, sessionId, chat.jid, chat.unreadCount, messages.length]);

  // Helper: are we currently scrolled near the bottom?
  const checkNearBottom = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return true;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance < NEAR_BOTTOM_PX;
  }, []);

  // Scroll to the very bottom (used on initial load + after our own send).
  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // After initial messages load, pin to bottom.
  const didInitialScrollRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (loading) return;
    if (didInitialScrollRef.current === chat.jid) return;
    didInitialScrollRef.current = chat.jid;
    // Wait for layout to settle before scrolling.
    requestAnimationFrame(() => scrollToBottom('auto'));
  }, [loading, chat.jid, scrollToBottom]);

  // Scroll handler — drive "load older" + jump-to-bottom button.
  const onScroll = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    nearBottomRef.current = checkNearBottom();
    setShowJumpToBottom(!nearBottomRef.current);
    if (el.scrollTop <= 0 && hasMore && !loadingMore) {
      const prevHeight = el.scrollHeight;
      void loadOlder().then(() => {
        // Preserve scroll position after prepending older messages.
        requestAnimationFrame(() => {
          if (!scrollerRef.current) return;
          const delta = scrollerRef.current.scrollHeight - prevHeight;
          scrollerRef.current.scrollTop = delta;
        });
      });
    }
  }, [checkNearBottom, hasMore, loadingMore, loadOlder]);

  // Subscribe to engine events for this chat.
  React.useEffect(() => {
    const off = subscribe((event) => {
      if (event.type === 'message' && event.payload.chatJid === chat.jid) {
        appendLocal(event.payload);
        if (nearBottomRef.current && !event.payload.fromMe) {
          requestAnimationFrame(() => scrollToBottom('smooth'));
        }
      } else if (event.type === 'message_status' && event.payload.tempId) {
        // The engine will echo the real message id; swap the temp entry.
        const tempId = event.payload.tempId;
        // Build a thin SabwaMessage replacement using only the fields we know.
        replaceLocal(tempId, {
          ...(messages.find((m) => m.messageId === tempId) as SabwaMessage),
          messageId: event.payload.messageId,
          status: event.payload.status,
        });
      } else if (
        event.type === 'presence' &&
        event.payload.jid === chat.jid
      ) {
        if (event.payload.state === 'typing') setPresence('typing…');
        else if (event.payload.state === 'recording')
          setPresence('recording audio…');
        else if (event.payload.state === 'online') setPresence('online');
        else setPresence(null);
      }
    });
    return off;
  }, [subscribe, chat.jid, appendLocal, replaceLocal, scrollToBottom, messages]);

  // ─── Send pipeline ─────────────────────────────────────────────────────
  const optimisticSend = React.useCallback(
    async (payload: SabwaSendMessagePayload) => {
      const tempId = `temp-${uuidv4()}`;
      const now = new Date();
      const temp: SabwaMessage = {
        _id: tempObjectId(tempId),
        projectId: tempObjectId('temp-proj'),
        sessionId: tempObjectId(sessionId),
        chatJid: chat.jid,
        messageId: tempId,
        fromJid: 'me',
        fromMe: true,
        type: payload.type,
        body: payload.body,
        caption: payload.caption,
        mediaUrl: undefined,
        quotedMessageId: payload.quotedMessageId,
        reactions: [],
        status: 'sending' as SabwaMessageStatus,
        ts: now,
      };
      appendLocal(temp);
      setReplyTo(null);
      requestAnimationFrame(() => scrollToBottom('smooth'));
      try {
        const result = await sendMessage(sessionId, chat.jid, payload);
        if (result.ok) {
          replaceLocal(tempId, {
            ...temp,
            messageId: result.messageId,
            status: 'sent',
          });
        } else {
          replaceLocal(tempId, { ...temp, status: 'failed' });
        }
      } catch {
        replaceLocal(tempId, { ...temp, status: 'failed' });
      }
    },
    [sessionId, chat.jid, appendLocal, replaceLocal, scrollToBottom],
  );

  // Per-message context-menu actions.
  const handleBubbleAction = React.useCallback(
    async ({
      kind,
      message,
    }: {
      kind: 'reply' | 'react' | 'star' | 'copy' | 'forward' | 'delete_me' | 'delete_all';
      message: SabwaMessage;
    }) => {
      switch (kind) {
        case 'reply':
          setReplyTo(message);
          break;
        case 'copy':
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard
              .writeText(message.body ?? message.caption ?? '')
              .catch(() => {});
          }
          break;
        case 'react':
          await updateMessage(sessionId, chat.jid, message.messageId, {
            op: 'react',
            emoji: '👍',
          }).catch(() => {});
          break;
        case 'star':
          await updateMessage(sessionId, chat.jid, message.messageId, {
            op: 'star',
            starred: !message.starred,
          }).catch(() => {});
          break;
        case 'forward':
          // TODO: open forward dialog (page 9). For now no-op.
          break;
        case 'delete_me':
        case 'delete_all':
          await updateMessage(sessionId, chat.jid, message.messageId, {
            op: 'delete',
            forEveryone: kind === 'delete_all',
          }).catch(() => {});
          break;
      }
    },
    [sessionId, chat.jid],
  );

  // ─── Chat-level header actions ─────────────────────────────────────────
  const handleArchive = React.useCallback(() => {
    void updateChatState(sessionId, chat.jid, {
      archived: !chat.archived,
    }).catch(() => {});
  }, [sessionId, chat.jid, chat.archived]);

  const handleMuteToggle = React.useCallback(() => {
    void updateChatState(sessionId, chat.jid, { muted: !chat.muted }).catch(
      () => {},
    );
  }, [sessionId, chat.jid, chat.muted]);

  const groups = React.useMemo(() => groupByDay(messages), [messages]);

  return (
    <section
      className={cn('flex h-full w-full flex-col bg-zoru-bg', className)}
      aria-label="Conversation"
    >
      <ConversationHeader
        chat={chat}
        onBack={onBack}
        onTogglePanel={onTogglePanel}
        panelOpen={panelOpen}
        presence={presence}
        onArchive={handleArchive}
        onMuteToggle={handleMuteToggle}
      />

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="relative flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_hsl(var(--zoru-surface))_0%,_transparent_60%)]"
      >
        {loadingMore ? (
          <div className="flex items-center justify-center py-2 text-xs text-zoru-ink-muted">
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Loading older messages…
          </div>
        ) : null}

        {loading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="Say hi — your first message starts the conversation."
            className="h-full"
          />
        ) : (
          <div className="flex flex-col gap-1 px-3 py-3 md:px-6">
            {groups.map((group) => (
              <React.Fragment key={group.dayKey}>
                <div className="sticky top-2 z-10 mx-auto my-2 w-fit rounded-full bg-zoru-bg/90 px-3 py-1 text-[11px] font-medium text-zoru-ink-muted shadow-sm ring-1 ring-zoru-line">
                  {group.label}
                </div>
                {group.messages.map((m, idx) => {
                  const prev = group.messages[idx - 1];
                  const showAvatar =
                    chat.type === 'group' && !m.fromMe && prev?.fromJid !== m.fromJid;
                  return (
                    <MessageBubble
                      key={m.messageId}
                      message={m}
                      fromMe={m.fromMe}
                      showAvatar={showAvatar}
                      messages={messages}
                      onAction={(a) => void handleBubbleAction(a)}
                      resolveJid={resolve}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}

        {showJumpToBottom ? (
          <ZoruButton
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-3 right-3 h-9 w-9 rounded-full shadow-md"
            aria-label="Jump to latest"
          >
            <ChevronDown className="h-5 w-5" />
          </ZoruButton>
        ) : null}
      </div>

      <Composer
        sessionId={sessionId}
        chatJid={chat.jid}
        onSend={(payload) => void optimisticSend(payload)}
        replyTo={replyTo ? { message: replyTo } : null}
        onCancelReply={() => setReplyTo(null)}
      />
    </section>
  );
}

export default Conversation;
