'use client';

/**
 * Three-pane inbox.
 *
 * Layout: [folder tree | message list | preview pane].
 * Sort by date / unread / sender. Unread rows are bolded.
 * Selection drives the preview; preview actions hit the action layer.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowDownAZ,
    ArrowUpAZ,
    Folder,
    Inbox,
    Mail,
    MailOpen,
    PencilLine,
    Search,
    Star,
    Trash2,
} from 'lucide-react';

import {
    listMailMessages,
    markMailMessage,
} from '@/app/actions/mailbox.actions';
import type { MailFolderDoc } from '@/lib/rust-client/mail-folders';
import type { MailMessageDoc } from '@/lib/rust-client/mail-messages';
import {
    Badge,
    Button,
    Card,
    CardBody,
    EmptyState,
    IconButton,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    cn,
    useToast,
} from '@/components/sabcrm/20ui';

type SortKey = 'date' | 'sender' | 'subject';

export interface InboxClientProps {
    accountId: string;
    initialFolders: MailFolderDoc[];
    initialMessages: MailMessageDoc[];
}

function formatTime(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString();
}

export function InboxClient({
    accountId,
    initialFolders,
    initialMessages,
}: InboxClientProps) {
    const router = useRouter();
    const { toast } = useToast();

    const [folders] = React.useState(initialFolders);
    const [messages, setMessages] = React.useState(initialMessages);
    const [activeFolderId, setActiveFolderId] = React.useState<string | null>(
        initialFolders.find((f) => f.type === 'inbox')?._id ?? initialFolders[0]?._id ?? null,
    );
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState('');
    const [sortKey, setSortKey] = React.useState<SortKey>('date');
    const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
    const [busy, setBusy] = React.useState(false);

    // Refetch when folder changes
    React.useEffect(() => {
        let cancelled = false;
        void listMailMessages({
            accountId,
            folderId: activeFolderId ?? undefined,
            limit: 100,
        }).then((rows) => {
            if (cancelled) return;
            setMessages(rows);
            setSelectedId(null);
        });
        return () => {
            cancelled = true;
        };
    }, [accountId, activeFolderId]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = q
            ? messages.filter((m) =>
                  [m.subject, m.snippet, m.fromAddr?.email, m.fromAddr?.name]
                      .filter(Boolean)
                      .some((v) => v!.toLowerCase().includes(q)),
              )
            : messages;
        const sorted = [...list].sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'date') {
                cmp = (a.receivedAt ?? a.createdAt).localeCompare(b.receivedAt ?? b.createdAt);
            } else if (sortKey === 'sender') {
                cmp = (a.fromAddr?.email ?? '').localeCompare(b.fromAddr?.email ?? '');
            } else {
                cmp = (a.subject ?? '').localeCompare(b.subject ?? '');
            }
            return sortDir === 'desc' ? -cmp : cmp;
        });
        return sorted;
    }, [messages, search, sortKey, sortDir]);

    const selected = React.useMemo(
        () => filtered.find((m) => m._id === selectedId) ?? null,
        [filtered, selectedId],
    );

    const updateLocal = (id: string, patch: Partial<MailMessageDoc>) => {
        setMessages((prev) => prev.map((m) => (m._id === id ? { ...m, ...patch } : m)));
    };

    const handleSelect = async (m: MailMessageDoc) => {
        setSelectedId(m._id!);
        if (m.unread) {
            updateLocal(m._id!, { unread: false });
            const res = await markMailMessage(m._id!, { unread: false }, accountId);
            if (!res.ok) {
                toast.error({ title: 'Could not mark read', description: res.error });
            }
        }
    };

    const handleToggleStar = async (m: MailMessageDoc) => {
        const next = !m.starred;
        updateLocal(m._id!, { starred: next });
        const res = await markMailMessage(m._id!, { starred: next }, accountId);
        if (!res.ok) {
            updateLocal(m._id!, { starred: !next });
            toast.error({ title: 'Star failed', description: res.error });
        }
    };

    const handleToggleRead = async (m: MailMessageDoc) => {
        const next = !m.unread;
        updateLocal(m._id!, { unread: next });
        const res = await markMailMessage(m._id!, { unread: next }, accountId);
        if (!res.ok) {
            updateLocal(m._id!, { unread: !next });
            toast.error({ title: 'Update failed', description: res.error });
        }
    };

    const handleMove = async (m: MailMessageDoc, folderId: string) => {
        setBusy(true);
        const res = await markMailMessage(m._id!, { folderId }, accountId);
        setBusy(false);
        if (!res.ok) {
            toast.error({ title: 'Move failed', description: res.error });
            return;
        }
        toast.success('Moved');
        setMessages((prev) => prev.filter((x) => x._id !== m._id));
        setSelectedId(null);
        router.refresh();
    };

    return (
        <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-3 p-3 md:grid-cols-[14rem_1fr] lg:grid-cols-[14rem_22rem_1fr]">
            {/* Folder tree */}
            <aside className="flex min-h-0 flex-col gap-1 overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2">
                <Link href={`/dashboard/mailbox/${accountId}/compose`} className="mb-2 block">
                    <Button variant="primary" size="sm" block iconLeft={PencilLine} className="justify-start">
                        Compose
                    </Button>
                </Link>
                {folders.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-[var(--st-text-secondary)]">
                        No folders yet. Defaults appear on first sync.
                    </p>
                ) : (
                    folders.map((f) => {
                        const id = f._id!;
                        const isActive = id === activeFolderId;
                        const Icon = f.type === 'inbox' ? Inbox : Folder;
                        return (
                            <Button
                                key={id}
                                variant="ghost"
                                size="sm"
                                block
                                onClick={() => setActiveFolderId(id)}
                                className={cn(
                                    'justify-between',
                                    isActive
                                        ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                                        : 'text-[var(--st-text-secondary)]',
                                )}
                            >
                                <span className="flex items-center gap-2 truncate">
                                    <Icon className="h-4 w-4" aria-hidden="true" />
                                    <span className="truncate">{f.name}</span>
                                </span>
                                {f.unreadCount ? (
                                    <Badge tone="neutral">{f.unreadCount}</Badge>
                                ) : null}
                            </Button>
                        );
                    })
                )}
            </aside>

            {/* Message list */}
            <section className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]">
                <div className="flex items-center gap-2 border-b border-[var(--st-border)] p-2">
                    <Input
                        inputSize="sm"
                        iconLeft={Search}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search subject, sender, snippet"
                        aria-label="Search messages"
                    />
                    <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                        <SelectTrigger className="w-28 shrink-0" aria-label="Sort messages by">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="sender">Sender</SelectItem>
                            <SelectItem value="subject">Subject</SelectItem>
                        </SelectContent>
                    </Select>
                    <IconButton
                        variant="ghost"
                        size="sm"
                        icon={sortDir === 'desc' ? ArrowDownAZ : ArrowUpAZ}
                        label="Toggle sort direction"
                        onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    />
                </div>
                <div className="flex-1 overflow-auto">
                    {filtered.length === 0 ? (
                        <EmptyState
                            size="sm"
                            icon={Mail}
                            title="No messages"
                            description="When mail arrives, it will land here."
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {filtered.map((m) => {
                                const id = m._id!;
                                const isSelected = id === selectedId;
                                return (
                                    <li
                                        key={id}
                                        className={cn(
                                            'cursor-pointer px-3 py-2 text-sm hover:bg-[var(--st-bg-muted)]',
                                            isSelected && 'bg-[var(--st-bg-muted)]',
                                        )}
                                        onClick={() => handleSelect(m)}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span
                                                className={cn(
                                                    'truncate',
                                                    m.unread
                                                        ? 'font-semibold text-[var(--st-text)]'
                                                        : 'text-[var(--st-text-secondary)]',
                                                )}
                                            >
                                                {m.fromAddr?.name ?? m.fromAddr?.email ?? 'Unknown'}
                                            </span>
                                            <span className="shrink-0 text-xs text-[var(--st-text-secondary)]">
                                                {formatTime(m.receivedAt ?? m.createdAt)}
                                            </span>
                                        </div>
                                        <div
                                            className={cn(
                                                'truncate',
                                                m.unread ? 'font-medium text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]',
                                            )}
                                        >
                                            {m.subject || '(no subject)'}
                                        </div>
                                        {m.snippet && (
                                            <div className="truncate text-xs text-[var(--st-text-secondary)]">
                                                {m.snippet}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </section>

            {/* Preview pane */}
            <section className="hidden min-h-0 overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] lg:flex lg:flex-col">
                {!selected ? (
                    <EmptyState
                        icon={Mail}
                        title="Select a message"
                        description="Click any row to preview it here."
                    />
                ) : (
                    <>
                        <header className="flex flex-col gap-2 border-b border-[var(--st-border)] p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="truncate text-base font-semibold text-[var(--st-text)]">
                                        {selected.subject || '(no subject)'}
                                    </h2>
                                    <p className="truncate text-sm text-[var(--st-text-secondary)]">
                                        From{' '}
                                        <span className="font-medium text-[var(--st-text)]">
                                            {selected.fromAddr?.name ?? selected.fromAddr?.email}
                                        </span>{' '}
                                        - {formatTime(selected.receivedAt ?? selected.createdAt)}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <IconButton
                                        variant="ghost"
                                        icon={Star}
                                        label={selected.starred ? 'Remove star' : 'Add star'}
                                        onClick={() => handleToggleStar(selected)}
                                        className={cn(selected.starred && 'text-[var(--st-text)]')}
                                    />
                                    <IconButton
                                        variant="ghost"
                                        icon={selected.unread ? Mail : MailOpen}
                                        label={selected.unread ? 'Mark as read' : 'Mark as unread'}
                                        onClick={() => handleToggleRead(selected)}
                                    />
                                    <Select
                                        value={selected.folderId}
                                        onValueChange={(v) => handleMove(selected, v)}
                                    >
                                        <SelectTrigger className="w-32" aria-label="Move to folder">
                                            <SelectValue placeholder="Move" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {folders.map((f) => (
                                                <SelectItem key={f._id} value={f._id!}>
                                                    {f.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <IconButton
                                        variant="ghost"
                                        icon={Trash2}
                                        label="Move to trash"
                                        disabled={busy}
                                        onClick={() => {
                                            const trash = folders.find((f) => f.type === 'trash');
                                            if (trash?._id) handleMove(selected, trash._id);
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                                <span>To:</span>
                                {(selected.toAddrs ?? []).map((t, i) => (
                                    <Badge key={i} tone="neutral">
                                        {t.name ? `${t.name} <${t.email}>` : t.email}
                                    </Badge>
                                ))}
                            </div>
                        </header>
                        <div className="flex-1 overflow-auto p-4 text-sm">
                            <Card variant="outlined" padding="none" className="max-w-3xl">
                                <CardBody className="text-sm text-[var(--st-text-secondary)]">
                                    {selected.snippet ? (
                                        <p>{selected.snippet}</p>
                                    ) : (
                                        <p>
                                            Full body lives in SabFiles
                                            {selected.bodyFileId
                                                ? ` (ref ${selected.bodyFileId})`
                                                : '. No body fetched yet'}
                                            .
                                        </p>
                                    )}
                                </CardBody>
                            </Card>
                            {selected.attachmentFileIds && selected.attachmentFileIds.length > 0 ? (
                                <>
                                    <Separator className="my-4" />
                                    <h3 className="mb-2 text-sm font-medium text-[var(--st-text)]">Attachments</h3>
                                    <ul className="flex flex-wrap gap-2 text-xs">
                                        {selected.attachmentFileIds.map((fid) => (
                                            <li
                                                key={fid}
                                                className="rounded-[var(--st-radius)] border border-[var(--st-border)] px-2 py-1 font-mono text-[var(--st-text-secondary)]"
                                            >
                                                {fid}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : null}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
