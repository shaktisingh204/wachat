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
    useToast,
} from '@/components/sabcrm/20ui';
import {
    Clock,
    File as FileIcon,
    Folder,
    HardDrive,
    RotateCcw,
    Share2,
    Star,
    Trash2,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
    emptyTrash,
    permanentDelete,
    restoreNodes,
    starNodes,
    trashNodes,
} from '@/app/actions/sabfiles.actions';
import type { SabfilesNode } from '@/lib/rust-client/sabfiles';
import { SabFileTable, useNodeMembers, formatBytes } from '@/components/sabfiles/views';

type Mode = 'recent' | 'starred' | 'shared' | 'shared-with-me' | 'trash';

const MODE_META: Record<Mode, { eyebrow: string; icon: LucideIcon; emptyTitle: string }> = {
    recent: { eyebrow: 'SabFiles', icon: Clock, emptyTitle: 'Nothing recent yet' },
    starred: { eyebrow: 'SabFiles', icon: Star, emptyTitle: 'No starred items' },
    shared: { eyebrow: 'SabFiles', icon: Share2, emptyTitle: 'Nothing shared yet' },
    'shared-with-me': { eyebrow: 'SabFiles', icon: Users, emptyTitle: 'Nothing shared with you yet' },
    trash: { eyebrow: 'SabFiles', icon: Trash2, emptyTitle: 'Trash is empty' },
};

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
    const router = useRouter();

    React.useEffect(() => setNodes(initialNodes), [initialNodes]);

    const showMembers = mode === 'shared' || mode === 'shared-with-me';
    const membersByNode = useNodeMembers(showMembers ? nodes : []);

    const onStar = async (n: SabfilesNode) => {
        setBusyId(n.id);
        const res = await starNodes([n.id], !n.starred, n.parentId);
        setBusyId(null);
        if ('error' in res) {
            toast({ title: 'Action failed', description: res.error, tone: 'danger' });
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
            toast({ title: 'Action failed', description: res.error, tone: 'danger' });
            return;
        }
        setNodes((curr) => curr.filter((x) => x.id !== n.id));
    };

    const onRestore = async (n: SabfilesNode) => {
        setBusyId(n.id);
        const res = await restoreNodes([n.id]);
        setBusyId(null);
        if ('error' in res) {
            toast({ title: 'Restore failed', description: res.error, tone: 'danger' });
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
            toast({ title: 'Delete failed', description: res.error, tone: 'danger' });
            return;
        }
        setNodes((curr) => curr.filter((x) => x.id !== n.id));
    };

    const onEmptyTrash = async () => {
        if (!window.confirm('Permanently delete every item in trash? This cannot be undone.')) return;
        const res = await emptyTrash();
        if ('error' in res) {
            toast({ title: 'Empty trash failed', description: res.error, tone: 'danger' });
            return;
        }
        setNodes([]);
    };

    const openNode = React.useCallback(
        (n: SabfilesNode) => {
            const href =
                n.type === 'folder'
                    ? `/dashboard/sabfiles/folder/${n.id}`
                    : n.parentId
                      ? `/dashboard/sabfiles/folder/${n.parentId}`
                      : '/dashboard/sabfiles';
            router.push(href);
        },
        [router],
    );

    const renderActions = React.useCallback(
        (n: SabfilesNode): React.ReactNode => {
            if (mode === 'shared-with-me') return null;
            if (mode === 'trash') {
                return (
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
                );
            }
            return (
                <div className="flex items-center justify-end gap-1">
                    <IconButton
                        label={n.starred ? `Unstar ${n.name}` : `Star ${n.name}`}
                        icon={Star}
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
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mode, busyId],
    );

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
                <StatCard label="Total size" value={formatBytes(totalSize)} icon={HardDrive} />
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
                    <SabFileTable
                        nodes={nodes}
                        membersByNode={membersByNode}
                        showMembers={showMembers}
                        dateLabel={mode === 'trash' ? 'Deleted' : 'Last edit'}
                        dateField={mode === 'trash' ? 'trashedAt' : 'updatedAt'}
                        onOpen={openNode}
                        renderActions={renderActions}
                        hrefForFolder={(n) => `/dashboard/sabfiles/folder/${n.id}`}
                    />
                </Card>
            )}
        </div>
    );
}
