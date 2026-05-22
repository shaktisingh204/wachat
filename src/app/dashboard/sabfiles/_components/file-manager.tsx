'use client';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Input,
  Label,
  Progress,
  Switch,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
    ChevronRight,
  Copy,
  Download,
  ExternalLink,
  File as FileIcon,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  FolderPlus,
  Loader2,
  MoreVertical,
  Pencil,
  Search,
  Share2,
  Star,
  Trash2,
  Upload,
  X,
  } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import {
    confirmUpload,
    createFolder,
    createShare,
    getDownloadUrl,
    moveNodes,
    presignUpload,
    renameNode,
    revokeShare,
    starNodes,
    trashNodes,
} from '@/app/actions/sabfiles.actions';
import type {
    SabfilesBreadcrumbEntry,
    SabfilesNode,
} from '@/lib/rust-client/sabfiles';
import { getSabfilesOpenIntent } from '@/lib/sabfiles/share-ui';

type View = 'grid' | 'list';

interface UploadTask {
    id: string;
    file: File;
    progress: number;
    status: 'queued' | 'uploading' | 'done' | 'error';
    error?: string;
}

interface FileManagerProps {
    parentId: string | null;
    initialNodes: SabfilesNode[];
    initialBreadcrumb: SabfilesBreadcrumbEntry[];
}

function fileIconFor(node: SabfilesNode): React.ReactElement {
    if (node.type === 'folder') return <Folder className="text-amber-500" />;
    const mime = node.mime || '';
    if (mime.startsWith('image/')) return <FileImage className="text-violet-500" />;
    if (mime.startsWith('video/')) return <FileVideo className="text-rose-500" />;
    if (mime.includes('text') || mime.includes('pdf')) return <FileText className="text-sky-500" />;
    return <FileIcon className="text-zoru-ink-muted" />;
}

function formatSize(bytes?: number | null): string {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let v = bytes / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i += 1;
    }
    return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export function FileManager({
    parentId,
    initialNodes,
    initialBreadcrumb,
}: FileManagerProps) {
    const router = useRouter();
    const { toast } = useZoruToast();

    const [nodes, setNodes] = React.useState<SabfilesNode[]>(initialNodes);
    const [view, setView] = React.useState<View>('grid');
    const [query, setQuery] = React.useState('');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [isDragging, setIsDragging] = React.useState(false);
    const [uploads, setUploads] = React.useState<UploadTask[]>([]);
    const [showNewFolder, setShowNewFolder] = React.useState(false);
    const [newFolderName, setNewFolderName] = React.useState('');
    const [renameTarget, setRenameTarget] = React.useState<SabfilesNode | null>(null);
    const [renameDraft, setRenameDraft] = React.useState('');
    const [shareTarget, setShareTarget] = React.useState<SabfilesNode | null>(null);
    const [shareExpiresInDays, setShareExpiresInDays] = React.useState<string>('');
    const [sharePassword, setSharePassword] = React.useState('');
    const [shareDownload, setShareDownload] = React.useState(true);
    const [shareUrl, setShareUrl] = React.useState<string | null>(null);
    const [actionTarget, setActionTarget] = React.useState<SabfilesNode | null>(null);
    const [confirmDelete, setConfirmDelete] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        setNodes(initialNodes);
        setSelected(new Set());
    }, [initialNodes]);

    const filtered = React.useMemo(() => {
        if (!query.trim()) return nodes;
        const q = query.toLowerCase();
        return nodes.filter((n) => n.name.toLowerCase().includes(q));
    }, [nodes, query]);

    const toggleSelect = React.useCallback((id: string, additive: boolean) => {
        setSelected((prev) => {
            const next = new Set(additive ? prev : []);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const clearSelection = React.useCallback(() => setSelected(new Set()), []);

    // ─── Upload (direct to R2 via presigned PUT) ───────────────────────
    const startUpload = React.useCallback(
        async (file: File): Promise<void> => {
            const taskId = `${file.name}-${file.size}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`;
            setUploads((u) => [
                ...u,
                { id: taskId, file, progress: 0, status: 'queued' },
            ]);

            // 1. Presign.
            const presign = await presignUpload({
                name: file.name,
                size: file.size,
                mime: file.type || undefined,
                parent_id: parentId,
            });
            if ('error' in presign) {
                setUploads((u) =>
                    u.map((t) =>
                        t.id === taskId
                            ? { ...t, status: 'error', error: presign.error }
                            : t,
                    ),
                );
                toast({
                    title: 'Upload failed',
                    description: presign.error,
                    variant: 'destructive',
                });
                return;
            }

            // 2. PUT direct to R2 with XHR for progress.
            const putOk = await new Promise<boolean>((resolve) => {
                const xhr = new XMLHttpRequest();
                xhr.open(presign.method, presign.upload_url);
                for (const [k, v] of Object.entries(presign.headers || {})) {
                    xhr.setRequestHeader(k, v);
                }
                xhr.upload.addEventListener('progress', (e) => {
                    if (!e.lengthComputable) return;
                    const pct = Math.round((e.loaded / e.total) * 100);
                    setUploads((u) =>
                        u.map((t) =>
                            t.id === taskId
                                ? { ...t, status: 'uploading', progress: pct }
                                : t,
                        ),
                    );
                });
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(true);
                    } else {
                        setUploads((u) =>
                            u.map((t) =>
                                t.id === taskId
                                    ? {
                                          ...t,
                                          status: 'error',
                                          error: `Storage returned ${xhr.status}`,
                                      }
                                    : t,
                            ),
                        );
                        resolve(false);
                    }
                });
                xhr.addEventListener('error', () => {
                    setUploads((u) =>
                        u.map((t) =>
                            t.id === taskId
                                ? { ...t, status: 'error', error: 'Network error' }
                                : t,
                        ),
                    );
                    resolve(false);
                });
                xhr.send(file);
            });

            if (!putOk) return;

            // 3. Confirm with the BFF.
            const res = await confirmUpload({
                key: presign.key,
                name: file.name,
                size: file.size,
                mime: file.type || undefined,
                parent_id: parentId,
            });
            if ('error' in res) {
                setUploads((u) =>
                    u.map((t) =>
                        t.id === taskId
                            ? { ...t, status: 'error', error: res.error }
                            : t,
                    ),
                );
                toast({
                    title: 'Upload failed',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            setUploads((u) =>
                u.map((t) =>
                    t.id === taskId ? { ...t, status: 'done', progress: 100 } : t,
                ),
            );
            setNodes((curr) => [res.node, ...curr]);
        },
        [parentId, toast],
    );

    const onFilesPicked = React.useCallback(
        (list: FileList | null) => {
            if (!list || list.length === 0) return;
            for (const f of Array.from(list)) {
                void startUpload(f);
            }
        },
        [startUpload],
    );

    // ─── Drag + drop on the page ───────────────────────────────────────
    const onDragOver = React.useCallback((e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setIsDragging(true);
        }
    }, []);
    const onDragLeave = React.useCallback((e: React.DragEvent) => {
        // Only clear when leaving the outer container, not its children.
        if (e.currentTarget === e.target) setIsDragging(false);
    }, []);
    const onDrop = React.useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            onFilesPicked(e.dataTransfer.files);
        },
        [onFilesPicked],
    );

    // ─── New folder ────────────────────────────────────────────────────
    const submitNewFolder = React.useCallback(async () => {
        const name = newFolderName.trim();
        if (!name) return;
        const res = await createFolder(parentId, name);
        if ('error' in res) {
            toast({ title: 'Could not create folder', description: res.error, variant: 'destructive' });
            return;
        }
        setNodes((curr) => [res.node, ...curr]);
        setShowNewFolder(false);
        setNewFolderName('');
        toast({ title: 'Folder created', description: name });
    }, [newFolderName, parentId, toast]);

    // ─── Rename ────────────────────────────────────────────────────────
    const submitRename = React.useCallback(async () => {
        if (!renameTarget) return;
        const name = renameDraft.trim();
        if (!name || name === renameTarget.name) {
            setRenameTarget(null);
            return;
        }
        const res = await renameNode(renameTarget.id, name, parentId);
        if ('error' in res) {
            toast({ title: 'Rename failed', description: res.error, variant: 'destructive' });
            return;
        }
        setNodes((curr) => curr.map((n) => (n.id === renameTarget.id ? res.node : n)));
        setRenameTarget(null);
    }, [renameDraft, renameTarget, parentId, toast]);

    // ─── Share ─────────────────────────────────────────────────────────
    const openShareDialog = React.useCallback((node: SabfilesNode) => {
        setShareTarget(node);
        setShareExpiresInDays('');
        setSharePassword('');
        setShareDownload(true);
        if (node.shareToken) {
            setShareUrl(
                typeof window !== 'undefined'
                    ? `${window.location.origin}/share/${node.shareToken}`
                    : `/share/${node.shareToken}`,
            );
        } else {
            setShareUrl(null);
        }
    }, []);

    const submitShare = React.useCallback(async () => {
        if (!shareTarget) return;
        const expires =
            shareExpiresInDays && Number(shareExpiresInDays) > 0
                ? new Date(Date.now() + Number(shareExpiresInDays) * 86400_000).toISOString()
                : null;
        const res = await createShare(
            shareTarget.id,
            {
                expires_at: expires,
                download_enabled: shareDownload,
                password: sharePassword || null,
            },
            parentId,
        );
        if ('error' in res) {
            toast({ title: 'Share failed', description: res.error, variant: 'destructive' });
            return;
        }
        const link =
            typeof window !== 'undefined'
                ? `${window.location.origin}${res.url}`
                : res.url;
        setShareUrl(link);
        setNodes((curr) =>
            curr.map((n) =>
                n.id === shareTarget.id
                    ? {
                          ...n,
                          shareToken: res.token,
                          shareExpiresAt: res.expires_at,
                          shareDownloadEnabled: res.download_enabled,
                      }
                    : n,
            ),
        );
        toast({ title: 'Share link ready' });
    }, [shareTarget, shareExpiresInDays, shareDownload, sharePassword, parentId, toast]);

    const submitRevokeShare = React.useCallback(async () => {
        if (!shareTarget) return;
        const res = await revokeShare(shareTarget.id, parentId);
        if ('error' in res) {
            toast({ title: 'Revoke failed', description: res.error, variant: 'destructive' });
            return;
        }
        setShareUrl(null);
        setNodes((curr) =>
            curr.map((n) =>
                n.id === shareTarget.id
                    ? {
                          ...n,
                          shareToken: undefined,
                          shareExpiresAt: undefined,
                          shareDownloadEnabled: undefined,
                      }
                    : n,
            ),
        );
        toast({ title: 'Share link revoked' });
    }, [shareTarget, parentId, toast]);

    // ─── Star, trash, download ─────────────────────────────────────────
    const toggleStarSelected = React.useCallback(
        async (starredValue: boolean) => {
            const ids = Array.from(selected);
            if (ids.length === 0) return;
            const res = await starNodes(ids, starredValue, parentId);
            if ('error' in res) {
                toast({ title: 'Action failed', description: res.error, variant: 'destructive' });
                return;
            }
            setNodes((curr) =>
                curr.map((n) => (ids.includes(n.id) ? { ...n, starred: starredValue } : n)),
            );
        },
        [selected, parentId, toast],
    );

    const trashSelected = React.useCallback(async () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        const res = await trashNodes(ids, parentId);
        if ('error' in res) {
            toast({ title: 'Move-to-trash failed', description: res.error, variant: 'destructive' });
            return;
        }
        setNodes((curr) => curr.filter((n) => !ids.includes(n.id)));
        clearSelection();
        setConfirmDelete(false);
        toast({ title: `${ids.length} item(s) moved to trash` });
    }, [selected, parentId, toast, clearSelection]);

    const downloadOne = React.useCallback(
        async (node: SabfilesNode) => {
            if (node.type !== 'file') return;
            const res = await getDownloadUrl(node.id);
            if ('error' in res) {
                toast({ title: 'Download failed', description: res.error, variant: 'destructive' });
                return;
            }
            window.open(res.url, '_blank', 'noopener,noreferrer');
        },
        [toast],
    );

    const copyDownloadLink = React.useCallback(
        async (node: SabfilesNode) => {
            if (node.type !== 'file') return;
            const res = await getDownloadUrl(node.id);
            if ('error' in res) {
                toast({ title: 'Copy failed', description: res.error, variant: 'destructive' });
                return;
            }
            navigator.clipboard?.writeText(res.url).then(
                () => toast({ title: 'Temporary file URL copied' }),
                () => toast({ title: 'Copy failed', variant: 'destructive' }),
            );
        },
        [toast],
    );

    const onCopyShare = React.useCallback(() => {
        if (!shareUrl) return;
        navigator.clipboard?.writeText(shareUrl).then(
            () => toast({ title: 'Link copied' }),
            () => toast({ title: 'Copy failed', variant: 'destructive' }),
        );
    }, [shareUrl, toast]);

    return (
        <div
            className="relative flex flex-col gap-4"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <Breadcrumb crumbs={initialBreadcrumb} />

            <Toolbar
                view={view}
                onViewChange={setView}
                query={query}
                onQueryChange={setQuery}
                onUploadClick={() => fileInputRef.current?.click()}
                onNewFolder={() => setShowNewFolder(true)}
                selectionCount={selected.size}
                onClearSelection={clearSelection}
                onStarSelected={() => toggleStarSelected(true)}
                onUnstarSelected={() => toggleStarSelected(false)}
                onTrashSelected={() => setConfirmDelete(true)}
            />

            <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                    onFilesPicked(e.target.files);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }}
            />

            {filtered.length === 0 ? (
                <EmptyState
                    onUploadClick={() => fileInputRef.current?.click()}
                    onNewFolderClick={() => setShowNewFolder(true)}
                />
            ) : view === 'grid' ? (
                <GridView
                    nodes={filtered}
                    selected={selected}
                    onToggle={toggleSelect}
                    onOpen={(node) => {
                        if (getSabfilesOpenIntent(node) === 'navigate') {
                            router.push(`/dashboard/sabfiles/folder/${node.id}`);
                        } else {
                            setActionTarget(node);
                        }
                    }}
                    onContext={(n, action) => handleNodeAction(n, action)}
                />
            ) : (
                <ListView
                    nodes={filtered}
                    selected={selected}
                    onToggle={toggleSelect}
                    onOpen={(node) => {
                        if (getSabfilesOpenIntent(node) === 'navigate') {
                            router.push(`/dashboard/sabfiles/folder/${node.id}`);
                        } else {
                            setActionTarget(node);
                        }
                    }}
                    onContext={(n, action) => handleNodeAction(n, action)}
                />
            )}

            <UploadDock
                tasks={uploads}
                onClear={() => setUploads([])}
                onDismiss={(id) => setUploads((u) => u.filter((t) => t.id !== id))}
            />

            {/* New folder dialog */}
            <ZoruDialog open={showNewFolder} onOpenChange={setShowNewFolder}>
                <ZoruDialogContent className="max-w-sm">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>New folder</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Name your folder. Folder names must be unique inside a parent.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruInput
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Untitled folder"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') void submitNewFolder();
                        }}
                    />
                    <ZoruDialogFooter>
                        <ZoruButton variant="ghost" onClick={() => setShowNewFolder(false)}>
                            Cancel
                        </ZoruButton>
                        <ZoruButton onClick={submitNewFolder} disabled={!newFolderName.trim()}>
                            Create
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>

            {/* Rename dialog */}
            <ZoruDialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
                <ZoruDialogContent className="max-w-sm">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Rename</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Choose a new name for "{renameTarget?.name}".
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruInput
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') void submitRename();
                        }}
                    />
                    <ZoruDialogFooter>
                        <ZoruButton variant="ghost" onClick={() => setRenameTarget(null)}>
                            Cancel
                        </ZoruButton>
                        <ZoruButton onClick={submitRename}>Save</ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>

            {/* Share dialog */}
            <ZoruDialog open={!!shareTarget} onOpenChange={(o) => !o && setShareTarget(null)}>
                <ZoruDialogContent className="max-w-md">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Share "{shareTarget?.name}"</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Anyone with the link can view this {shareTarget?.type}.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="flex flex-col gap-3">
                        <div className="grid gap-1.5">
                            <ZoruLabel>Expires in (days)</ZoruLabel>
                            <ZoruInput
                                type="number"
                                min={0}
                                placeholder="Never"
                                value={shareExpiresInDays}
                                onChange={(e) => setShareExpiresInDays(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <ZoruLabel>Password (optional)</ZoruLabel>
                            <ZoruInput
                                type="text"
                                placeholder="Leave blank for no password"
                                value={sharePassword}
                                onChange={(e) => setSharePassword(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line p-3">
                            <span className="text-sm">Allow download</span>
                            <ZoruSwitch checked={shareDownload} onCheckedChange={setShareDownload} />
                        </div>
                        {shareUrl && (
                            <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
                                <ZoruLabel className="text-xs text-zoru-ink-muted">Link</ZoruLabel>
                                <div className="mt-1 flex items-center gap-2">
                                    <ZoruInput value={shareUrl} readOnly className="flex-1" />
                                    <ZoruButton size="sm" onClick={onCopyShare}>
                                        Copy
                                    </ZoruButton>
                                </div>
                            </div>
                        )}
                    </div>
                    <ZoruDialogFooter className="flex justify-between">
                        <ZoruButton
                            variant="ghost"
                            onClick={submitRevokeShare}
                            disabled={!shareTarget?.shareToken}
                        >
                            Revoke
                        </ZoruButton>
                        <div className="flex gap-2">
                            <ZoruButton variant="ghost" onClick={() => setShareTarget(null)}>
                                Close
                            </ZoruButton>
                            <ZoruButton onClick={submitShare}>
                                {shareTarget?.shareToken ? 'Update link' : 'Create link'}
                            </ZoruButton>
                        </div>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>

            {/* File action dialog */}
            <ZoruDialog open={!!actionTarget} onOpenChange={(o) => !o && setActionTarget(null)}>
                <ZoruDialogContent className="max-w-xl">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle className="break-words">{actionTarget?.name}</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Choose what you want to do with this file.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    {actionTarget && (
                        <div className="grid gap-4">
                            <div className="flex items-center gap-3 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface p-3">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--zoru-radius)] bg-zoru-bg">
                                    {actionTarget.url && actionTarget.mime?.startsWith('image/') ? (
                                        <img
                                            src={actionTarget.url}
                                            alt={actionTarget.name}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <span className="[&>svg]:h-7 [&>svg]:w-7">
                                            {fileIconFor(actionTarget)}
                                        </span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium text-zoru-ink">
                                        {actionTarget.name}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <ZoruBadge variant="secondary">
                                            {actionTarget.mime || 'File'}
                                        </ZoruBadge>
                                        <ZoruBadge variant="ghost">{formatSize(actionTarget.size)}</ZoruBadge>
                                        {actionTarget.shareToken && (
                                            <ZoruBadge variant="success">
                                                <Share2 /> Shared
                                            </ZoruBadge>
                                        )}
                                        {actionTarget.starred && (
                                            <ZoruBadge variant="warning">
                                                <Star /> Starred
                                            </ZoruBadge>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <ZoruButton onClick={() => void downloadOne(actionTarget)}>
                                    <ExternalLink /> Open preview
                                </ZoruButton>
                                <ZoruButton variant="outline" onClick={() => void downloadOne(actionTarget)}>
                                    <Download /> Download
                                </ZoruButton>
                                <ZoruButton variant="outline" onClick={() => void copyDownloadLink(actionTarget)}>
                                    <Copy /> Copy temporary URL
                                </ZoruButton>
                                <ZoruButton
                                    variant="outline"
                                    onClick={() => {
                                        setActionTarget(null);
                                        openShareDialog(actionTarget);
                                    }}
                                >
                                    <Share2 /> Share
                                </ZoruButton>
                                <ZoruButton
                                    variant="ghost"
                                    onClick={() => {
                                        setActionTarget(null);
                                        setRenameTarget(actionTarget);
                                        setRenameDraft(actionTarget.name);
                                    }}
                                >
                                    <Pencil /> Rename
                                </ZoruButton>
                                <ZoruButton
                                    variant="ghost"
                                    onClick={() => handleNodeAction(actionTarget, 'star')}
                                >
                                    <Star /> {actionTarget.starred ? 'Unstar' : 'Star'}
                                </ZoruButton>
                            </div>
                            <div className="flex justify-between gap-2 border-t border-zoru-line pt-3">
                                <ZoruButton variant="ghost" onClick={() => setActionTarget(null)}>
                                    Close
                                </ZoruButton>
                                <ZoruButton
                                    variant="destructive"
                                    onClick={() => {
                                        setActionTarget(null);
                                        setSelected(new Set([actionTarget.id]));
                                        setConfirmDelete(true);
                                    }}
                                >
                                    <Trash2 /> Move to trash
                                </ZoruButton>
                            </div>
                        </div>
                    )}
                </ZoruDialogContent>
            </ZoruDialog>

            {/* Confirm trash dialog */}
            <ZoruDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <ZoruDialogContent className="max-w-sm">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Move to trash?</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            {selected.size} item(s) will be moved to the trash. You can
                            restore them within 30 days from the Trash view.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruDialogFooter>
                        <ZoruButton variant="ghost" onClick={() => setConfirmDelete(false)}>
                            Cancel
                        </ZoruButton>
                        <ZoruButton variant="destructive" onClick={trashSelected}>
                            Move to trash
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>

            {/* Drop overlay */}
            {isDragging && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[var(--zoru-radius-lg)] border-2 border-dashed border-zoru-ink/40 bg-zoru-bg/80 backdrop-blur">
                    <div className="flex flex-col items-center gap-2 text-zoru-ink">
                        <Upload className="h-8 w-8" />
                        <span className="text-base font-medium">Drop to upload</span>
                    </div>
                </div>
            )}
        </div>
    );

    function handleNodeAction(node: SabfilesNode, action: 'rename' | 'share' | 'download' | 'trash' | 'star') {
        switch (action) {
            case 'rename':
                setRenameTarget(node);
                setRenameDraft(node.name);
                return;
            case 'share':
                openShareDialog(node);
                return;
            case 'download':
                void downloadOne(node);
                return;
            case 'trash':
                setSelected(new Set([node.id]));
                setConfirmDelete(true);
                return;
            case 'star':
                void starNodes([node.id], !node.starred, parentId).then(() => {
                    const nextStarred = !node.starred;
                    setNodes((curr) =>
                        curr.map((n) => (n.id === node.id ? { ...n, starred: nextStarred } : n)),
                    );
                    setActionTarget((curr) =>
                        curr?.id === node.id ? { ...curr, starred: nextStarred } : curr,
                    );
                });
                return;
        }
    }
}

// ─── Subcomponents ──────────────────────────────────────────────────────

function Breadcrumb({ crumbs }: { crumbs: SabfilesBreadcrumbEntry[] }) {
    return (
        <nav className="flex flex-wrap items-center gap-1 text-sm text-zoru-ink-muted">
            {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                const href = c.id ? `/dashboard/sabfiles/folder/${c.id}` : '/dashboard/sabfiles';
                return (
                    <React.Fragment key={`${c.id ?? 'root'}-${i}`}>
                        {last ? (
                            <span className="font-medium text-zoru-ink">{c.name}</span>
                        ) : (
                            <Link href={href} className="hover:text-zoru-ink hover:underline">
                                {c.name}
                            </Link>
                        )}
                        {!last && <ChevronRight className="h-4 w-4" />}
                    </React.Fragment>
                );
            })}
        </nav>
    );
}

interface ToolbarProps {
    view: View;
    onViewChange: (v: View) => void;
    query: string;
    onQueryChange: (v: string) => void;
    onUploadClick: () => void;
    onNewFolder: () => void;
    selectionCount: number;
    onClearSelection: () => void;
    onStarSelected: () => void;
    onUnstarSelected: () => void;
    onTrashSelected: () => void;
}

function Toolbar({
    view,
    onViewChange,
    query,
    onQueryChange,
    onUploadClick,
    onNewFolder,
    selectionCount,
    onClearSelection,
    onStarSelected,
    onUnstarSelected,
    onTrashSelected,
}: ToolbarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-2">
            <ZoruInput
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                leadingSlot={<Search />}
                placeholder="Filter in this folder…"
                className="max-w-sm"
            />

            {selectionCount > 0 && (
                <div className="flex items-center gap-1 rounded-[var(--zoru-radius)] bg-zoru-surface-2 px-2 py-1 text-xs text-zoru-ink">
                    <span className="font-medium">{selectionCount} selected</span>
                    <ZoruButton size="sm" variant="ghost" onClick={onStarSelected}>
                        <Star /> Star
                    </ZoruButton>
                    <ZoruButton size="sm" variant="ghost" onClick={onUnstarSelected}>
                        <Star /> Unstar
                    </ZoruButton>
                    <ZoruButton size="sm" variant="ghost" onClick={onTrashSelected}>
                        <Trash2 /> Trash
                    </ZoruButton>
                    <ZoruButton variant="ghost" size="icon-sm" onClick={onClearSelection} aria-label="Clear">
                        <X />
                    </ZoruButton>
                </div>
            )}

            <div className="ml-auto flex items-center gap-2">
                <div className="inline-flex rounded-[var(--zoru-radius)] border border-zoru-line p-0.5">
                    <button
                        type="button"
                        aria-label="Grid"
                        aria-pressed={view === 'grid'}
                        onClick={() => onViewChange('grid')}
                        className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] text-zoru-ink-muted hover:text-zoru-ink',
                            view === 'grid' && 'bg-zoru-surface-2 text-zoru-ink',
                        )}
                    >
                        <FileImage className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        aria-label="List"
                        aria-pressed={view === 'list'}
                        onClick={() => onViewChange('list')}
                        className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] text-zoru-ink-muted hover:text-zoru-ink',
                            view === 'list' && 'bg-zoru-surface-2 text-zoru-ink',
                        )}
                    >
                        <FileText className="h-4 w-4" />
                    </button>
                </div>
                <ZoruButton variant="outline" onClick={onNewFolder}>
                    <FolderPlus /> New folder
                </ZoruButton>
                <ZoruButton onClick={onUploadClick}>
                    <Upload /> Upload
                </ZoruButton>
            </div>
        </div>
    );
}

function NodeMenu({
    node,
    onAction,
}: {
    node: SabfilesNode;
    onAction: (n: SabfilesNode, a: 'rename' | 'share' | 'download' | 'trash' | 'star') => void;
}) {
    return (
        <ZoruDropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
                <ZoruButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Actions"
                    onClick={(e) => e.stopPropagation()}
                >
                    <MoreVertical />
                </ZoruButton>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end" className="w-44">
                <ZoruDropdownMenuItem onSelect={() => onAction(node, 'rename')}>
                    <Pencil /> Rename
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem onSelect={() => onAction(node, 'share')}>
                    <Share2 /> Share
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem onSelect={() => onAction(node, 'star')}>
                    <Star /> {node.starred ? 'Unstar' : 'Star'}
                </ZoruDropdownMenuItem>
                {node.type === 'file' && (
                    <ZoruDropdownMenuItem onSelect={() => onAction(node, 'download')}>
                        <Download /> Download
                    </ZoruDropdownMenuItem>
                )}
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuItem destructive onSelect={() => onAction(node, 'trash')}>
                    <Trash2 /> Move to trash
                </ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
        </ZoruDropdownMenu>
    );
}

interface ViewProps {
    nodes: SabfilesNode[];
    selected: Set<string>;
    onToggle: (id: string, additive: boolean) => void;
    onOpen: (node: SabfilesNode) => void;
    onContext: (
        node: SabfilesNode,
        action: 'rename' | 'share' | 'download' | 'trash' | 'star',
    ) => void;
}

function GridView({ nodes, selected, onToggle, onOpen, onContext }: ViewProps) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {nodes.map((n) => {
                const isSelected = selected.has(n.id);
                return (
                    <ZoruCard
                        key={n.id}
                        className={cn(
                            'group relative flex cursor-pointer flex-col items-center gap-2 p-3 transition-colors hover:border-zoru-ink/30',
                            isSelected && 'border-zoru-ink/60 bg-zoru-surface',
                        )}
                        onClick={(e) => {
                            if (e.shiftKey || e.metaKey || e.ctrlKey) {
                                onToggle(n.id, true);
                            } else {
                                onOpen(n);
                            }
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            onToggle(n.id, true);
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggle(n.id, true)}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute left-2 top-2 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 data-[state=checked]:opacity-100"
                        />
                        <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <NodeMenu node={n} onAction={onContext} />
                        </div>
                        {n.starred && (
                            <Star className="absolute left-2 top-2 h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        )}
                        <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-[var(--zoru-radius)] bg-zoru-surface">
                            {n.type === 'file' && n.url && n.mime?.startsWith('image/') ? (
                                <img
                                    src={n.url}
                                    alt={n.name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                />
                            ) : (
                                <span className="[&>svg]:h-8 [&>svg]:w-8">{fileIconFor(n)}</span>
                            )}
                        </div>
                        <div className="w-full text-center">
                            <div className="truncate text-sm font-medium text-zoru-ink">{n.name}</div>
                            <div className="text-[11px] text-zoru-ink-muted">
                                {n.type === 'folder' ? 'Folder' : formatSize(n.size)}
                            </div>
                        </div>
                    </ZoruCard>
                );
            })}
        </div>
    );
}

function ListView({ nodes, selected, onToggle, onOpen, onContext }: ViewProps) {
    return (
        <ul className="divide-y divide-zoru-line rounded-[var(--zoru-radius-lg)] border border-zoru-line">
            {nodes.map((n) => {
                const isSelected = selected.has(n.id);
                return (
                    <li
                        key={n.id}
                        className={cn(
                            'flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-zoru-surface',
                            isSelected && 'bg-zoru-surface-2',
                        )}
                        onClick={(e) => {
                            if (e.shiftKey || e.metaKey || e.ctrlKey) onToggle(n.id, true);
                            else onOpen(n);
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggle(n.id, true)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4"
                        />
                        <span className="flex h-6 w-6 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
                            {fileIconFor(n)}
                        </span>
                        <span className="flex-1 truncate text-sm text-zoru-ink">{n.name}</span>
                        {n.starred && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                        {n.shareToken && <Share2 className="h-3.5 w-3.5 text-emerald-500" />}
                        <span className="hidden w-24 text-right text-xs text-zoru-ink-muted sm:inline">
                            {n.type === 'folder' ? '—' : formatSize(n.size)}
                        </span>
                        <span className="hidden w-32 text-right text-xs text-zoru-ink-muted md:inline">
                            {formatDate(n.updatedAt)}
                        </span>
                        <NodeMenu node={n} onAction={onContext} />
                    </li>
                );
            })}
        </ul>
    );
}

function EmptyState({
    onUploadClick,
    onNewFolderClick,
}: {
    onUploadClick: () => void;
    onNewFolderClick: () => void;
}) {
    return (
        <ZoruCard className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Folder className="h-12 w-12 text-zoru-ink-muted" />
            <div>
                <div className="text-base font-medium text-zoru-ink">This folder is empty</div>
                <div className="text-sm text-zoru-ink-muted">
                    Drop files anywhere on this page, or upload to get started.
                </div>
            </div>
            <div className="flex gap-2">
                <ZoruButton variant="outline" onClick={onNewFolderClick}>
                    <FolderPlus /> New folder
                </ZoruButton>
                <ZoruButton onClick={onUploadClick}>
                    <Upload /> Upload files
                </ZoruButton>
            </div>
        </ZoruCard>
    );
}

function UploadDock({
    tasks,
    onClear,
    onDismiss,
}: {
    tasks: UploadTask[];
    onClear: () => void;
    onDismiss: (id: string) => void;
}) {
    if (tasks.length === 0) return null;
    const inFlight = tasks.filter((t) => t.status === 'uploading' || t.status === 'queued').length;
    return (
        <div className="fixed bottom-24 right-6 z-40 w-[360px] max-w-[calc(100vw-3rem)]">
            <ZoruCard className="border-zoru-ink/20 shadow-[var(--zoru-shadow-lg)]">
                <ZoruCardContent className="p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-zoru-ink">
                            Uploads ({tasks.length})
                            {inFlight > 0 && (
                                <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-zoru-ink-muted" />
                            )}
                        </span>
                        <ZoruButton variant="ghost" size="sm" onClick={onClear}>
                            Clear
                        </ZoruButton>
                    </div>
                    <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                        {tasks.map((t) => (
                            <li key={t.id} className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="truncate">{t.file.name}</span>
                                    <button
                                        type="button"
                                        aria-label="Dismiss"
                                        className="text-zoru-ink-muted hover:text-zoru-ink"
                                        onClick={() => onDismiss(t.id)}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                                {t.status === 'error' ? (
                                    <span className="text-[11px] text-red-500">{t.error}</span>
                                ) : (
                                    <ZoruProgress value={t.progress} className="h-1" />
                                )}
                            </li>
                        ))}
                    </ul>
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
