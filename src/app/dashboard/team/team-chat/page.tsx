'use client';

import * as React from 'react';
import { format, formatDistanceToNowStrict, isSameDay } from 'date-fns';
import {
    LuBell,
    LuBellOff,
    LuImage,
    LuLoader,
    LuMessageSquare,
    LuPaperclip,
    LuPlus,
    LuSearch,
    LuSend,
    LuUsers,
    LuX,
} from 'react-icons/lu';

import { ClayBadge } from '@/components/clay/clay-badge';
import { ClayBreadcrumbs } from '@/components/clay/clay-breadcrumbs';
import { ClayButton } from '@/components/clay/clay-button';
import { ClayCard } from '@/components/clay/clay-card';
import { ClayInput } from '@/components/clay/clay-input';
import { ClaySectionHeader } from '@/components/clay/clay-section-header';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
    createGroupChannel,
    getChannelMessages,
    getOrCreateDmChannel,
    listTeamChannels,
    sendTeamMessage,
    type TeamChannelView,
    type OutgoingAttachment,
} from '@/app/actions/team-chat.actions';
import { getInvitedUsers } from '@/app/actions/team.actions';
import { useCan, useProject } from '@/context/project-context';
import type { TeamMessage, User, WithId } from '@/lib/definitions';

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

    const scrollRef = React.useRef<HTMLDivElement | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const lastSeenCountRef = React.useRef(0);

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

    const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (!files.length) return;
        const next: OutgoingAttachment[] = [];
        for (const f of files) {
            const base64 = await readFileAsBase64(f);
            next.push({ filename: f.name, contentType: f.type, base64 });
        }
        setAttachmentQueue((prev) => [...prev, ...next].slice(0, 6));
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
            <div className="clay-enter flex flex-col gap-6">
                <ClayCard className="p-10 text-center">
                    <ClayBadge tone="red">Restricted</ClayBadge>
                    <p className="mt-3 text-[13px] text-muted-foreground">
                        You don't have permission to view Team Chat.
                    </p>
                </ClayCard>
            </div>
        );
    }

    return (
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'SabNode', href: '/home' },
                    { label: 'Team', href: '/dashboard/team/manage-users' },
                    { label: 'Chat' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Team chat"
                subtitle="Direct messages and group channels. Polling at 3s."
                actions={
                    <>
                        {notifPerm === 'default' ? (
                            <ClayButton
                                variant="pill"
                                size="md"
                                onClick={requestNotifPerm}
                                leading={<LuBell className="h-3.5 w-3.5" />}
                            >
                                Enable notifications
                            </ClayButton>
                        ) : notifPerm === 'granted' ? (
                            <ClayBadge tone="green" dot>
                                Notifications on
                            </ClayBadge>
                        ) : (
                            <ClayBadge tone="red" dot>
                                Notifications blocked
                            </ClayBadge>
                        )}
                        {canSend ? (
                            <NewGroupDialog members={members} onCreated={reloadChannels} toast={toast} />
                        ) : null}
                    </>
                }
            />

            <ClayCard padded={false} className="flex h-[640px] overflow-hidden">
                {/* ─── Sidebar ─────────────────── */}
                <div className="flex w-[300px] shrink-0 flex-col border-r border-border bg-secondary">
                    <div className="border-b border-border p-3">
                        <ClayInput
                            sizeVariant="md"
                            leading={<LuSearch className="h-3.5 w-3.5" strokeWidth={2} />}
                            placeholder="Search conversations"
                            value={sidebarQuery}
                            onChange={(e) => setSidebarQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-auto">
                        <SidebarGroupLabel label="Conversations" />
                        {channelsLoading ? (
                            <div className="p-3 text-[12px] text-muted-foreground">Loading…</div>
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
                            <div className="p-3 text-[12px] text-muted-foreground">No conversations yet.</div>
                        )}

                        <SidebarGroupLabel label="Team members" />
                        {members.length === 0 ? (
                            <div className="p-3 text-[12px] text-muted-foreground">Invite someone to get started.</div>
                        ) : (
                            members.slice(0, 12).map((u) => (
                                <button
                                    key={u._id.toString()}
                                    type="button"
                                    onClick={() => onStartDm(u._id.toString())}
                                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-[12.5px] text-muted-foreground hover:bg-card"
                                >
                                    <Dot name={u.name || u.email} />
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate text-foreground">{u.name}</span>
                                        <span className="truncate text-[11px] text-muted-foreground">{u.email}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* ─── Message pane ─────────────────── */}
                <div className="flex flex-1 flex-col">
                    {selectedChannel ? (
                        <>
                            <ChannelHeader channel={selectedChannel} meId={sessionUser?._id} />
                            <div className="flex-1 space-y-3 overflow-auto bg-secondary/60 px-5 py-4">
                                {messagesLoading ? (
                                    <div className="flex h-full items-center justify-center text-[12.5px] text-muted-foreground">
                                        Loading messages…
                                    </div>
                                ) : messages.length === 0 ? (
                                    <EmptyConversation channel={selectedChannel} meId={sessionUser?._id} />
                                ) : (
                                    renderMessagesWithDateDividers(messages, sessionUser?._id)
                                )}
                                <div ref={scrollRef} />
                            </div>

                            {canSend ? (
                                <form
                                    onSubmit={onSend}
                                    className="border-t border-border bg-card p-3"
                                >
                                    {attachmentQueue.length > 0 ? (
                                        <div className="mb-2 flex flex-wrap gap-2">
                                            {attachmentQueue.map((a, i) => (
                                                <div
                                                    key={i}
                                                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2 h-6 text-[11.5px]"
                                                >
                                                    <LuImage className="h-3 w-3" />
                                                    <span className="max-w-[160px] truncate">{a.filename}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setAttachmentQueue((prev) => prev.filter((_, idx) => idx !== i))
                                                        }
                                                        className="text-muted-foreground hover:text-destructive"
                                                        aria-label="Remove"
                                                    >
                                                        <LuX className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                    <div className="flex items-center gap-2">
                                        <ClayButton
                                            type="button"
                                            variant="pill"
                                            size="icon"
                                            onClick={onPickFile}
                                            aria-label="Attach"
                                            title="Attach file"
                                        >
                                            <LuPaperclip className="h-4 w-4" />
                                        </ClayButton>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            hidden
                                            multiple
                                            onChange={onFileChosen}
                                        />
                                        <ClayInput
                                            className="flex-1"
                                            sizeVariant="md"
                                            placeholder="Message…"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            disabled={sending}
                                        />
                                        <ClayButton
                                            type="submit"
                                            variant="obsidian"
                                            size="icon"
                                            disabled={sending || (!input.trim() && attachmentQueue.length === 0)}
                                            aria-label="Send"
                                        >
                                            {sending ? (
                                                <LuLoader className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <LuSend className="h-4 w-4" />
                                            )}
                                        </ClayButton>
                                    </div>
                                </form>
                            ) : (
                                <div className="border-t border-border bg-card px-5 py-3 text-[12px] text-muted-foreground">
                                    You have view-only access to this chat.
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
                            <LuMessageSquare className="h-8 w-8" strokeWidth={1.5} />
                            <p className="text-[13px]">Select a conversation or start a new one.</p>
                        </div>
                    )}
                </div>
            </ClayCard>
        </div>
    );
}

/* ─────────────────────────── Sidebar helpers ─────────────────────────── */

function SidebarGroupLabel({ label }: { label: string }) {
    return (
        <div className="px-3 py-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
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
                'flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors ' +
                (active ? 'bg-card' : 'hover:bg-card')
            }
        >
            {channel.type === 'group' ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <LuUsers className="h-4 w-4" strokeWidth={2} />
                </span>
            ) : (
                <Dot name={other?.name || title} />
            )}
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[13px] font-medium text-foreground">{title}</div>
                    {channel.lastMessage ? (
                        <span className="shrink-0 text-[10.5px] text-muted-foreground">
                            {formatDistanceToNowStrict(new Date(channel.lastMessage.createdAt), { addSuffix: false })}
                        </span>
                    ) : null}
                </div>
                <div className="truncate text-[11.5px] text-muted-foreground">
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
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

function ChannelHeader({ channel, meId }: { channel: TeamChannelView; meId?: string }) {
    const title = channelTitle(channel, meId);
    const subtitle =
        channel.type === 'group'
            ? `${channel.participants.length} members`
            : channel.participants.find((p) => p.userId !== meId)?.userId === meId
              ? ''
              : channel.participants.find((p) => p.userId !== meId)?.name || '';
    return (
        <div className="flex items-center gap-3 border-b border-border bg-card px-5 py-3">
            {channel.type === 'group' ? (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <LuUsers className="h-4 w-4" strokeWidth={2} />
                </span>
            ) : (
                <Dot name={title} />
            )}
            <div>
                <div className="text-[14px] font-semibold text-foreground">{title}</div>
                <div className="text-[11.5px] text-muted-foreground">{subtitle}</div>
            </div>
        </div>
    );
}

function EmptyConversation({ channel, meId }: { channel: TeamChannelView; meId?: string }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <LuMessageSquare className="h-6 w-6" strokeWidth={1.5} />
            <p className="text-[12.5px]">
                {channel.type === 'group'
                    ? `Send the first message in #${channel.name || 'group'}.`
                    : `Start a conversation with ${channelTitle(channel, meId)}.`}
            </p>
        </div>
    );
}

function renderMessagesWithDateDividers(messages: WithId<TeamMessage>[], meId?: string) {
    const out: React.ReactNode[] = [];
    let lastDate: Date | null = null;
    for (const m of messages) {
        const d = new Date(m.createdAt);
        if (!lastDate || !isSameDay(lastDate, d)) {
            out.push(
                <div key={`d-${m._id.toString()}`} className="flex items-center gap-2 py-1 text-[10.5px] text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    <span>{format(d, 'EEE, MMM d')}</span>
                    <div className="h-px flex-1 bg-border" />
                </div>,
            );
            lastDate = d;
        }
        out.push(<MessageRow key={m._id.toString()} message={m} meId={meId} />);
    }
    return out;
}

function MessageRow({ message, meId }: { message: WithId<TeamMessage>; meId?: string }) {
    const mine = meId && message.senderId?.toString() === meId;
    return (
        <div className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
            <div
                className={
                    'max-w-[80%] rounded-lg px-3 py-2 text-[13px] shadow-sm ' +
                    (mine
                        ? 'bg-foreground text-white'
                        : 'border border-border bg-card text-foreground')
                }
            >
                {message.content ? <div className="whitespace-pre-wrap">{message.content}</div> : null}
                {message.attachments?.length ? (
                    <div className="mt-2 flex flex-col gap-2">
                        {message.attachments.map((a, i) => (
                            <Attachment key={i} attachment={a} mine={!!mine} />
                        ))}
                    </div>
                ) : null}
                <div className={'mt-1 text-[10px] ' + (mine ? 'text-white/70' : 'text-muted-foreground')}>
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
                    className="max-h-[240px] rounded-md border border-border object-contain"
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
                    ? 'border-white/30 bg-white/10 text-white'
                    : 'border-border bg-secondary text-foreground')
            }
        >
            <LuPaperclip className="h-3 w-3" />
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
                <ClayButton variant="obsidian" size="md" leading={<LuPlus className="h-3.5 w-3.5" />}>
                    New group
                </ClayButton>
            </DialogTrigger>
            <DialogContent className="max-w-md overflow-hidden border border-border bg-card p-0 shadow-lg">
                <div className="h-[6px] w-full bg-primary" />
                <form onSubmit={submit} className="flex flex-col gap-4 p-6">
                    <DialogHeader>
                        <DialogTitle className="text-[20px] font-semibold tracking-[-0.01em] text-foreground">
                            New group chat
                        </DialogTitle>
                    </DialogHeader>
                    <div>
                        <label className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                            Group name
                        </label>
                        <ClayInput
                            className="mt-1.5"
                            placeholder="Growth squad"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                            Members ({picked.size} selected)
                        </label>
                        <div className="mt-1.5 max-h-[240px] overflow-auto rounded-lg border border-border">
                            {members.length === 0 ? (
                                <div className="p-3 text-[12px] text-muted-foreground">No teammates yet.</div>
                            ) : (
                                members.map((u) => {
                                    const id = u._id.toString();
                                    const on = picked.has(id);
                                    return (
                                        <label
                                            key={id}
                                            className={
                                                'flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 text-[12.5px] ' +
                                                (on ? 'bg-accent/40' : 'hover:bg-secondary')
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
                                                className="h-4 w-4 rounded border-border accent-primary"
                                            />
                                            <Dot name={u.name || u.email} />
                                            <div className="min-w-0">
                                                <div className="truncate text-foreground">{u.name}</div>
                                                <div className="truncate text-[11px] text-muted-foreground">{u.email}</div>
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <ClayButton type="button" variant="pill" size="md" onClick={() => setOpen(false)} disabled={pending}>
                            Cancel
                        </ClayButton>
                        <ClayButton
                            type="submit"
                            variant="obsidian"
                            size="md"
                            disabled={pending || !name.trim() || picked.size === 0}
                            leading={pending ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : null}
                        >
                            Create group
                        </ClayButton>
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
