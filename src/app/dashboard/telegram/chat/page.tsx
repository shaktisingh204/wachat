'use client';

import {
  Avatar,
  ZoruAvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Input,
  ScrollArea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Skeleton,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  ChevronRight,
  CornerUpLeft,
  Loader2,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Send,
  Smile,
  Trash2,
  Users,
  X,
  type LucideIcon,
  } from 'lucide-react';

/**
 * Telegram Chat — full inbox UI for `/dashboard/telegram/chat`.
 *
 * WhatsApp-style two-pane layout:
 *   • Left sidebar: bot/type filters, search box, chats list.
 *   • Right pane: header + virtualized message list + composer.
 *
 * Live updates come from the Next.js SSE proxy at
 * `/api/telegram/chats/[chatId]/stream`. Media uploads route through
 * the SabFile picker (Library + Upload only — no free-text URL paste,
 * per project policy).
 */

import * as React from 'react';

import {
    SabFilePicker,
    type SabFilePick,
} from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import {
    deleteChatMessage,
    editChatMessage,
    forwardChatMessage,
    getChat,
    listChatBots,
    listChatMessages,
    listChats,
    pinChatMessage,
    refreshChat,
    sendChatAction,
    sendChatMessage,
    unpinChatMessage,
} from '@/app/actions/telegram-chat-page.actions';
import type {
    ChatRow,
    MessageRow,
    SendMessageBody,
} from '@/lib/rust-client/telegram-chats';
import type { BotRow as TelegramBotRow } from '@/lib/rust-client/telegram-bots';

// ──────────────────────────────────────────────────────────────────────
//  Constants
// ──────────────────────────────────────────────────────────────────────

const TYPE_FILTERS: { value: 'all' | 'private' | 'group' | 'supergroup' | 'channel'; label: string }[] = [
    { value: 'all', label: 'All chats' },
    { value: 'private', label: 'Private' },
    { value: 'group', label: 'Groups' },
    { value: 'supergroup', label: 'Supergroups' },
    { value: 'channel', label: 'Channels' },
];

const PAGE_SIZE = 50;

// ──────────────────────────────────────────────────────────────────────
//  Top-level page
// ──────────────────────────────────────────────────────────────────────

export default function Page() {
    const { activeProjectId, activeProjectName } = useProject();
    const { toast } = useZoruToast();

    const [bots, setBots] = React.useState<TelegramBotRow[]>([]);
    const [selectedBotId, setSelectedBotId] = React.useState<string | 'all'>('all');
    const [typeFilter, setTypeFilter] = React.useState<typeof TYPE_FILTERS[number]['value']>('all');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [debouncedSearch, setDebouncedSearch] = React.useState('');

    const [chats, setChats] = React.useState<ChatRow[]>([]);
    const [chatsLoading, setChatsLoading] = React.useState(false);
    const [chatsError, setChatsError] = React.useState<string | null>(null);

    const [activeChat, setActiveChat] = React.useState<ChatRow | null>(null);

    // Load bots when project changes.
    React.useEffect(() => {
        if (!activeProjectId) {
            setBots([]);
            return;
        }
        let cancelled = false;
        void listChatBots(activeProjectId).then((res) => {
            if (cancelled) return;
            setBots(res);
        });
        return () => {
            cancelled = true;
        };
    }, [activeProjectId]);

    // Debounce search.
    React.useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // Reload chats when filters change.
    const reloadChats = React.useCallback(async () => {
        if (!activeProjectId) return;
        setChatsLoading(true);
        setChatsError(null);
        try {
            const res = await listChats({
                projectId: activeProjectId,
                botId: selectedBotId === 'all' ? undefined : selectedBotId,
                q: debouncedSearch || undefined,
                type: typeFilter === 'all' ? undefined : typeFilter,
                pageSize: 100,
            });
            if (res.error) {
                setChatsError(res.error);
                setChats([]);
            } else {
                setChats(res.chats);
            }
        } catch (e) {
            setChatsError((e as Error).message);
        } finally {
            setChatsLoading(false);
        }
    }, [activeProjectId, selectedBotId, debouncedSearch, typeFilter]);

    React.useEffect(() => {
        void reloadChats();
    }, [reloadChats]);

    // If the active chat is no longer in the visible list, clear it.
    React.useEffect(() => {
        if (!activeChat) return;
        if (!chats.some((c) => c._id === activeChat._id)) {
            // keep it — user may still want the open one — but refresh metadata
        }
    }, [chats, activeChat]);

    if (!activeProjectId) {
        return (
            <div className="flex h-[calc(100vh-8rem)] items-center justify-center p-8">
                <ZoruEmptyState
                    icon={<MessageCircle />}
                    title="Pick a project to start chatting"
                    description="Telegram chat threads are scoped to the active project."
                />
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg">
            <ChatSidebar
                bots={bots}
                selectedBotId={selectedBotId}
                onSelectBot={setSelectedBotId}
                typeFilter={typeFilter}
                onTypeFilter={setTypeFilter}
                searchTerm={searchTerm}
                onSearch={setSearchTerm}
                chats={chats}
                chatsLoading={chatsLoading}
                chatsError={chatsError}
                activeChatId={activeChat?._id ?? null}
                onPickChat={(c) => setActiveChat(c)}
                projectName={activeProjectName}
            />
            <div className="flex flex-1 flex-col">
                {activeChat ? (
                    <ChatWindow
                        key={activeChat._id}
                        chat={activeChat}
                        projectId={activeProjectId}
                        onChatUpdated={(c) => {
                            setActiveChat(c);
                            setChats((curr) =>
                                curr.map((x) => (x._id === c._id ? c : x)),
                            );
                        }}
                        onError={(msg) =>
                            toast({
                                title: 'Telegram',
                                description: msg,
                                variant: 'destructive',
                            })
                        }
                    />
                ) : (
                    <EmptyPane />
                )}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────
//  Sidebar
// ──────────────────────────────────────────────────────────────────────

interface ChatSidebarProps {
    bots: TelegramBotRow[];
    selectedBotId: string | 'all';
    onSelectBot: (v: string | 'all') => void;
    typeFilter: typeof TYPE_FILTERS[number]['value'];
    onTypeFilter: (v: typeof TYPE_FILTERS[number]['value']) => void;
    searchTerm: string;
    onSearch: (v: string) => void;
    chats: ChatRow[];
    chatsLoading: boolean;
    chatsError: string | null;
    activeChatId: string | null;
    onPickChat: (c: ChatRow) => void;
    projectName: string | null;
}

function ChatSidebar({
    bots,
    selectedBotId,
    onSelectBot,
    typeFilter,
    onTypeFilter,
    searchTerm,
    onSearch,
    chats,
    chatsLoading,
    chatsError,
    activeChatId,
    onPickChat,
    projectName,
}: ChatSidebarProps) {
    return (
        <aside className="flex w-[320px] shrink-0 flex-col border-r border-zoru-line bg-zoru-surface">
            <div className="flex items-center justify-between gap-2 border-b border-zoru-line px-4 py-3">
                <div>
                    <div className="text-sm font-semibold text-zoru-ink">Telegram</div>
                    <div className="truncate text-xs text-zoru-ink-muted">
                        {projectName ?? 'Project'}
                    </div>
                </div>
                <ZoruBadge variant="outline" className="text-[10px]">
                    {chats.length}
                </ZoruBadge>
            </div>

            <div className="flex flex-col gap-2 border-b border-zoru-line px-3 py-3">
                <ZoruSelect
                    value={selectedBotId}
                    onValueChange={(v) => onSelectBot(v as string | 'all')}
                >
                    <ZoruSelectTrigger className="h-9">
                        <ZoruSelectValue placeholder="All bots" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="all">All bots</ZoruSelectItem>
                        {bots.map((b) => (
                            <ZoruSelectItem key={b._id} value={b._id}>
                                @{b.username || b.name}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>

                <ZoruSelect
                    value={typeFilter}
                    onValueChange={(v) =>
                        onTypeFilter(v as typeof TYPE_FILTERS[number]['value'])
                    }
                >
                    <ZoruSelectTrigger className="h-9">
                        <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {TYPE_FILTERS.map((t) => (
                            <ZoruSelectItem key={t.value} value={t.value}>
                                {t.label}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>

                <ZoruInput
                    leadingSlot={<Search />}
                    placeholder="Search chats…"
                    value={searchTerm}
                    onChange={(e) => onSearch(e.target.value)}
                    className="h-9"
                />
            </div>

            <ZoruScrollArea className="flex-1">
                {chatsLoading && chats.length === 0 ? (
                    <div className="flex flex-col gap-2 p-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <ZoruSkeleton key={i} className="h-14 w-full" />
                        ))}
                    </div>
                ) : chatsError ? (
                    <div className="p-4 text-sm text-red-500">{chatsError}</div>
                ) : chats.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 p-8 text-center">
                        <MessageCircle className="h-8 w-8 text-zoru-ink-muted" />
                        <div className="text-sm text-zoru-ink-muted">No chats yet</div>
                        <div className="text-xs text-zoru-ink-muted">
                            Once users message your bot, they'll show up here.
                        </div>
                    </div>
                ) : (
                    <ul className="flex flex-col">
                        {chats.map((c) => (
                            <ChatListItem
                                key={c._id}
                                chat={c}
                                active={c._id === activeChatId}
                                onClick={() => onPickChat(c)}
                            />
                        ))}
                    </ul>
                )}
            </ZoruScrollArea>
        </aside>
    );
}

function chatDisplayName(c: ChatRow): string {
    if (c.title) return c.title;
    const parts = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
    if (parts) return parts;
    if (c.username) return `@${c.username}`;
    return c.chatId;
}

function chatInitial(c: ChatRow): string {
    const n = chatDisplayName(c);
    return n.charAt(0).toUpperCase() || '?';
}

function formatChatTimestamp(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    if (sameDay) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    if (diffDays < 7) {
        return d.toLocaleDateString([], { weekday: 'short' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ChatListItem({
    chat,
    active,
    onClick,
}: {
    chat: ChatRow;
    active: boolean;
    onClick: () => void;
}) {
    const name = chatDisplayName(chat);
    return (
        <li>
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-zoru-surface-2',
                    active && 'bg-zoru-surface-2',
                )}
            >
                <ZoruAvatar className="h-10 w-10 shrink-0">
                    <ZoruAvatarFallback className="bg-zoru-ink text-zoru-on-primary">
                        {chatInitial(chat)}
                    </ZoruAvatarFallback>
                </ZoruAvatar>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-zoru-ink">
                            {name}
                        </span>
                        <span className="shrink-0 text-[10px] text-zoru-ink-muted">
                            {formatChatTimestamp(chat.lastMessageAt)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-zoru-ink-muted">
                            {chat.lastMessagePreview || (
                                <span className="italic">No messages yet</span>
                            )}
                        </span>
                        {chat.unreadCount > 0 && (
                            <ZoruBadge className="h-5 min-w-[1.25rem] shrink-0 justify-center px-1 text-[10px]">
                                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                            </ZoruBadge>
                        )}
                    </div>
                </div>
            </button>
        </li>
    );
}

// ──────────────────────────────────────────────────────────────────────
//  Empty pane
// ──────────────────────────────────────────────────────────────────────

function EmptyPane() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zoru-surface-2">
                <MessageCircle className="h-9 w-9 text-zoru-ink-muted" />
            </div>
            <div className="text-base font-medium text-zoru-ink">
                Select a chat to start messaging
            </div>
            <div className="max-w-sm text-sm text-zoru-ink-muted">
                Pick a conversation on the left, or filter by bot and chat type
                to narrow the list.
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────
//  Chat window — header + messages + composer
// ──────────────────────────────────────────────────────────────────────

interface ChatWindowProps {
    chat: ChatRow;
    projectId: string;
    onChatUpdated: (c: ChatRow) => void;
    onError: (msg: string) => void;
}

function ChatWindow({ chat, projectId, onChatUpdated, onError }: ChatWindowProps) {
    const { toast } = useZoruToast();

    // Messages state
    const [messages, setMessages] = React.useState<MessageRow[]>([]);
    const [loadingHistory, setLoadingHistory] = React.useState(true);
    const [historyError, setHistoryError] = React.useState<string | null>(null);
    const [hasMore, setHasMore] = React.useState(false);
    const [nextCursor, setNextCursor] = React.useState<string | undefined>(undefined);
    const [loadingMore, setLoadingMore] = React.useState(false);

    // Composer state
    const [draft, setDraft] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const [replyTo, setReplyTo] = React.useState<MessageRow | null>(null);
    const [typingPreview, setTypingPreview] = React.useState(false);

    const [pickerOpen, setPickerOpen] = React.useState(false);
    const [pickerAccept, setPickerAccept] = React.useState<
        'image' | 'video' | 'document' | 'audio'
    >('image');
    /** Tracks the user's explicit attach-kind choice so a "voice" pick
     *  routes through `sendVoice` rather than the generic `sendAudio`. */
    const pickerKindRef = React.useRef<
        'photo' | 'video' | 'document' | 'audio' | 'voice' | null
    >(null);

    const scrollRef = React.useRef<HTMLDivElement | null>(null);
    const topSentinelRef = React.useRef<HTMLDivElement | null>(null);

    // ── load initial history ────────────────────────────────────────
    const loadHistory = React.useCallback(
        async (cursor?: string) => {
            const isInitial = !cursor;
            if (isInitial) {
                setLoadingHistory(true);
                setHistoryError(null);
            } else {
                setLoadingMore(true);
            }
            try {
                const res = await listChatMessages(chat._id, {
                    projectId,
                    cursor,
                    limit: PAGE_SIZE,
                });
                if (res.error) {
                    setHistoryError(res.error);
                    return;
                }
                if (isInitial) {
                    setMessages(res.messages);
                } else {
                    setMessages((curr) => [...res.messages, ...curr]);
                }
                setHasMore(Boolean(res.hasMore));
                setNextCursor(res.nextCursor);
            } catch (e) {
                setHistoryError((e as Error).message);
            } finally {
                setLoadingHistory(false);
                setLoadingMore(false);
            }
        },
        [chat._id, projectId],
    );

    React.useEffect(() => {
        setMessages([]);
        setReplyTo(null);
        setDraft('');
        void loadHistory(undefined);
    }, [loadHistory]);

    // Infinite scroll: when top sentinel intersects, load older.
    React.useEffect(() => {
        const node = topSentinelRef.current;
        if (!node || !hasMore || loadingMore || loadingHistory) return;
        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting && nextCursor) {
                        void loadHistory(nextCursor);
                    }
                }
            },
            { root: scrollRef.current, threshold: 0.1 },
        );
        io.observe(node);
        return () => io.disconnect();
    }, [hasMore, loadingMore, loadingHistory, nextCursor, loadHistory]);

    // Auto-scroll to bottom on initial load and on new outbound messages.
    const wasAtBottomRef = React.useRef(true);
    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        if (wasAtBottomRef.current) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages]);

    const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    };

    // ── SSE live stream ─────────────────────────────────────────────
    React.useEffect(() => {
        if (!chat._id || !chat.botId) return;
        const url = `/api/telegram/chats/${encodeURIComponent(chat._id)}/stream?projectId=${encodeURIComponent(projectId)}&botId=${encodeURIComponent(chat.botId)}`;
        let es: EventSource | null;
        try {
            es = new EventSource(url, { withCredentials: true });
        } catch {
            return;
        }
        const onMessage = (ev: MessageEvent) => {
            try {
                const row = JSON.parse(ev.data) as MessageRow;
                setMessages((curr) => {
                    if (curr.some((m) => m._id === row._id)) return curr;
                    return [...curr, row];
                });
            } catch {
                /* ignore */
            }
        };
        es.addEventListener('message', onMessage as EventListener);
        es.onerror = () => {
            // Browser will reconnect automatically — on visibility, we
            // also refetch to catch any rows the stream missed.
        };

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                void loadHistory(undefined);
            }
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            es?.close();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [chat._id, chat.botId, projectId, loadHistory]);

    // ── refresh metadata ─────────────────────────────────────────────
    const doRefresh = React.useCallback(async () => {
        const res = await refreshChat(chat._id, projectId, chat.botId);
        if (res.error || !res.chat) {
            onError(res.error || 'Failed to refresh chat.');
            return;
        }
        onChatUpdated(res.chat);
    }, [chat._id, chat.botId, projectId, onChatUpdated, onError]);

    // ── send a typing indicator (debounced) ──────────────────────────
    const typingStopRef = React.useRef<number | null>(null);
    React.useEffect(() => {
        if (!draft.trim()) return;
        if (typingStopRef.current) window.clearTimeout(typingStopRef.current);
        void sendChatAction(chat._id, {
            projectId,
            botId: chat.botId,
            action: 'typing',
        });
        typingStopRef.current = window.setTimeout(() => {
            typingStopRef.current = null;
        }, 3000);
        return () => {
            if (typingStopRef.current) window.clearTimeout(typingStopRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft]);

    // ── send text ───────────────────────────────────────────────────
    const doSendText = async () => {
        const text = draft.trim();
        if (!text || sending) return;
        setSending(true);
        setTypingPreview(true);
        try {
            const body: SendMessageBody = {
                projectId,
                botId: chat.botId,
                text,
                replyToMessageId: replyTo?.messageId,
            };
            const res = await sendChatMessage(chat._id, body);
            if (!res.success) {
                toast({
                    title: 'Send failed',
                    description: res.error || 'Telegram refused the message.',
                    variant: 'destructive',
                });
                return;
            }
            setDraft('');
            setReplyTo(null);
            if (res.row) {
                setMessages((curr) =>
                    curr.some((m) => m._id === res.row!._id) ? curr : [...curr, res.row!],
                );
            }
            wasAtBottomRef.current = true;
        } finally {
            setSending(false);
            setTypingPreview(false);
        }
    };

    // ── send a SabFile media ─────────────────────────────────────────
    const doSendMedia = async (
        pick: SabFilePick,
        kind: 'photo' | 'video' | 'document' | 'audio' | 'voice',
    ) => {
        setSending(true);
        try {
            await sendChatAction(chat._id, {
                projectId,
                botId: chat.botId,
                action:
                    kind === 'photo'
                        ? 'upload_photo'
                        : kind === 'video'
                          ? 'upload_video'
                          : kind === 'voice'
                            ? 'upload_voice'
                            : kind === 'audio'
                              ? 'upload_voice'
                              : 'upload_document',
            });
            const body: SendMessageBody = {
                projectId,
                botId: chat.botId,
                mediaKind: kind,
                sabFileId: pick.id,
                sabFileUrl: pick.url,
                sabFileName: pick.name,
                sabFileMime: pick.mime,
                caption: draft.trim() || undefined,
                replyToMessageId: replyTo?.messageId,
            };
            const res = await sendChatMessage(chat._id, body);
            if (!res.success) {
                toast({
                    title: 'Send failed',
                    description: res.error || 'Telegram refused the file.',
                    variant: 'destructive',
                });
                return;
            }
            setDraft('');
            setReplyTo(null);
            if (res.row) {
                setMessages((curr) =>
                    curr.some((m) => m._id === res.row!._id) ? curr : [...curr, res.row!],
                );
            }
            wasAtBottomRef.current = true;
        } finally {
            setSending(false);
        }
    };

    // Drag and drop file upload — opens the picker pre-loaded to Upload.
    const [dragOver, setDragOver] = React.useState(false);
    const dropHandlers = {
        onDragOver: (e: React.DragEvent) => {
            if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                setDragOver(true);
            }
        },
        onDragLeave: () => setDragOver(false),
        onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (!f) return;
            // Open the picker so the user can confirm — and let SabFiles
            // own the upload pipeline. This guarantees the file ends up
            // in the user's SabFiles library before being sent.
            const mime = f.type || '';
            if (mime.startsWith('image/')) setPickerAccept('image');
            else if (mime.startsWith('video/')) setPickerAccept('video');
            else if (mime.startsWith('audio/')) setPickerAccept('audio');
            else setPickerAccept('document');
            setPickerOpen(true);
        },
    };

    // ── header actions ──────────────────────────────────────────────
    const onForward = async (m: MessageRow) => {
        const toChatId = window.prompt('Forward to chat ID (e.g. @username or numeric):');
        if (!toChatId) return;
        const res = await forwardChatMessage(chat._id, m.messageId, {
            projectId,
            botId: chat.botId,
            toChatId,
        });
        toast({
            title: res.success ? 'Forwarded' : 'Forward failed',
            description: res.error,
            variant: res.success ? 'default' : 'destructive',
        });
    };

    const onPin = async (m: MessageRow) => {
        const res = await pinChatMessage(chat._id, m.messageId, {
            projectId,
            botId: chat.botId,
        });
        if (!res.success) onError(res.error || 'Pin failed.');
        else void doRefresh();
    };
    const onUnpin = async (m: MessageRow) => {
        const res = await unpinChatMessage(chat._id, m.messageId, projectId, chat.botId);
        if (!res.success) onError(res.error || 'Unpin failed.');
        else void doRefresh();
    };

    const onDelete = async (m: MessageRow) => {
        if (!window.confirm('Delete this message? This cannot be undone.')) return;
        const res = await deleteChatMessage(chat._id, m.messageId, projectId, chat.botId);
        if (!res.success) {
            onError(res.error || 'Delete failed.');
            return;
        }
        setMessages((curr) =>
            curr.map((x) => (x._id === m._id ? { ...x, isDeleted: true } : x)),
        );
    };

    const onEdit = async (m: MessageRow) => {
        const initial = m.text ?? m.caption ?? '';
        const next = window.prompt('Edit message:', initial);
        if (next === null) return;
        const body =
            m.type === 'text' ? { text: next } : { caption: next };
        const res = await editChatMessage(chat._id, m.messageId, {
            projectId,
            botId: chat.botId,
            ...body,
        });
        if (!res.success) {
            onError(res.error || 'Edit failed.');
            return;
        }
        setMessages((curr) =>
            curr.map((x) =>
                x._id === m._id
                    ? {
                          ...x,
                          ...(m.type === 'text' ? { text: next } : { caption: next }),
                          editedAt: new Date().toISOString(),
                      }
                    : x,
            ),
        );
    };

    return (
        <div
            className={cn(
                'flex h-full flex-col bg-zoru-bg',
                dragOver && 'ring-2 ring-inset ring-zoru-ink',
            )}
            {...dropHandlers}
        >
            <ChatHeader chat={chat} onRefresh={doRefresh} />

            {/* Pinned banner */}
            {chat.pinnedMessageId ? (
                <div className="flex items-center gap-2 border-b border-zoru-line bg-zoru-surface-2 px-4 py-2 text-xs text-zoru-ink-muted">
                    <Pin className="h-3.5 w-3.5" />
                    <span>Pinned message #{chat.pinnedMessageId}</span>
                </div>
            ) : null}

            {/* Message list */}
            <div
                ref={scrollRef}
                onScroll={onScroll}
                className="flex-1 overflow-y-auto px-4 py-3"
            >
                <div ref={topSentinelRef} />
                {loadingMore ? (
                    <div className="flex items-center justify-center py-2 text-xs text-zoru-ink-muted">
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Loading older…
                    </div>
                ) : null}

                {loadingHistory ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <ZoruSkeleton
                                key={i}
                                className={cn(
                                    'h-12',
                                    i % 2 === 0 ? 'w-2/3' : 'ml-auto w-1/2',
                                )}
                            />
                        ))}
                    </div>
                ) : historyError ? (
                    <div className="rounded-[var(--zoru-radius)] border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-500">
                        {historyError}
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-zoru-ink-muted">
                        Say hello — no messages yet.
                    </div>
                ) : (
                    <ul className="flex flex-col gap-1.5">
                        {messages.map((m, idx) => (
                            <MessageBubble
                                key={m._id}
                                msg={m}
                                prev={idx > 0 ? messages[idx - 1] : null}
                                replies={messages}
                                onReply={() => setReplyTo(m)}
                                onForward={() => onForward(m)}
                                onPin={() => onPin(m)}
                                onUnpin={() => onUnpin(m)}
                                onDelete={() => onDelete(m)}
                                onEdit={() => onEdit(m)}
                            />
                        ))}
                        {typingPreview ? (
                            <li className="text-xs text-zoru-ink-muted">Bot is sending…</li>
                        ) : null}
                    </ul>
                )}
            </div>

            {/* Composer */}
            <Composer
                draft={draft}
                onDraftChange={setDraft}
                onSend={doSendText}
                sending={sending}
                replyTo={replyTo}
                onClearReply={() => setReplyTo(null)}
                onAttach={(kind) => {
                    pickerKindRef.current = kind;
                    setPickerAccept(
                        kind === 'voice'
                            ? 'audio'
                            : kind === 'photo'
                              ? 'image'
                              : kind,
                    );
                    setPickerOpen(true);
                }}
            />

            {/* SabFile picker */}
            <SabFilePicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                accept={pickerAccept}
                title="Attach a file"
                onPick={(pick) => {
                    // Honor the user's explicit attach-kind choice first
                    // (so "voice" → sendVoice). Fall back to mime sniff.
                    let kind: 'photo' | 'video' | 'document' | 'audio' | 'voice' =
                        pickerKindRef.current ?? 'document';
                    pickerKindRef.current = null;
                    if (!kind) {
                        if (pick.mime?.startsWith('image/')) kind = 'photo';
                        else if (pick.mime?.startsWith('video/')) kind = 'video';
                        else if (pick.mime?.startsWith('audio/')) kind = 'audio';
                    }
                    void doSendMedia(pick, kind);
                }}
            />
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────
//  Header
// ──────────────────────────────────────────────────────────────────────

function ChatHeader({
    chat,
    onRefresh,
}: {
    chat: ChatRow;
    onRefresh: () => void;
}) {
    const name = chatDisplayName(chat);
    const subtitle =
        chat.type === 'private'
            ? chat.username
                ? `@${chat.username}`
                : 'Private chat'
            : `${chat.type}${chat.memberCount ? ` · ${chat.memberCount} members` : ''}`;

    return (
        <header className="flex items-center justify-between gap-3 border-b border-zoru-line bg-zoru-surface px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
                <ZoruAvatar className="h-10 w-10 shrink-0">
                    <ZoruAvatarFallback className="bg-zoru-ink text-zoru-on-primary">
                        {chatInitial(chat)}
                    </ZoruAvatarFallback>
                </ZoruAvatar>
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zoru-ink">{name}</div>
                    <div className="truncate text-xs text-zoru-ink-muted">{subtitle}</div>
                </div>
            </div>
            <div className="flex items-center gap-1">
                <ZoruButton variant="ghost" size="icon-sm" onClick={onRefresh}>
                    <RefreshCw />
                </ZoruButton>
                <ZoruDropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                        <ZoruButton variant="ghost" size="icon-sm">
                            <MoreVertical />
                        </ZoruButton>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem onClick={onRefresh}>
                            <RefreshCw /> Refresh metadata
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuItem
                            onClick={() => {
                                if (typeof navigator !== 'undefined') {
                                    void navigator.clipboard.writeText(chat.chatId);
                                }
                            }}
                        >
                            Copy chat id
                        </ZoruDropdownMenuItem>
                    </ZoruDropdownMenuContent>
                </ZoruDropdownMenu>
            </div>
        </header>
    );
}

// ──────────────────────────────────────────────────────────────────────
//  Message bubble
// ──────────────────────────────────────────────────────────────────────

interface BubbleProps {
    msg: MessageRow;
    prev: MessageRow | null;
    replies: MessageRow[];
    onReply: () => void;
    onForward: () => void;
    onPin: () => void;
    onUnpin: () => void;
    onDelete: () => void;
    onEdit: () => void;
}

function MessageBubble({
    msg,
    prev,
    replies,
    onReply,
    onForward,
    onPin,
    onUnpin,
    onDelete,
    onEdit,
}: BubbleProps) {
    const outbound = msg.direction === 'outbound';
    const showHeader =
        !prev ||
        prev.direction !== msg.direction ||
        (prev.fromUserId ?? '') !== (msg.fromUserId ?? '');

    const ts =
        msg.sentAt ?? msg.createdAt;
    const time = new Date(ts).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    const repliedTo = msg.replyToMessageId
        ? replies.find((r) => r.messageId === msg.replyToMessageId)
        : null;

    return (
        <li
            className={cn(
                'group flex flex-col gap-0.5',
                outbound ? 'items-end' : 'items-start',
            )}
        >
            {showHeader && !outbound && (msg.fromName || msg.fromUsername) && (
                <span className="px-2 text-[11px] font-medium text-zoru-ink-muted">
                    {msg.fromName || `@${msg.fromUsername}`}
                </span>
            )}
            <div
                className={cn(
                    'relative max-w-[70%] rounded-[var(--zoru-radius)] px-3 py-2 text-sm shadow-sm',
                    outbound
                        ? 'bg-zoru-ink text-zoru-on-primary'
                        : 'bg-zoru-surface text-zoru-ink',
                    msg.isDeleted && 'opacity-60',
                )}
            >
                {repliedTo && (
                    <div
                        className={cn(
                            'mb-1 rounded-[var(--zoru-radius-sm)] border-l-2 px-2 py-1 text-xs',
                            outbound
                                ? 'border-zoru-on-primary/50 bg-white/10'
                                : 'border-zoru-ink/50 bg-zoru-surface-2',
                        )}
                    >
                        <div className="font-medium opacity-80">
                            {repliedTo.fromName || (repliedTo.direction === 'outbound' ? 'You' : 'Them')}
                        </div>
                        <div className="line-clamp-2 opacity-80">
                            {repliedTo.text ?? repliedTo.caption ?? `[${repliedTo.type}]`}
                        </div>
                    </div>
                )}

                {msg.isDeleted ? (
                    <span className="italic opacity-70">Message deleted</span>
                ) : (
                    <>
                        {msg.mediaKind && (
                            <MediaPreview msg={msg} outbound={outbound} />
                        )}
                        {(msg.text || msg.caption) && (
                            <div className="whitespace-pre-wrap break-words">
                                {msg.text ?? msg.caption}
                            </div>
                        )}
                    </>
                )}

                <div
                    className={cn(
                        'mt-1 flex items-center justify-end gap-1 text-[10px]',
                        outbound ? 'text-zoru-on-primary/70' : 'text-zoru-ink-muted',
                    )}
                >
                    {msg.editedAt && <span>edited</span>}
                    <span>{time}</span>
                </div>

                {/* Hover actions */}
                {!msg.isDeleted && (
                    <div
                        className={cn(
                            'absolute -top-3 hidden gap-0.5 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-0.5 shadow-md group-hover:flex',
                            outbound ? 'right-2' : 'left-2',
                        )}
                    >
                        <BubbleAction icon={CornerUpLeft} label="Reply" onClick={onReply} />
                        <BubbleAction icon={ChevronRight} label="Forward" onClick={onForward} />
                        <BubbleAction icon={Pin} label="Pin" onClick={onPin} />
                        <BubbleAction icon={PinOff} label="Unpin" onClick={onUnpin} />
                        {outbound && (
                            <BubbleAction icon={Smile} label="Edit" onClick={onEdit} />
                        )}
                        {outbound && (
                            <BubbleAction
                                icon={Trash2}
                                label="Delete"
                                onClick={onDelete}
                            />
                        )}
                    </div>
                )}
            </div>
        </li>
    );
}

function BubbleAction({
    icon: Icon,
    label,
    onClick,
}: {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="flex h-6 w-6 items-center justify-center rounded-[var(--zoru-radius-sm)] text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
        >
            <Icon className="h-3.5 w-3.5" />
        </button>
    );
}

function MediaPreview({ msg, outbound }: { msg: MessageRow; outbound: boolean }) {
    const kind = msg.mediaKind ?? msg.type;
    const url = msg.mediaUrl;
    if (kind === 'photo' && url) {
        return (
            <img
                src={url}
                alt="attachment"
                className="mb-1 max-h-72 w-full rounded-[var(--zoru-radius-sm)] object-cover"
                loading="lazy"
            />
        );
    }
    if (kind === 'video' && url) {
        return (
            <video
                src={url}
                controls
                className="mb-1 max-h-72 w-full rounded-[var(--zoru-radius-sm)]"
            />
        );
    }
    if ((kind === 'audio' || kind === 'voice') && url) {
        return <audio src={url} controls className="mb-1 w-full" />;
    }
    return (
        <div
            className={cn(
                'mb-1 flex items-center gap-2 rounded-[var(--zoru-radius-sm)] border px-2 py-1.5 text-xs',
                outbound
                    ? 'border-zoru-on-primary/30'
                    : 'border-zoru-line',
            )}
        >
            <Paperclip className="h-3.5 w-3.5" />
            <span>{kind} attachment</span>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────
//  Composer
// ──────────────────────────────────────────────────────────────────────

function Composer({
    draft,
    onDraftChange,
    onSend,
    sending,
    replyTo,
    onClearReply,
    onAttach,
}: {
    draft: string;
    onDraftChange: (v: string) => void;
    onSend: () => void;
    sending: boolean;
    replyTo: MessageRow | null;
    onClearReply: () => void;
    onAttach: (kind: 'photo' | 'video' | 'document' | 'audio' | 'voice') => void;
}) {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    // Auto-grow textarea.
    React.useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = '0px';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [draft]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    const disabled = sending || !draft.trim();

    return (
        <div className="border-t border-zoru-line bg-zoru-surface px-3 pb-3 pt-2">
            {replyTo && (
                <div className="mb-2 flex items-start justify-between gap-2 rounded-[var(--zoru-radius-sm)] border-l-4 border-zoru-ink bg-zoru-surface-2 px-2 py-1.5 text-xs">
                    <div className="min-w-0">
                        <div className="font-medium text-zoru-ink">
                            Replying to {replyTo.fromName || (replyTo.direction === 'outbound' ? 'you' : 'them')}
                        </div>
                        <div className="truncate text-zoru-ink-muted">
                            {replyTo.text ?? replyTo.caption ?? `[${replyTo.type}]`}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClearReply}
                        aria-label="Cancel reply"
                        className="shrink-0 rounded-[var(--zoru-radius-sm)] p-1 text-zoru-ink-muted hover:bg-zoru-surface hover:text-zoru-ink"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
            <div className="flex items-end gap-2">
                <ZoruDropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                        <ZoruButton
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Attach file"
                            disabled={sending}
                        >
                            <Paperclip />
                        </ZoruButton>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent align="start">
                        <ZoruDropdownMenuItem onClick={() => onAttach('photo')}>
                            Photo
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem onClick={() => onAttach('video')}>
                            Video
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem onClick={() => onAttach('document')}>
                            Document
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem onClick={() => onAttach('audio')}>
                            Audio
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem onClick={() => onAttach('voice')}>
                            Voice
                        </ZoruDropdownMenuItem>
                    </ZoruDropdownMenuContent>
                </ZoruDropdownMenu>

                <ZoruButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Emoji"
                    onClick={() => onDraftChange(`${draft}🙂`)}
                    disabled={sending}
                >
                    <Smile />
                </ZoruButton>

                <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Type a message…"
                    rows={1}
                    className="flex-1 resize-none rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 py-2 text-sm text-zoru-ink placeholder:text-zoru-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-ink/30"
                />
                <ZoruButton
                    type="button"
                    onClick={onSend}
                    disabled={disabled}
                    aria-label="Send"
                    size="icon"
                >
                    {sending ? <Loader2 className="animate-spin" /> : <Send />}
                </ZoruButton>
            </div>
            <div className="mt-1 text-[10px] text-zoru-ink-muted">
                Enter to send · Shift+Enter for new line · drag a file anywhere on this pane to attach
            </div>
            <ZoruSeparator className="mt-2 opacity-0" />
            {/* Hidden tag — surface members icon on group chats but keep
                non-essential UI lightweight. */}
            <span className="sr-only">
                <Users />
            </span>
        </div>
    );
}
