'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button, Input, Badge, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/sabcrm/20ui/compat';
import { CommandPalette } from './command-palette';
import { Contact360 } from './contact-360';
import { ChevronDown, X } from 'lucide-react';
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
            <aside className="col-span-2 flex flex-col gap-2 overflow-y-auto rounded border bg-[var(--st-bg-secondary)] p-2">
                <div className="text-xs font-semibold uppercase text-[var(--st-text-secondary)]">Inboxes</div>
                {inboxes.map((ix) => (
                    <Button
                        key={ix._id}
                        variant={ix._id === selectedInboxId ? 'default' : 'ghost'}
                        size="sm"
                        className="justify-start"
                        onClick={() => updateUrl({ inboxId: ix._id, selected: undefined })}
                    >
                        <span className="truncate">{ix.name}</span>
                        <Badge variant="secondary" className="ml-auto text-[10px]">
                            {ix.channelType.replace(/_/g, ' ')}
                        </Badge>
                    </Button>
                ))}
                <div className="mt-3 text-xs font-semibold uppercase text-[var(--st-text-secondary)]">Status</div>
                {STATUSES.map((s) => (
                    <Button
                        key={s}
                        variant={s === status ? 'default' : 'ghost'}
                        size="sm"
                        className="justify-start capitalize"
                        onClick={() => updateUrl({ status: s, selected: undefined })}
                    >
                        {s}
                    </Button>
                ))}
            </aside>

            {/* Conversation list */}
            <section className="col-span-3 overflow-y-auto rounded border bg-[var(--st-bg-secondary)]">
                {conversations.length === 0 ? (
                    <div className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
                        No conversations.
                    </div>
                ) : (
                    <ul className="divide-y">
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
                                <div className="truncate text-sm font-medium">
                                    {c.lastMessagePreview ?? '(no messages yet)'}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {(c.labels ?? []).map((l) => (
                                        <Badge key={l} variant="outline" className="text-[10px]">
                                            {l}
                                        </Badge>
                                    ))}
                                    {c.unreadCount ? (
                                        <Badge variant="destructive" className="ml-auto text-[10px]">
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
            <main className="col-span-5 flex flex-col rounded border bg-[var(--st-bg-secondary)] overflow-hidden">
                {/* Tabs Bar */}
                {activeTabs.length > 0 && (
                    <div className="flex bg-[var(--st-bg-muted)]/50 border-b overflow-x-auto">
                        {activeTabs.map(tabId => {
                            const tConv = conversations.find(c => c._id === tabId);
                            const title = tConv ? (tConv.lastMessagePreview ? tConv.lastMessagePreview.slice(0, 15) + '...' : `Conv ${tabId.slice(-6)}`) : tabId.slice(-6);
                            return (
                                <div
                                    key={tabId}
                                    className={`group flex items-center gap-2 px-3 py-2 text-sm border-r cursor-pointer ${selectedId === tabId ? 'bg-[var(--st-bg-secondary)] font-medium border-b-2 border-b-primary' : 'hover:bg-[var(--st-bg-muted)]'}`}
                                    onClick={() => { setSelectedId(tabId); updateUrl({ selected: tabId }); }}
                                >
                                    <span>{title}</span>
                                    <button
                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-[var(--st-bg-muted)]"
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
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
                {selected ? (
                    <>
                        <header className="flex items-center justify-between border-b p-3">
                            <div className="text-sm font-semibold">
                                Conversation {selected._id.slice(-6)}
                                <Badge variant="secondary" className="ml-2 capitalize">
                                    {selected.status}
                                </Badge>
                            </div>
                            <div className="flex gap-1 items-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="outline">
                                            Actions <ChevronDown className="w-4 h-4 ml-1" />
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
                                    <Button size="sm" onClick={onReopen} disabled={isPending}>
                                        Reopen
                                    </Button>
                                ) : (
                                    <Button size="sm" onClick={onResolve} disabled={isPending}>
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
                                        className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                                            m.direction === 'outbound'
                                                ? 'bg-[var(--st-text)] text-white'
                                                : 'bg-[var(--st-bg-muted)]'
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
                                <div className="py-8 text-center text-xs text-[var(--st-text-secondary)]">
                                    No messages yet.
                                </div>
                            ) : null}
                        </div>
                        <footer className="border-t p-2">
                            <div className="flex gap-2">
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
                                <Button onClick={onSend} disabled={isPending || !draft.trim()}>
                                    Send
                                </Button>
                            </div>
                        </footer>
                    </>
                ) : (
                    <div className="flex flex-1 items-center justify-center text-sm text-[var(--st-text-secondary)]">
                        Pick a conversation.
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
            return <img src={block.url} alt={block.alt ?? ''} className="max-h-40 rounded" />;
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
