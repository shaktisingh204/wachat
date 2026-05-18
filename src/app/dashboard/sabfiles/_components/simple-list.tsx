'use client';

import { ZoruButton, ZoruCard, ZoruCardContent, cn, useZoruToast } from '@/components/zoruui';
import {
  File as FileIcon,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  RotateCcw,
  Star,
  Trash2,
  } from 'lucide-react';

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

function fileIconFor(node: SabfilesNode): React.ReactElement {
    if (node.type === 'folder') return <Folder className="text-amber-500" />;
    const mime = node.mime || '';
    if (mime.startsWith('image/')) return <FileImage className="text-violet-500" />;
    if (mime.startsWith('video/')) return <FileVideo className="text-rose-500" />;
    if (mime.includes('text') || mime.includes('pdf')) return <FileText className="text-sky-500" />;
    return <FileIcon className="text-zoru-ink-muted" />;
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
    const { toast } = useZoruToast();

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

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-zoru-ink">{title}</h1>
                {mode === 'trash' && nodes.length > 0 && (
                    <ZoruButton variant="destructive" onClick={onEmptyTrash}>
                        <Trash2 /> Empty trash
                    </ZoruButton>
                )}
            </div>

            {nodes.length === 0 ? (
                <ZoruCard className="p-12 text-center text-sm text-zoru-ink-muted">
                    {emptyHint}
                </ZoruCard>
            ) : (
                <ZoruCard>
                    <ZoruCardContent className="p-0">
                        <ul className="divide-y divide-zoru-line">
                            {nodes.map((n) => {
                                const href =
                                    n.type === 'folder'
                                        ? `/dashboard/sabfiles/folder/${n.id}`
                                        : n.parentId
                                          ? `/dashboard/sabfiles/folder/${n.parentId}`
                                          : '/dashboard/sabfiles';
                                return (
                                    <li
                                        key={n.id}
                                        className={cn(
                                            'flex items-center gap-3 px-3 py-2 hover:bg-zoru-surface',
                                            busyId === n.id && 'opacity-60',
                                        )}
                                    >
                                        <span className="flex h-6 w-6 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
                                            {fileIconFor(n)}
                                        </span>
                                        <Link
                                            href={href}
                                            className="flex-1 truncate text-sm text-zoru-ink hover:underline"
                                        >
                                            {n.name}
                                        </Link>
                                        <span className="hidden w-24 text-right text-xs text-zoru-ink-muted sm:inline">
                                            {n.type === 'folder' ? '—' : fmtSize(n.size)}
                                        </span>
                                        <span className="hidden w-32 text-right text-xs text-zoru-ink-muted md:inline">
                                            {mode === 'trash'
                                                ? fmtDate(n.trashedAt) || fmtDate(n.updatedAt)
                                                : fmtDate(n.updatedAt)}
                                        </span>
                                        {mode === 'trash' ? (
                                            <>
                                                <ZoruButton
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => onRestore(n)}
                                                    disabled={busyId === n.id}
                                                >
                                                    <RotateCcw /> Restore
                                                </ZoruButton>
                                                <ZoruButton
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => onPermanent(n)}
                                                    disabled={busyId === n.id}
                                                >
                                                    <Trash2 /> Delete
                                                </ZoruButton>
                                            </>
                                        ) : (
                                            <>
                                                <ZoruButton
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => onStar(n)}
                                                    disabled={busyId === n.id}
                                                    aria-label="Toggle star"
                                                >
                                                    <Star
                                                        className={cn(
                                                            n.starred && 'fill-amber-400 text-amber-400',
                                                        )}
                                                    />
                                                </ZoruButton>
                                                <ZoruButton
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => onTrash(n)}
                                                    disabled={busyId === n.id}
                                                    aria-label="Move to trash"
                                                >
                                                    <Trash2 />
                                                </ZoruButton>
                                            </>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </ZoruCardContent>
                </ZoruCard>
            )}
        </div>
    );
}
