'use client';

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Input, PageDescription, PageHeader, PageHeading, PageTitle, useToast } from '@/components/sabcrm/20ui';
import {
  format,
  formatDistanceToNowStrict,
  isSameDay } from 'date-fns';
import {
    Bell,
  Image as ImageIcon,
  Loader,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  Users,
  X,
  } from 'lucide-react';

import * as React from 'react';

import {
    createGroupChannel,
    getChannelMessages,
    getOrCreateDmChannel,
    listTeamChannels,
    sendTeamMessage,
    addReactionToTeamMessage,
    removeReactionFromTeamMessage,
    pinTeamMessage,
    unpinTeamMessage,
    listPinnedMessages,
    bookmarkTeamMessage,
    setTeamPresence,
    getTeamPresenceMap,
    type TeamChannelView,
    type OutgoingAttachment,
} from '@/app/actions/team-chat.actions';
import type {
    PinnedMessageView,
    PresenceView,
} from '@/app/actions/team-chat.actions.types';
import { getInvitedUsers } from '@/app/actions/team.actions';
import { useCan, useProject } from '@/context/project-context';
import type { TeamMessage, User, WithId } from '@/lib/definitions';
import { SabFileToFileButton } from '@/components/sabfiles';
import { ReactionsBar } from './_components/reactions-bar';
import { PresenceDot } from './_components/presence-dot';
import { ThreadPanel } from './_components/thread-panel';
import { PinnedStrip } from './_components/pinned-strip';
import { BookmarksView } from './_components/bookmarks-view';
import { HuddleDrawer } from './_components/huddle-drawer';
import {
    ComposerExtras,
    type MentionCandidate,
} from './_components/composer-extras';
import { Bookmark, Headphones, MessageCircleReply, Pin, PinOff } from 'lucide-react';

const POLL_MS = 3000;

export default function TeamChatPage() {
    const { toast } = useToast();
    const { sessionUser } = useProject();
    const canRead = useCan('team_chat', 'view');
    const canSend = useCan('team_chat', 'create');

    const [channels, setChannels] = React.useState<TeamChannelView[]>([]);
    const [members, setMembers] = React.useState<WithId<User>[]>([]);
    const [selectedChannelId, setSelectedChannelId] = React.useState<string | null>(null);
    const [messages, setMessages] = React.useState<WithId<TeamMessage>[]>([]);
    const [channelsLoading, setChannelsLoading] = React.useState(true);
    const [messagesLoading, setMessagesLoading] = React.useState(false);
    const [sending, setSending] = React.useState(false);
    const [input, setInput] = React.useState('');
    const [attachmentQueue, setAttachmentQueue] = React.useState<OutgoingAttachment[]>([]);
    const [notifPerm, setNotifPerm] = React.useState<NotificationPermission>('default');
    const [sidebarQuery, setSidebarQuery] = React.useState('');

    /* ─── SabCliq state ─── */
    const [pinned, setPinned] = React.useState<PinnedMessageView[]>([]);
    const [presence, setPresence] = React.useState<Record<string, PresenceView>>({});
    const [threadRootId, setThreadRootId] = React.useState<string | null>(null);
    const [bookmarksOpen, setBookmarksOpen] = React.useState(false);
    const [huddleOpen, setHuddleOpen] = React.useState(false);

    const scrollRef = React.useRef<HTMLDivElement | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const lastSeenCountRef = React.useRef(0);
    const messageNodeRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

    React.useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotifPerm(Notification.permission);
        }
    }, []);

    const reloadChannels = React.useCallback(async () => {
        const list = await listTeamChannels();
        setChannels(list);
        if (!selectedChannelId && list.length > 0) setSelectedChannelId(list[0]._id);
    }, [selectedChannelId]);

    const reloadMembers = React.useCallback(async () => {
        const all = await getInvitedUsers();
        const meId = sessionUser?._id;
        setMembers((all as WithId<User>[]).filter((u) => u._id.toString() !== meId));
    }, [sessionUser?._id]);

    React.useEffect(() => {
        setChannelsLoading(true);
        Promise.all([reloadChannels(), reloadMembers()]).finally(() => setChannelsLoading(false));
    }, [reloadChannels, reloadMembers]);

    const selectedChannel = React.useMemo(
        () => channels.find((c) => c._id === selectedChannelId) || null,
        [channels, selectedChannelId],
    );

    const loadMessages = React.useCallback(async () => {
        if (!selectedChannelId) {
            setMessages([]);
            return;
        }
        const msgs = await getChannelMessages(selectedChannelId);
        setMessages(msgs);
    }, [selectedChannelId]);

    React.useEffect(() => {
        if (!selectedChannelId) return;
        setMessagesLoading(true);
        loadMessages().finally(() => setMessagesLoading(false));
        lastSeenCountRef.current = 0;
    }, [selectedChannelId, loadMessages]);

    /* Pinned messages — refetched on channel change. */
    const loadPinned = React.useCallback(async () => {
        if (!selectedChannelId) {
            setPinned([]);
            return;
        }
        const list = await listPinnedMessages(selectedChannelId);
        setPinned(list);
    }, [selectedChannelId]);

    React.useEffect(() => {
        void loadPinned();
    }, [loadPinned]);

    /* Presence — best-effort, includes me + selected channel participants. */
    const loadPresence = React.useCallback(async () => {
        const ids = new Set<string>();
        if (sessionUser?._id) ids.add(sessionUser._id);
        for (const c of channels) {
            for (const p of c.participants) ids.add(p.userId);
        }
        for (const u of members) ids.add(u._id.toString());
        if (!ids.size) return;
        const map = await getTeamPresenceMap(Array.from(ids));
        setPresence(map);
    }, [channels, members, sessionUser?._id]);

    React.useEffect(() => {
        void loadPresence();
        const t = setInterval(() => void loadPresence(), 15_000);
        return () => clearInterval(t);
    }, [loadPresence]);

    /* Heartbeat presence to online while the tab is visible. */
    React.useEffect(() => {
        if (!sessionUser?._id) return;
        const beat = () => {
            void setTeamPresence(document.hidden ? 'away' : 'online');
        };
        beat();
        const id = setInterval(beat, 30_000);
        const onVis = () => beat();
        document.addEventListener('visibilitychange', onVis);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVis);
            void setTeamPresence('offline').catch(() => {});
        };
    }, [sessionUser?._id]);

    // Poll for new messages.
    React.useEffect(() => {
        if (!selectedChannelId) return;
        const interval = setInterval(async () => {
            const next = await getChannelMessages(selectedChannelId);
            setMessages((prev) => {
                if (next.length > lastSeenCountRef.current && prev.length > 0) {
                    const latest = next[next.length - 1];
                    const isSelf = latest.senderId?.toString() === sessionUser?._id;
                    if (!isSelf && notifPerm === 'granted' && document.hidden) {
                        try {
                            new Notification('New team message', {
                                body: latest.content || '(attachment)',
                            });
                        } catch {
                            /* ignore */
                        }
                    }
                }
                return next;
            });
            lastSeenCountRef.current = next.length;
        }, POLL_MS);
        return () => clearInterval(interval);
    }, [selectedChannelId, notifPerm, sessionUser?._id]);

    React.useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages.length, selectedChannelId]);

    const onStartDm = React.useCallback(
        async (userId: string) => {
            const chan = await getOrCreateDmChannel(userId);
            if (chan) {
                setSelectedChannelId(chan._id);
                await reloadChannels();
            }
        },
        [reloadChannels],
    );

    /* ─── SabCliq handlers ─── */
    const onToggleReaction = React.useCallback(
        async (messageId: string, emoji: string) => {
            const meId = sessionUser?._id;
            const msg = messages.find((m) => m._id.toString() === messageId);
            const existing = msg?.reactions?.find((r) => r.emoji === emoji);
            const minePresent =
                !!existing && !!meId && existing.userIds.map(String).includes(meId);
            const fn = minePresent
                ? removeReactionFromTeamMessage
                : addReactionToTeamMessage;
            const res = await fn(messageId, emoji);
            if (!res.success) {
                toast({
                    title: 'Reaction failed',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            await loadMessages();
        },
        [messages, sessionUser?._id, toast, loadMessages],
    );

    const onTogglePin = React.useCallback(
        async (messageId: string, isPinned: boolean) => {
            const res = isPinned
                ? await unpinTeamMessage(messageId)
                : await pinTeamMessage(messageId);
            if (!res.success) {
                toast({
                    title: 'Pin update failed',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            await Promise.all([loadMessages(), loadPinned()]);
        },
        [toast, loadMessages, loadPinned],
    );

    const onBookmark = React.useCallback(
        async (messageId: string) => {
            const res = await bookmarkTeamMessage(messageId);
            if (!res.success) {
                toast({
                    title: 'Could not save',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            toast({ title: 'Saved' });
        },
        [toast],
    );

    const onJumpMessage = React.useCallback((messageId: string) => {
        const node = messageNodeRefs.current[messageId];
        if (node) {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            node.classList.add('ring-2', 'ring-[var(--st-text)]/40');
            setTimeout(() => {
                node.classList.remove('ring-2', 'ring-[var(--st-text)]/40');
            }, 1500);
        }
    }, []);

    const onJumpFromBookmark = React.useCallback(
        (channelId: string, messageId: string) => {
            setBookmarksOpen(false);
            if (channelId !== selectedChannelId) setSelectedChannelId(channelId);
            // Wait for messages to reload before scrolling.
            setTimeout(() => onJumpMessage(messageId), 200);
        },
        [selectedChannelId, onJumpMessage],
    );

    const mentionCandidates = React.useMemo<MentionCandidate[]>(() => {
        const fromChannel = selectedChannel?.participants ?? [];
        return fromChannel
            .filter((p) => p.userId !== sessionUser?._id)
            .map((p) => ({ id: p.userId, name: p.name }));
    }, [selectedChannel, sessionUser?._id]);

    const participantNames = React.useMemo(() => {
        const map: Record<string, string> = {};
        for (const p of selectedChannel?.participants ?? []) {
            map[p.userId] = p.name;
        }
        return map;
    }, [selectedChannel]);

    const onSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedChannelId) return;
        const content = input;
        if (!content.trim() && attachmentQueue.length === 0) return;
        setSending(true);
        setInput('');
        const attachments = attachmentQueue;
        setAttachmentQueue([]);
        const res = await sendTeamMessage({ channelId: selectedChannelId, content, attachments });
        setSending(false);
        if (res.success) {
            await loadMessages();
            await reloadChannels();
        } else {
            toast({ title: 'Send failed', description: res.error, variant: 'destructive' });
            setInput(content);
            setAttachmentQueue(attachments);
        }
    };

    const requestNotifPerm = async () => {
        if (!('Notification' in window)) return;
        const p = await Notification.requestPermission();
        setNotifPerm(p);
    };

    const onPickFile = () => fileInputRef.current?.click();

    const queueFiles = async (files: File[]) => {
        if (!files.length) return;
        const next: OutgoingAttachment[] = [];
        for (const f of files) {
            const base64 = await readFileAsBase64(f);
            next.push({ filename: f.name, contentType: f.type, base64 });
        }
        setAttachmentQueue((prev) => [...prev, ...next].slice(0, 6));
    };

    const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        await queueFiles(files);
    };

    const filteredChannels = React.useMemo(() => {
        const q = sidebarQuery.trim().toLowerCase();
        if (!q) return channels;
        return channels.filter((c) => {
            const bag =
                (c.name || '') +
                ' ' +
                c.participants
                    .filter((p) => p.userId !== sessionUser?._id)
                    .map((p) => p.name)
                    .join(' ');
            return bag.toLowerCase().includes(q);
        });
    }, [channels, sidebarQuery, sessionUser?._id]);

    if (!canRead) {
        return (
            <div className="flex flex-col gap-6">
                <Card className="p-10 text-center">
                    <Badge variant="danger">Restricted</Badge>
                    <p className="mt-3 text-[13px] text-[var(--st-text-secondary)]">
                        You don&apos;t have permission to view Team Chat.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex min-h-full flex-col gap-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/team/manage-users">Team</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Chat</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader>
                <PageHeading>
                    <PageTitle>Team chat</PageTitle>
                    <PageDescription>
                        Direct messages and group channels. Polling at 3s.
                    </PageDescription>
                </PageHeading>
                <div className="flex items-center gap-2">
                    {notifPerm === 'default' ? (
                        <Button variant="outline" size="md" onClick={requestNotifPerm}>
                            <Bell className="h-3.5 w-3.5" />
                            Enable notifications
                        </Button>
                    ) : notifPerm === 'granted' ? (
                        <Badge variant="success">Notifications on</Badge>
                    ) : (
                        <Badge variant="danger">Notifications blocked</Badge>
                    )}
                    {canSend ? (
                        <NewGroupDialog members={members} onCreated={reloadChannels} toast={toast} />
                    ) : null}
                </div>
            </PageHeader>

            <Card className="flex h-[640px] overflow-hidden p-0">
                {/* ─── Sidebar ─────────────────── */}
                <div className="flex w-[300px] shrink-0 flex-col border-r border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                    <div className="border-b border-[var(--st-border)] p-3">
                        <Input
                            leadingSlot={<Search className="h-3.5 w-3.5" strokeWidth={2} />}
                            placeholder="Search conversations"
                            value={sidebarQuery}
                            onChange={(e) => setSidebarQuery(e.target.value)}
                        />
                    </div>

                    <div className="border-b border-[var(--st-border)] p-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="md"
                            className="w-full justify-start"
                            onClick={() => setBookmarksOpen(true)}
                        >
                            <Bookmark className="h-3.5 w-3.5" />
                            Saved messages
                        </Button>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <SidebarGroupLabel label="Conversations" />
                        {channelsLoading ? (
                            <div className="p-3 text-[12px] text-[var(--st-text-secondary)]">Loading…</div>
                        ) : filteredChannels.length ? (
                            filteredChannels.map((c) => (
                                <ChannelRow
                                    key={c._id}
                                    channel={c}
                                    meId={sessionUser?._id}
                                    active={c._id === selectedChannelId}
                                    onSelect={() => setSelectedChannelId(c._id)}
                                />
                            ))
                        ) : (
                            <div className="p-3 text-[12px] text-[var(--st-text-secondary)]">No conversations yet.</div>
                        )}

                        <SidebarGroupLabel label="Team members" />
                        {members.length === 0 ? (
                            <div className="p-3 text-[12px] text-[var(--st-text-secondary)]">Invite someone to get started.</div>
                        ) : (
                            members.slice(0, 12).map((u) => {
                                const uid = u._id.toString();
                                return (
                                    <button
                                        key={uid}
                                        type="button"
                                        onClick={() => onStartDm(uid)}
                                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-[12.5px] text-[var(--st-text-secondary)] hover:bg-[var(--st-bg)]"
                                    >
                                        <div className="relative">
                                            <Dot name={u.name || u.email} />
                                            <span className="absolute -bottom-0.5 -right-0.5">
                                                <PresenceDot status={presence[uid]?.status ?? 'offline'} />
                                            </span>
                                        </div>
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate text-[var(--st-text)]">{u.name}</span>
                                            <span className="truncate text-[11px] text-[var(--st-text-secondary)]">{u.email}</span>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ─── Message pane ─────────────────── */}
                <div className="flex flex-1 flex-col">
                    {selectedChannel ? (
                        <>
                            <ChannelHeader
                                channel={selectedChannel}
                                meId={sessionUser?._id}
                                presence={presence}
                                onStartHuddle={() => setHuddleOpen(true)}
                            />
                            {pinned.length > 0 ? (
                                <PinnedStrip
                                    pins={pinned}
                                    onJump={onJumpMessage}
                                    onUnpin={(id) => onTogglePin(id, true)}
                                    canEdit={canSend}
                                />
                            ) : null}
                            <div className="flex-1 space-y-3 overflow-auto bg-[var(--st-bg-muted)]/60 px-5 py-4">
                                {messagesLoading ? (
                                    <div className="flex h-full items-center justify-center text-[12.5px] text-[var(--st-text-secondary)]">
                                        Loading messages…
                                    </div>
                                ) : messages.length === 0 ? (
                                    <EmptyConversation channel={selectedChannel} meId={sessionUser?._id} />
                                ) : (
                                    renderMessagesWithDateDividers(messages, sessionUser?._id, {
                                        onToggleReaction,
                                        onTogglePin,
                                        onBookmark,
                                        onOpenThread: setThreadRootId,
                                        registerNode: (id, node) => {
                                            messageNodeRefs.current[id] = node;
                                        },
                                    })
                                )}
                                <div ref={scrollRef} />
                            </div>

                            {canSend ? (
                                <form onSubmit={onSend} className="border-t border-[var(--st-border)] bg-[var(--st-bg)] p-3">
                                    <ComposerExtras
                                        value={input}
                                        candidates={mentionCandidates}
                                        onPick={(next) => setInput(next)}
                                    />
                                    {attachmentQueue.length > 0 ? (
                                        <div className="mb-2 flex flex-wrap gap-2">
                                            {attachmentQueue.map((a, i) => (
                                                <div
                                                    key={i}
                                                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2 h-6 text-[11.5px]"
                                                >
                                                    <ImageIcon className="h-3 w-3" />
                                                    <span className="max-w-[160px] truncate">{a.filename}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setAttachmentQueue((prev) => prev.filter((_, idx) => idx !== i))
                                                        }
                                                        className="text-[var(--st-text-secondary)] hover:text-[var(--st-danger)]"
                                                        aria-label="Remove"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={onPickFile}
                                            aria-label="Attach"
                                            title="Attach file"
                                        >
                                            <Paperclip className="h-4 w-4" />
                                        </Button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            hidden
                                            multiple
                                            onChange={onFileChosen}
                                        />
                                        <SabFileToFileButton
                                            accept="all"
                                            variant="outline"
                                            className="h-9 px-2 text-[11.5px]"
                                            onPickFile={(file) => queueFiles([file])}
                                            onError={(err) =>
                                                toast({
                                                    title: 'Pick failed',
                                                    description: err.message,
                                                    variant: 'destructive',
                                                })
                                            }
                                        >
                                            SabFiles
                                        </SabFileToFileButton>
                                        <Input
                                            className="flex-1"
                                            placeholder="Message…"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            disabled={sending}
                                        />
                                        <Button
                                            type="submit"
                                            size="icon"
                                            disabled={sending || (!input.trim() && attachmentQueue.length === 0)}
                                            aria-label="Send"
                                        >
                                            {sending ? (
                                                <Loader className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Send className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <div className="border-t border-[var(--st-border)] bg-[var(--st-bg)] px-5 py-3 text-[12px] text-[var(--st-text-secondary)]">
                                    You have view-only access to this chat.
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[var(--st-text-secondary)]">
                            <MessageSquare className="h-8 w-8" strokeWidth={1.5} />
                            <p className="text-[13px]">Select a conversation or start a new one.</p>
                        </div>
                    )}
                </div>
            </Card>

            <ThreadPanel
                rootMessageId={threadRootId}
                channelId={selectedChannelId}
                meId={sessionUser?._id}
                onClose={() => setThreadRootId(null)}
            />

            <BookmarksView
                open={bookmarksOpen}
                onClose={() => setBookmarksOpen(false)}
                onJump={onJumpFromBookmark}
            />

            <HuddleDrawer
                open={huddleOpen}
                onOpenChange={setHuddleOpen}
                channelId={selectedChannelId}
                meId={sessionUser?._id}
                participantNames={participantNames}
            />
        </div>
    );
}

/* ─────────────────────────── Sidebar helpers ─────────────────────────── */

function SidebarGroupLabel({ label }: { label: string }) {
    return (
        <div className="px-3 py-2 text-[10.5px] uppercase tracking-[0.08em] text-[var(--st-text-secondary)]">
            {label}
        </div>
    );
}

function ChannelRow({
    channel,
    meId,
    active,
    onSelect,
}: {
    channel: TeamChannelView;
    meId?: string;
    active: boolean;
    onSelect: () => void;
}) {
    const title = channelTitle(channel, meId);
    const other = channel.type === 'group' ? null : channel.participants.find((p) => p.userId !== meId);
    return (
        <button
            type="button"
            onClick={onSelect}
            className={
                'flex w-full items-center gap-3 border-b border-[var(--st-border)] px-3 py-2.5 text-left transition-colors ' +
                (active ? 'bg-[var(--st-bg)]' : 'hover:bg-[var(--st-bg)]')
            }
        >
            {channel.type === 'group' ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                    <Users className="h-4 w-4" strokeWidth={2} />
                </span>
            ) : (
                <Dot name={other?.name || title} />
            )}
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[13px] text-[var(--st-text)]">{title}</div>
                    {channel.lastMessage ? (
                        <span className="shrink-0 text-[10.5px] text-[var(--st-text-secondary)]">
                            {formatDistanceToNowStrict(new Date(channel.lastMessage.createdAt), { addSuffix: false })}
                        </span>
                    ) : null}
                </div>
                <div className="truncate text-[11.5px] text-[var(--st-text-secondary)]">
                    {channel.lastMessage ? channel.lastMessage.content : 'No messages yet'}
                </div>
            </div>
        </button>
    );
}

function Dot({ name }: { name: string }) {
    const hue = hashHue(name);
    const initial = (name || '?').charAt(0).toUpperCase();
    return (
        <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px]"
            style={{ background: `hsl(${hue} 60% 90%)`, color: `hsl(${hue} 45% 28%)` }}
        >
            {initial}
        </span>
    );
}

function hashHue(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
}

function channelTitle(c: TeamChannelView, meId?: string) {
    if (c.type === 'group') return c.name || 'Group chat';
    const other = c.participants.find((p) => p.userId !== meId);
    return other?.name || 'Direct message';
}

/* ─────────────────────────── Message pane helpers ─────────────────────────── */

function ChannelHeader({
    channel,
    meId,
    presence,
    onStartHuddle,
}: {
    channel: TeamChannelView;
    meId?: string;
    presence: Record<string, PresenceView>;
    onStartHuddle: () => void;
}) {
    const title = channelTitle(channel, meId);
    const other = channel.participants.find((p) => p.userId !== meId);
    const subtitle =
        channel.type === 'group'
            ? `${channel.participants.length} members`
            : other?.userId === meId
              ? ''
              : other?.name || '';
    return (
        <div className="flex items-center gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg)] px-5 py-3">
            {channel.type === 'group' ? (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                    <Users className="h-4 w-4" strokeWidth={2} />
                </span>
            ) : (
                <div className="relative">
                    <Dot name={title} />
                    {other ? (
                        <span className="absolute -bottom-0.5 -right-0.5">
                            <PresenceDot status={presence[other.userId]?.status ?? 'offline'} />
                        </span>
                    ) : null}
                </div>
            )}
            <div className="flex-1">
                <div className="text-[14px] text-[var(--st-text)]">{title}</div>
                <div className="text-[11.5px] text-[var(--st-text-secondary)]">{subtitle}</div>
            </div>
            <Button
                type="button"
                variant="outline"
                size="md"
                onClick={onStartHuddle}
                title="Start or join a huddle"
            >
                <Headphones className="h-3.5 w-3.5" />
                Huddle
            </Button>
        </div>
    );
}

function EmptyConversation({ channel, meId }: { channel: TeamChannelView; meId?: string }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--st-text-secondary)]">
            <MessageSquare className="h-6 w-6" strokeWidth={1.5} />
            <p className="text-[12.5px]">
                {channel.type === 'group'
                    ? `Send the first message in #${channel.name || 'group'}.`
                    : `Start a conversation with ${channelTitle(channel, meId)}.`}
            </p>
        </div>
    );
}

type MessageRowCallbacks = {
    onToggleReaction: (messageId: string, emoji: string) => void;
    onTogglePin: (messageId: string, isPinned: boolean) => void;
    onBookmark: (messageId: string) => void;
    onOpenThread: (messageId: string) => void;
    registerNode: (messageId: string, node: HTMLDivElement | null) => void;
};

function renderMessagesWithDateDividers(
    messages: WithId<TeamMessage>[],
    meId: string | undefined,
    callbacks: MessageRowCallbacks,
) {
    const out: React.ReactNode[] = [];
    let lastDate: Date | null = null;
    for (const m of messages) {
        // Skip thread-replies in the main stream — they only render inside the thread panel.
        if ((m as any).threadRootId) continue;
        const d = new Date(m.createdAt);
        if (!lastDate || !isSameDay(lastDate, d)) {
            out.push(
                <div key={`d-${m._id.toString()}`} className="flex items-center gap-2 py-1 text-[10.5px] text-[var(--st-text-secondary)]">
                    <div className="h-px flex-1 bg-[var(--st-border)]" />
                    <span>{format(d, 'EEE, MMM d')}</span>
                    <div className="h-px flex-1 bg-[var(--st-border)]" />
                </div>,
            );
            lastDate = d;
        }
        out.push(
            <MessageRow
                key={m._id.toString()}
                message={m}
                meId={meId}
                callbacks={callbacks}
            />,
        );
    }
    return out;
}

function MessageRow({
    message,
    meId,
    callbacks,
}: {
    message: WithId<TeamMessage>;
    meId?: string;
    callbacks: MessageRowCallbacks;
}) {
    const mine = meId && message.senderId?.toString() === meId;
    const id = message._id.toString();
    const isPinned = !!(message as any).pinnedAt;
    const replyCount = (message as any).replyCount ?? 0;
    const lastReplyAt = (message as any).lastReplyAt;
    return (
        <div
            ref={(el) => callbacks.registerNode(id, el)}
            className={'group/message flex ' + (mine ? 'justify-end' : 'justify-start')}
        >
            <div
                className={
                    'relative max-w-[80%] rounded-lg px-3 py-2 text-[13px] shadow-sm ' +
                    (mine
                        ? 'bg-[var(--st-text)] text-[var(--st-bg)]'
                        : 'border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)]')
                }
            >
                {/* Hover toolbar */}
                <div
                    className={
                        'absolute -top-3 ' +
                        (mine ? 'right-2' : 'left-2') +
                        ' z-10 hidden gap-1 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-0.5 shadow-sm group-hover/message:flex'
                    }
                >
                    <button
                        type="button"
                        onClick={() => callbacks.onOpenThread(id)}
                        className="rounded-md p-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]"
                        aria-label="Reply in thread"
                        title="Reply in thread"
                    >
                        <MessageCircleReply className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => callbacks.onTogglePin(id, isPinned)}
                        className="rounded-md p-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]"
                        aria-label={isPinned ? 'Unpin' : 'Pin'}
                        title={isPinned ? 'Unpin' : 'Pin to channel'}
                    >
                        {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => callbacks.onBookmark(id)}
                        className="rounded-md p-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]"
                        aria-label="Save"
                        title="Save for later"
                    >
                        <Bookmark className="h-3.5 w-3.5" />
                    </button>
                </div>

                {isPinned ? (
                    <div className={'mb-1 inline-flex items-center gap-1 text-[10px] ' + (mine ? 'text-[var(--st-bg)]/80' : 'text-[var(--st-text-secondary)]')}>
                        <Pin className="h-2.5 w-2.5" /> Pinned
                    </div>
                ) : null}

                {message.content ? <div className="whitespace-pre-wrap">{message.content}</div> : null}
                {message.attachments?.length ? (
                    <div className="mt-2 flex flex-col gap-2">
                        {message.attachments.map((a, i) => (
                            <Attachment key={i} attachment={a} mine={!!mine} />
                        ))}
                    </div>
                ) : null}

                {/* Reactions */}
                {(message.reactions?.length ?? 0) > 0 ? (
                    <div className="mt-2">
                        <ReactionsBar
                            reactions={message.reactions?.map((r) => ({
                                emoji: r.emoji,
                                count: r.count,
                                userIds: (r.userIds || []).map(String),
                            }))}
                            meId={meId}
                            onToggle={(emoji) => callbacks.onToggleReaction(id, emoji)}
                        />
                    </div>
                ) : null}

                {/* Thread indicator */}
                {replyCount > 0 ? (
                    <button
                        type="button"
                        onClick={() => callbacks.onOpenThread(id)}
                        className={
                            'mt-1.5 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ' +
                            (mine
                                ? 'border-[var(--st-bg)]/30 bg-[var(--st-bg)]/10 text-[var(--st-bg)] hover:bg-[var(--st-bg)]/20'
                                : 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)] hover:bg-[var(--st-bg)]')
                        }
                    >
                        <MessageCircleReply className="h-3 w-3" />
                        {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                        {lastReplyAt ? (
                            <span className={mine ? 'text-[var(--st-bg)]/70' : 'text-[var(--st-text-secondary)]'}>
                                · {format(new Date(lastReplyAt), 'p')}
                            </span>
                        ) : null}
                    </button>
                ) : null}

                <div className={'mt-1 text-[10px] ' + (mine ? 'text-[var(--st-bg)]/70' : 'text-[var(--st-text-secondary)]')}>
                    {format(new Date(message.createdAt), 'p')}
                </div>
            </div>
        </div>
    );
}

function Attachment({
    attachment,
    mine,
}: {
    attachment: { type: 'image' | 'file'; url: string; name: string };
    mine: boolean;
}) {
    if (attachment.type === 'image') {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="max-h-[240px] rounded-md border border-[var(--st-border)] object-contain"
                />
            </a>
        );
    }
    return (
        <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className={
                'inline-flex items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] ' +
                (mine
                    ? 'border-[var(--st-bg)]/30 bg-[var(--st-bg)]/10 text-[var(--st-bg)]'
                    : 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]')
            }
        >
            <Paperclip className="h-3 w-3" />
            <span className="max-w-[200px] truncate">{attachment.name}</span>
        </a>
    );
}

/* ─────────────────────────── Group dialog ─────────────────────────── */

function NewGroupDialog({
    members,
    onCreated,
    toast,
}: {
    members: WithId<User>[];
    onCreated: () => void;
    toast: ReturnType<typeof useToast>['toast'];
}) {
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState('');
    const [picked, setPicked] = React.useState<Set<string>>(new Set());
    const [pending, setPending] = React.useState(false);

    const reset = () => {
        setName('');
        setPicked(new Set());
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || picked.size === 0) return;
        setPending(true);
        const res = await createGroupChannel({ name: name.trim(), memberUserIds: Array.from(picked) });
        setPending(false);
        if (res.success) {
            toast({ title: 'Group created' });
            reset();
            setOpen(false);
            onCreated();
        } else {
            toast({ title: 'Could not create', description: res.error, variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
                <Button size="md">
                    <Plus className="h-3.5 w-3.5" />
                    New group
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <form onSubmit={submit} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>New group chat</DialogTitle>
                    </DialogHeader>
                    <div>
                        <label className="text-[11.5px] uppercase tracking-[0.06em] text-[var(--st-text-secondary)]">
                            Group name
                        </label>
                        <Input
                            className="mt-1.5"
                            placeholder="Growth squad"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[11.5px] uppercase tracking-[0.06em] text-[var(--st-text-secondary)]">
                            Members ({picked.size} selected)
                        </label>
                        <div className="mt-1.5 max-h-[240px] overflow-auto rounded-lg border border-[var(--st-border)]">
                            {members.length === 0 ? (
                                <div className="p-3 text-[12px] text-[var(--st-text-secondary)]">No teammates yet.</div>
                            ) : (
                                members.map((u) => {
                                    const id = u._id.toString();
                                    const on = picked.has(id);
                                    return (
                                        <label
                                            key={id}
                                            className={
                                                'flex cursor-pointer items-center gap-3 border-b border-[var(--st-border)] px-3 py-2 last:border-b-0 text-[12.5px] ' +
                                                (on ? 'bg-[var(--st-bg-muted)]/60' : 'hover:bg-[var(--st-bg-muted)]')
                                            }
                                        >
                                            <input
                                                type="checkbox"
                                                checked={on}
                                                onChange={() => {
                                                    setPicked((prev) => {
                                                        const next = new Set(prev);
                                                        if (next.has(id)) next.delete(id);
                                                        else next.add(id);
                                                        return next;
                                                    });
                                                }}
                                                className="h-4 w-4 rounded border-[var(--st-border)] accent-[var(--st-text)]"
                                            />
                                            <Dot name={u.name || u.email} />
                                            <div className="min-w-0">
                                                <div className="truncate text-[var(--st-text)]">{u.name}</div>
                                                <div className="truncate text-[11px] text-[var(--st-text-secondary)]">{u.email}</div>
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="md" onClick={() => setOpen(false)} disabled={pending}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="md"
                            disabled={pending || !name.trim() || picked.size === 0}
                        >
                            {pending ? <Loader className="h-3.5 w-3.5 animate-spin" /> : null}
                            Create group
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}
