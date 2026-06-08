'use client';

import {
    Badge,
    Button,
    Card,
    CardHeader,
    CardTitle,
    EmptyState,
    IconButton,
    PageActions,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    StatCard,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    cn,
    useToast,
} from '@/components/sabcrm/20ui';
import {
    Clock,
    File as FileIcon,
    FileImage,
    FileText,
    FileVideo,
    Folder,
    HardDrive,
    RotateCcw,
    Share2,
    Star,
    Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import {
    emptyTrash,
    permanentDelete,
    restoreNodes,
    starNodes,
    trashNodes,
} from '@/app/actions/sabfiles.actions';
import type { SabfilesNode } from '@/lib/rust-client/sabfiles';

type Mode = 'recent' | 'starred' | 'shared' | 'trash';

const MODE_META: Record<
    Mode,
    { eyebrow: string; icon: LucideIcon; emptyTitle: string }
> = {
    recent: { eyebrow: 'SabFiles', icon: Clock, emptyTitle: 'Nothing recent yet' },
    starred: { eyebrow: 'SabFiles', icon: Star, emptyTitle: 'No starred items' },
    shared: { eyebrow: 'SabFiles', icon: Share2, emptyTitle: 'Nothing shared yet' },
    trash: { eyebrow: 'SabFiles', icon: Trash2, emptyTitle: 'Trash is empty' },
};

function nodeIcon(node: SabfilesNode): LucideIcon {
    if (node.type === 'folder') return Folder;
    const mime = node.mime || '';
    if (mime.startsWith('image/')) return FileImage;
    if (mime.startsWith('video/')) return FileVideo;
    if (mime.includes('text') || mime.includes('pdf')) return FileText;
    return FileIcon;
}

function fmtSize(bytes?: number | null): string {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    const u = ['KB', 'MB', 'GB', 'TB'];
    let v = bytes / 1024;
    let i = 0;
    while (v >= 1024 && i < u.length - 1) {
        v /= 1024;
        i += 1;
    }
    return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

function fmtDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export function SimpleList({
    initialNodes,
    mode,
    title,
    emptyHint,
}: {
    initialNodes: SabfilesNode[];
    mode: Mode;
    title: string;
    emptyHint: string;
}) {
    const [nodes, setNodes] = React.useState(initialNodes);
    const [busyId, setBusyId] = React.useState<string | null>(null);
    const { toast } = useToast();

    React.useEffect(() => setNodes(initialNodes), [initialNodes]);

    const onStar = async (n: SabfilesNode) => {
        setBusyId(n.id);
        const res = await starNodes([n.id], !n.starred, n.parentId);
        setBusyId(null);
        if ('error' in res) {
            toast({ title: 'Action failed', description: res.error, variant: 'destructive' });
            return;
        }
        if (mode === 'starred') {
            setNodes((curr) => curr.filter((x) => x.id !== n.id));
        } else {
            setNodes((curr) => curr.map((x) => (x.id === n.id ? { ...x, starred: !n.starred } : x)));
        }
    };

    const onTrash = async (n: SabfilesNode) => {
        setBusyId(n.id);
        const res = await trashNodes([n.id], n.parentId);
        setBusyId(null);
        if ('error' in res) {
            toast({ title: 'Action failed', description: res.error, variant: 'destructive' });
            return;
        }
        setNodes((curr) => curr.filter((x) => x.id !== n.id));
    };

    const onRestore = async (n: SabfilesNode) => {
        setBusyId(n.id);
        const res = await restoreNodes([n.id]);
        setBusyId(null);
        if ('error' in res) {
            toast({ title: 'Restore failed', description: res.error, variant: 'destructive' });
            return;
        }
        setNodes((curr) => curr.filter((x) => x.id !== n.id));
    };

    const onPermanent = async (n: SabfilesNode) => {
        if (!window.confirm(`Permanently delete "${n.name}"? This cannot be undone.`)) return;
        setBusyId(n.id);
        const res = await permanentDelete([n.id]);
        setBusyId(null);
        if ('error' in res) {
            toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
            return;
        }
        setNodes((curr) => curr.filter((x) => x.id !== n.id));
    };

    const onEmptyTrash = async () => {
        if (!window.confirm('Permanently delete every item in trash? This cannot be undone.')) return;
        const res = await emptyTrash();
        if ('error' in res) {
            toast({ title: 'Empty trash failed', description: res.error, variant: 'destructive' });
            return;
        }
        setNodes([]);
    };

    const meta = MODE_META[mode];
    const ModeIcon = meta.icon;
    const folderCount = nodes.filter((n) => n.type === 'folder').length;
    const fileCount = nodes.length - folderCount;
    const totalSize = nodes.reduce((sum, n) => sum + (n.type === 'folder' ? 0 : n.size ?? 0), 0);

    return (
        <div className="flex flex-col gap-[var(--st-space-5)]">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>{meta.eyebrow}</PageEyebrow>
                    <PageTitle>{title}</PageTitle>
                    <PageDescription>{emptyHint}</PageDescription>
                </PageHeaderHeading>
                {mode === 'trash' && nodes.length > 0 ? (
                    <PageActions>
                        <Button variant="destructive" iconLeft={Trash2} onClick={onEmptyTrash}>
                            Empty trash
                        </Button>
                    </PageActions>
                ) : null}
            </PageHeader>

            <div className="grid grid-cols-3 gap-[var(--st-space-3)]">
                <StatCard label="Items" value={nodes.length} icon={ModeIcon} />
                <StatCard label="Files" value={fileCount} icon={FileIcon} />
                <StatCard label="Total size" value={fmtSize(totalSize)} icon={HardDrive} />
            </div>

            {nodes.length === 0 ? (
                <Card variant="ghost" padding="lg">
                    <EmptyState
                        icon={meta.icon}
                        title={meta.emptyTitle}
                        description={emptyHint}
                        action={
                            <Button variant="secondary" asChild>
                                <Link href="/dashboard/sabfiles">
                                    <Folder size={14} aria-hidden="true" /> Go to My files
                                </Link>
                            </Button>
                        }
                    />
                </Card>
            ) : (
                <Card padding="none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ModeIcon size={16} aria-hidden="true" />
                            {title}
                            <Badge tone="neutral" kind="soft">
                                {nodes.length}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <Table hover>
                        <THead>
                            <Tr>
                                <Th>Name</Th>
                                <Th align="right" width={110}>
                                    Size
                                </Th>
                                <Th align="right" width={140}>
                                    {mode === 'trash' ? 'Deleted' : 'Modified'}
                                </Th>
                                <Th align="right" width={mode === 'trash' ? 180 : 96}>
                                    <span className="sr-only">Actions</span>
                                </Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {nodes.map((n) => {
                                const Icon = nodeIcon(n);
                                const href =
                                    n.type === 'folder'
                                        ? `/dashboard/sabfiles/folder/${n.id}`
                                        : n.parentId
                                          ? `/dashboard/sabfiles/folder/${n.parentId}`
                                          : '/dashboard/sabfiles';
                                return (
                                    <Tr key={n.id} className={cn(busyId === n.id && 'opacity-60')}>
                                        <Td>
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
                                                    <Icon size={18} aria-hidden="true" />
                                                </span>
                                                <Link
                                                    href={href}
                                                    className="truncate font-medium text-[var(--st-text)] hover:underline"
                                                >
                                                    {n.name}
                                                </Link>
                                                {n.starred && mode !== 'starred' ? (
                                                    <Badge tone="warning" kind="soft" dot>
                                                        Starred
                                                    </Badge>
                                                ) : null}
                                                {n.shareToken && mode !== 'shared' ? (
                                                    <Badge tone="info" kind="soft">
                                                        Shared
                                                    </Badge>
                                                ) : null}
                                            </div>
                                        </Td>
                                        <Td align="right" className="text-[var(--st-text-secondary)]">
                                            {n.type === 'folder' ? '—' : fmtSize(n.size)}
                                        </Td>
                                        <Td align="right" className="text-[var(--st-text-secondary)]">
                                            {mode === 'trash'
                                                ? fmtDate(n.trashedAt) || fmtDate(n.updatedAt)
                                                : fmtDate(n.updatedAt)}
                                        </Td>
                                        <Td align="right">
                                            {mode === 'trash' ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        iconLeft={RotateCcw}
                                                        onClick={() => onRestore(n)}
                                                        disabled={busyId === n.id}
                                                    >
                                                        Restore
                                                    </Button>
                                                    <IconButton
                                                        label={`Permanently delete ${n.name}`}
                                                        icon={Trash2}
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => onPermanent(n)}
                                                        disabled={busyId === n.id}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1">
                                                    <IconButton
                                                        label={n.starred ? `Unstar ${n.name}` : `Star ${n.name}`}
                                                        icon={
                                                            <Star
                                                                size={16}
                                                                className={cn(
                                                                    n.starred &&
                                                                        'fill-[var(--st-warning)] text-[var(--st-warning)]',
                                                                )}
                                                            />
                                                        }
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => onStar(n)}
                                                        disabled={busyId === n.id}
                                                    />
                                                    <IconButton
                                                        label={`Move ${n.name} to trash`}
                                                        icon={Trash2}
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => onTrash(n)}
                                                        disabled={busyId === n.id}
                                                    />
                                                </div>
                                            )}
                                        </Td>
                                    </Tr>
                                );
                            })}
                        </TBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
