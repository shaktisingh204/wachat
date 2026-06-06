'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
    Button,
    IconButton,
    Field,
    Input,
    Badge,
    EmptyState,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/sabcrm/20ui';
import { CommandPalette } from './command-palette';
import { Contact360 } from './contact-360';
import { ChevronDown, X, Inbox, MessagesSquare } from 'lucide-react';
import {
    listConversationMessages,
    sendAgentMessage,
    setConversationStatus,
    resolveConversation,
    reopenConversation,
    autoAssignConversation,
} from '@/app/actions/sabchat-v2.actions';
import type {
    SabChatConversation,
    SabChatInbox,
    SabChatMessage,
    ConversationStatus,
    ContentBlock,
} from '@/lib/rust-client/sabchat';
import { useToast } from '@/hooks/use-toast';

interface Props {
    inboxes: SabChatInbox[];
    selectedInboxId: string;
    status: ConversationStatus;
    initialConversations: SabChatConversation[];
    initialSelectedConversationId?: string;
}

const STATUSES: ConversationStatus[] = ['open', 'pending', 'snoozed', 'resolved'];

export function InboxV2Client({
    inboxes,
    selectedInboxId,
    status,
    initialConversations,
    initialSelectedConversationId,
}: Props) {
    const { toast } = useToast();
    const [conversations] = useState(initialConversations);
    const [activeTabs, setActiveTabs] = useState<string[]>(initialSelectedConversationId ? [initialSelectedConversationId] : (initialConversations[0] ? [initialConversations[0]._id] : []));
    const [selectedId, setSelectedId] = useState<string | undefined>(
        initialSelectedConversationId ?? initialConversations[0]?._id,
    );
    const [messages, setMessages] = useState<SabChatMessage[]>([]);
    const [draft, setDraft] = useState('');
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (selectedId && !activeTabs.includes(selectedId)) {
            setActiveTabs(prev => [...prev, selectedId]);
        }
    }, [selectedId, activeTabs]);

    const selected = useMemo(
        () => conversations.find((c) => c._id === selectedId),
        [conversations, selectedId],
    );

    useEffect(() => {
        if (!selectedId) {
            setMessages([]);
            return;
        }
        startTransition(async () => {
            const resp = await listConversationMessages(selectedId);
            setMessages((resp.items ?? []).slice().reverse());
        });
    }, [selectedId]);

    const updateUrl = (patch: Record<string, string | undefined>) => {
        const url = new URL(window.location.href);
        for (const [k, v] of Object.entries(patch)) {
            if (v === undefined) url.searchParams.delete(k);
            else url.searchParams.set(k, v);
        }
        window.history.replaceState({}, '', url.toString());
    };

    const onSend = () => {
        if (!selectedId || !draft.trim()) return;
        startTransition(async () => {
            const resp = await sendAgentMessage(selectedId, draft);
            if (resp.error) {
                toast({ title: 'Send failed', description: resp.error, variant: 'destructive' });
                return;
            }
            if (resp.data) setMessages((prev) => [...prev, resp.data]);
            setDraft('');
        });
    };

    const onAssign = () => {
        if (!selectedId) return;
        startTransition(async () => {
            const r = await autoAssignConversation(selectedId, 'round_robin');
            if (r.error) toast({ title: 'Assign failed', description: r.error, variant: 'destructive' });
            else toast({ title: 'Auto-assigned' });
        });
    };

    const onResolve = () => {
        if (!selectedId) return;
        startTransition(async () => {
            const r = await resolveConversation(selectedId);
            if (r.error) toast({ title: 'Resolve failed', description: r.error, variant: 'destructive' });
            else toast({ title: 'Resolved' });
        });
    };

    const onReopen = () => {
        if (!selectedId) return;
        startTransition(async () => {
            const r = await reopenConversation(selectedId);
            if (r.error) toast({ title: 'Reopen failed', description: r.error, variant: 'destructive' });
            else toast({ title: 'Reopened' });
        });
    };

    const onSnooze = () => {
        if (!selectedId) return;
        startTransition(async () => {
            const r = await setConversationStatus(selectedId, 'snoozed');
            if (r.error) toast({ title: 'Snooze failed', description: r.error, variant: 'destructive' });
        });
    };

    return (
        <div className="grid h-[calc(100vh-12rem)] grid-cols-12 gap-3">
            {/* Inbox + filter rail */}
            <aside className="col-span-2 flex flex-col gap-2 overflow-y-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2">
                <div className="text-xs font-semibold uppercase text-[var(--st-text-secondary)]">Inboxes</div>
                {inboxes.map((ix) => (
                    <Button
                        key={ix._id}
                        variant={ix._id === selectedInboxId ? 'primary' : 'ghost'}
                        size="sm"
                        className="justify-start"
                        onClick={() => updateUrl({ inboxId: ix._id, selected: undefined })}
                    >
                        <span className="truncate">{ix.name}</span>
                        <Badge tone="neutral" className="ml-auto text-[10px]">
                            {ix.channelType.replace(/_/g, ' ')}
                        </Badge>
                    </Button>
                ))}
                <div className="mt-3 text-xs font-semibold uppercase text-[var(--st-text-secondary)]">Status</div>
                {STATUSES.map((s) => (
                    <Button
                        key={s}
                        variant={s === status ? 'primary' : 'ghost'}
                        size="sm"
                        className="justify-start capitalize"
                        onClick={() => updateUrl({ status: s, selected: undefined })}
                    >
                        {s}
                    </Button>
                ))}
            </aside>

            {/* Conversation list */}
            <section className="col-span-3 overflow-y-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                {conversations.length === 0 ? (
                    <div className="flex h-full items-center justify-center p-6">
                        <EmptyState
                            icon={Inbox}
                            size="sm"
                            title="No conversations"
                            description="Conversations for this inbox and status will appear here."
                        />
                    </div>
                ) : (
                    <ul className="divide-y divide-[var(--st-border)]">
                        {conversations.map((c) => (
                            <li
                                key={c._id}
                                className={`cursor-pointer p-3 hover:bg-[var(--st-bg-muted)] ${
                                    c._id === selectedId ? 'bg-[var(--st-bg-muted)]' : ''
                                }`}
                                onClick={() => {
                                    setSelectedId(c._id);
                                    updateUrl({ selected: c._id });
                                }}
                            >
                                <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
                                    <span>{c.priority}</span>
                                    <span>
                                        {c.lastMessageAt
                                            ? new Date(c.lastMessageAt).toLocaleTimeString()
                                            : ''}
                                    </span>
                                </div>
                                <div className="truncate text-sm font-medium text-[var(--st-text)]">
                                    {c.lastMessagePreview ?? '(no messages yet)'}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {(c.labels ?? []).map((l) => (
                                        <Badge key={l} tone="neutral" kind="outline" className="text-[10px]">
                                            {l}
                                        </Badge>
                                    ))}
                                    {c.unreadCount ? (
                                        <Badge tone="danger" kind="solid" className="ml-auto text-[10px]">
                                            {c.unreadCount}
                                        </Badge>
                                    ) : null}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Timeline + composer */}
            <main className="col-span-5 flex flex-col overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                {/* Tabs Bar */}
                {activeTabs.length > 0 && (
                    <div className="flex overflow-x-auto border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/50">
                        {activeTabs.map(tabId => {
                            const tConv = conversations.find(c => c._id === tabId);
                            const title = tConv ? (tConv.lastMessagePreview ? tConv.lastMessagePreview.slice(0, 15) + '...' : `Conv ${tabId.slice(-6)}`) : tabId.slice(-6);
                            const isActiveTab = selectedId === tabId;
                            return (
                                <div
                                    key={tabId}
                                    className={`group flex cursor-pointer items-center gap-2 border-r border-[var(--st-border)] px-3 py-2 text-sm ${isActiveTab ? 'border-b-2 border-b-[var(--st-accent)] bg-[var(--st-bg-secondary)] font-medium' : 'hover:bg-[var(--st-bg-muted)]'}`}
                                    onClick={() => { setSelectedId(tabId); updateUrl({ selected: tabId }); }}
                                >
                                    <span>{title}</span>
                                    <IconButton
                                        icon={X}
                                        label={`Close ${title}`}
                                        size="sm"
                                        variant="ghost"
                                        className="opacity-0 group-hover:opacity-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const newTabs = activeTabs.filter(id => id !== tabId);
                                            setActiveTabs(newTabs);
                                            if (selectedId === tabId) {
                                                const next = newTabs[newTabs.length - 1];
                                                setSelectedId(next);
                                                updateUrl({ selected: next });
                                            }
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
                {selected ? (
                    <>
                        <header className="flex items-center justify-between border-b border-[var(--st-border)] p-3">
                            <div className="text-sm font-semibold text-[var(--st-text)]">
                                Conversation {selected._id.slice(-6)}
                                <Badge tone="neutral" className="ml-2 capitalize">
                                    {selected.status}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="outline" iconRight={ChevronDown}>
                                            Actions
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Collaboration</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => toast({ title: 'Followed' })}>
                                            Follow
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toast({ title: 'Swarm initiated' })}>
                                            Swarm
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel>Routing</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => toast({ title: 'Handoff requested' })}>
                                            Handoff
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={onAssign} disabled={isPending}>
                                            Auto-assign
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Button size="sm" variant="ghost" onClick={onSnooze} disabled={isPending}>
                                    Snooze
                                </Button>
                                {selected.status === 'resolved' ? (
                                    <Button size="sm" variant="primary" onClick={onReopen} disabled={isPending}>
                                        Reopen
                                    </Button>
                                ) : (
                                    <Button size="sm" variant="primary" onClick={onResolve} disabled={isPending}>
                                        Resolve
                                    </Button>
                                )}
                            </div>
                        </header>
                        <div className="flex-1 space-y-2 overflow-y-auto p-3">
                            {messages.map((m) => (
                                <div
                                    key={m._id}
                                    className={`flex ${
                                        m.direction === 'outbound' ? 'justify-end' : 'justify-start'
                                    }`}
                                >
                                    <div
                                        className={`max-w-[70%] rounded-[var(--st-radius)] px-3 py-2 text-sm ${
                                            m.direction === 'outbound'
                                                ? 'bg-[var(--st-accent)] text-[var(--st-text-inverted)]'
                                                : 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                                        } ${m.private ? 'border-2 border-dashed border-[var(--st-border)]' : ''}`}
                                    >
                                        {renderContent(m.content)}
                                        <div className="mt-1 text-[10px] opacity-70">
                                            {new Date(m.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {messages.length === 0 ? (
                                <div className="flex h-full items-center justify-center py-8">
                                    <EmptyState
                                        icon={MessagesSquare}
                                        size="sm"
                                        title="No messages yet"
                                        description="Send a reply to start the conversation."
                                    />
                                </div>
                            ) : null}
                        </div>
                        <footer className="border-t border-[var(--st-border)] p-2">
                            <div className="flex gap-2">
                                <Field label="Reply" className="flex-1">
                                    <Input
                                        placeholder="Type a reply... (Cmd+K for Command Palette)"
                                        value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                onSend();
                                            }
                                        }}
                                    />
                                </Field>
                                <Button variant="primary" className="self-end" onClick={onSend} disabled={isPending || !draft.trim()}>
                                    Send
                                </Button>
                            </div>
                        </footer>
                    </>
                ) : (
                    <div className="flex flex-1 items-center justify-center">
                        <EmptyState
                            icon={MessagesSquare}
                            title="Pick a conversation"
                            description="Choose a conversation from the list to view its timeline."
                        />
                    </div>
                )}
            </main>

            {/* Contact 360 panel */}
            <Contact360 selected={selected} />
            <CommandPalette
                conversations={conversations}
                selectedId={selectedId}
                onSelect={(id) => { setSelectedId(id); updateUrl({ selected: id }); }}
                onAssign={onAssign}
                onResolve={onResolve}
                onSnooze={onSnooze}
            />
        </div>
    );
}

function renderContent(block: ContentBlock) {
    switch (block.kind) {
        case 'text':
            return <span className="whitespace-pre-wrap">{block.text}</span>;
        case 'image':
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={block.url} alt={block.alt ?? ''} className="max-h-40 rounded-[var(--st-radius)]" />;
        case 'file':
            return (
                <a href={block.attachment.url} target="_blank" rel="noreferrer" className="underline">
                    📎 {block.attachment.name}
                </a>
            );
        case 'voice':
            return <audio src={block.url} controls />;
        case 'card':
            return (
                <div>
                    <div className="font-semibold">{block.title}</div>
                    {block.subtitle ? <div className="text-xs opacity-80">{block.subtitle}</div> : null}
                </div>
            );
        case 'carousel':
            return <span>🎠 {block.cards.length} cards</span>;
        case 'form':
            return <span>📋 Form ({block.fields.length} fields)</span>;
        case 'payment':
            return (
                <a href={block.linkUrl} target="_blank" rel="noreferrer" className="underline">
                    💳 {(block.amountMinor / 100).toFixed(2)} {block.currency}
                </a>
            );
        case 'location':
            return (
                <span>
                    📍 {block.lat.toFixed(4)}, {block.lng.toFixed(4)}
                </span>
            );
        case 'system':
            return <span className="italic opacity-70">{block.text}</span>;
        default:
            return <span>(unknown content)</span>;
    }
}
