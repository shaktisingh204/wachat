'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2, Upload, FolderPlus, Folder, X } from 'lucide-react';

import { 
    Card, 
    ZoruCardContent, 
    Button, 
    Progress, 
    useZoruToast, 
    cn, 
    Input, 
    Dialog, 
    ZoruDialogContent, 
    ZoruDialogHeader, 
    ZoruDialogTitle, 
    ZoruDialogDescription, 
    ZoruDialogFooter 
} from '@/components/zoruui';
import { ZoruFilesPage, type ZoruFileEntity } from '@/components/zoruui/files-module';

import {
    confirmUpload,
    createFolder,
    createShare,
    getDownloadUrl,
    presignUpload,
    renameNode,
    starNodes,
    trashNodes,
} from '@/app/actions/sabfiles.actions';
import type { SabfilesBreadcrumbEntry, SabfilesNode } from '@/lib/rust-client/sabfiles';

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

function Breadcrumb({ crumbs }: { crumbs: SabfilesBreadcrumbEntry[] }) {
    return (
        <nav className="flex flex-wrap items-center gap-1 text-sm text-[var(--st-text-secondary)]">
            {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                const href = c.id ? `/dashboard/sabfiles/folder/${c.id}` : '/dashboard/sabfiles';
                return (
                    <React.Fragment key={`${c.id ?? 'root'}-${i}`}>
                        {last ? (
                            <span className="font-medium text-[var(--st-text)]">{c.name}</span>
                        ) : (
                            <Link href={href} className="hover:text-[var(--st-text)] hover:underline">
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
            <Card className="border-[var(--st-text)]/20 shadow-[var(--zoru-shadow-lg)]">
                <ZoruCardContent className="p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--st-text)]">
                            Uploads ({tasks.length})
                            {inFlight > 0 && (
                                <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-[var(--st-text-secondary)]" />
                            )}
                        </span>
                        <Button variant="ghost" size="sm" onClick={onClear}>
                            Clear
                        </Button>
                    </div>
                    <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                        {tasks.map((t) => (
                            <li key={t.id} className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="truncate">{t.file.name}</span>
                                    <button
                                        type="button"
                                        aria-label="Dismiss"
                                        className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                                        onClick={() => onDismiss(t.id)}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                                {t.status === 'error' ? (
                                    <span className="text-[11px] text-[var(--st-text)]">{t.error}</span>
                                ) : (
                                    <Progress value={t.progress} className="h-1" />
                                )}
                            </li>
                        ))}
                    </ul>
                </ZoruCardContent>
            </Card>
        </div>
    );
}

export function FileManager({
    parentId,
    initialNodes,
    initialBreadcrumb,
}: FileManagerProps) {
    const router = useRouter();
    const { toast } = useZoruToast();

    const [nodes, setNodes] = React.useState<SabfilesNode[]>(initialNodes);
    const [uploads, setUploads] = React.useState<UploadTask[]>([]);
    
    // New folder dialog state
    const [showNewFolder, setShowNewFolder] = React.useState(false);
    const [newFolderName, setNewFolderName] = React.useState('');

    // Mapping SabfilesNode to ZoruFileEntity
    const zoruFiles: ZoruFileEntity[] = React.useMemo(() => {
        return nodes.map((n) => ({
            id: n.id,
            name: n.name,
            mime: n.type === 'folder' ? undefined : n.mime || undefined,
            isFolder: n.type === 'folder',
            size: n.type === 'folder' ? undefined : n.size || undefined,
            modified: n.updatedAt ? new Date(n.updatedAt) : undefined,
            url: n.url || undefined,
            thumbnailUrl: n.type === 'file' && n.mime?.startsWith('image/') ? n.url : undefined,
            starred: n.starred,
            shareToken: n.shareToken || undefined,
        }));
    }, [nodes]);

    // R2 Upload logic
    const startUpload = React.useCallback(
        async (file: File): Promise<void> => {
            const taskId = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            setUploads((u) => [
                ...u,
                { id: taskId, file, progress: 0, status: 'queued' },
            ]);

            const presign = await presignUpload({
                name: file.name,
                size: file.size,
                mime: file.type || undefined,
                parent_id: parentId,
            });
            if ('error' in presign) {
                setUploads((u) =>
                    u.map((t) => (t.id === taskId ? { ...t, status: 'error', error: presign.error } : t)),
                );
                toast({ title: 'Upload failed', description: presign.error, variant: 'destructive' });
                return;
            }

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
                        u.map((t) => (t.id === taskId ? { ...t, status: 'uploading', progress: pct } : t)),
                    );
                });
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve(true);
                    else {
                        setUploads((u) =>
                            u.map((t) => (t.id === taskId ? { ...t, status: 'error', error: `Storage returned ${xhr.status}` } : t)),
                        );
                        resolve(false);
                    }
                });
                xhr.addEventListener('error', () => {
                    setUploads((u) =>
                        u.map((t) => (t.id === taskId ? { ...t, status: 'error', error: 'Network error' } : t)),
                    );
                    resolve(false);
                });
                xhr.send(file);
            });

            if (!putOk) return;

            const res = await confirmUpload({
                key: presign.key,
                name: file.name,
                size: file.size,
                mime: file.type || undefined,
                parent_id: parentId,
            });
            if ('error' in res) {
                setUploads((u) =>
                    u.map((t) => (t.id === taskId ? { ...t, status: 'error', error: res.error } : t)),
                );
                toast({ title: 'Upload failed', description: res.error, variant: 'destructive' });
                return;
            }
            setUploads((u) => u.map((t) => (t.id === taskId ? { ...t, status: 'done', progress: 100 } : t)));
            setNodes((curr) => [res.node, ...curr]);
        },
        [parentId, toast],
    );

    // Callbacks for ZoruFilesPage
    const handleUpload = React.useCallback(
        (files: File[]) => {
            for (const f of files) void startUpload(f);
        },
        [startUpload]
    );

    const handleNewFolderSubmit = React.useCallback(async () => {
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

    const handleRename = React.useCallback(async (file: ZoruFileEntity, newName: string) => {
        const res = await renameNode(file.id, newName, parentId);
        if ('error' in res) {
            toast({ title: 'Rename failed', description: res.error, variant: 'destructive' });
            return;
        }
        setNodes((curr) => curr.map((n) => (n.id === file.id ? res.node : n)));
    }, [parentId, toast]);

    const handleDelete = React.useCallback(async (files: ZoruFileEntity[]) => {
        const ids = files.map(f => f.id);
        const res = await trashNodes(ids, parentId);
        if ('error' in res) {
            toast({ title: 'Move-to-trash failed', description: res.error, variant: 'destructive' });
            return;
        }
        setNodes((curr) => curr.filter((n) => !ids.includes(n.id)));
        toast({ title: `${ids.length} item(s) moved to trash` });
    }, [parentId, toast]);

    const handleStar = React.useCallback(async (file: ZoruFileEntity, star: boolean) => {
        const res = await starNodes([file.id], star, parentId);
        if ('error' in res) {
            toast({ title: 'Action failed', description: res.error, variant: 'destructive' });
            return;
        }
        setNodes((curr) => curr.map((n) => (n.id === file.id ? { ...n, starred: star } : n)));
    }, [parentId, toast]);

    const handleDownload = React.useCallback(async (file: ZoruFileEntity) => {
        const res = await getDownloadUrl(file.id);
        if ('error' in res) {
            toast({ title: 'Download failed', description: res.error, variant: 'destructive' });
            return;
        }
        window.open(res.url, '_blank', 'noopener,noreferrer');
    }, [toast]);

    const handleShareInvite = React.useCallback(
        // We reuse this as a trigger to create a public link in sabfiles context
        // since ZoruFileShareDialog handles public link vs invites. 
        // For sabfiles, we just call createShare.
        async (file: ZoruFileEntity, email: string, access: "viewer" | "editor") => {
            // Placeholder: implement real sharing if needed. Sabfiles currently uses generic createShare.
            toast({ title: 'Invite sent (placeholder)', description: `To ${email}` });
        },
        [toast]
    );

    const handleCopyShareLink = React.useCallback(
        (url: string) => {
            navigator.clipboard?.writeText(url).then(
                () => toast({ title: 'Link copied' }),
                () => toast({ title: 'Copy failed', variant: 'destructive' })
            );
        },
        [toast]
    );

    const handleNavigateFolder = React.useCallback(
        (file: ZoruFileEntity) => {
            router.push(`/dashboard/sabfiles/folder/${file.id}`);
        },
        [router]
    );

    const shareUrlFor = React.useCallback((file: ZoruFileEntity) => {
        if (!file.shareToken) return undefined;
        return typeof window !== 'undefined'
            ? `${window.location.origin}/share/${file.shareToken}`
            : `/share/${file.shareToken}`;
    }, []);

    const [isDragging, setIsDragging] = React.useState(false);
    
    // Drag & Drop overlay logic
    const onDragOver = React.useCallback((e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setIsDragging(true);
        }
    }, []);
    const onDragLeave = React.useCallback((e: React.DragEvent) => {
        if (e.currentTarget === e.target) setIsDragging(false);
    }, []);
    const onDrop = React.useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) {
                handleUpload(Array.from(e.dataTransfer.files));
            }
        },
        [handleUpload]
    );

    return (
        <div
            className="relative flex flex-col gap-4"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <Breadcrumb crumbs={initialBreadcrumb} />

            <ZoruFilesPage
                files={zoruFiles}
                onUpload={handleUpload}
                onNewFolder={() => setShowNewFolder(true)}
                onRename={handleRename}
                onDelete={handleDelete}
                onStar={handleStar}
                onDownload={handleDownload}
                onShareInvite={handleShareInvite}
                onCopyShareLink={handleCopyShareLink}
                onNavigateFolder={handleNavigateFolder}
                shareUrlFor={shareUrlFor}
                empty={
                    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center bg-transparent border-0 shadow-none">
                        <Folder className="h-12 w-12 text-[var(--st-text-secondary)]" />
                        <div>
                            <div className="text-base font-medium text-[var(--st-text)]">This folder is empty</div>
                            <div className="text-sm text-[var(--st-text-secondary)]">
                                Drop files anywhere on this page, or upload to get started.
                            </div>
                        </div>
                    </Card>
                }
            />

            <UploadDock
                tasks={uploads}
                onClear={() => setUploads([])}
                onDismiss={(id) => setUploads((u) => u.filter((t) => t.id !== id))}
            />

            <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
                <ZoruDialogContent className="max-w-sm">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>New folder</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Name your folder. Folder names must be unique inside a parent.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <Input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Untitled folder"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleNewFolderSubmit();
                        }}
                    />
                    <ZoruDialogFooter>
                        <Button variant="ghost" onClick={() => setShowNewFolder(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleNewFolderSubmit} disabled={!newFolderName.trim()}>
                            Create
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {isDragging && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[var(--zoru-radius-lg)] border-2 border-dashed border-[var(--st-text)]/40 bg-[var(--st-bg)]/80 backdrop-blur">
                    <div className="flex flex-col items-center gap-2 text-[var(--st-text)]">
                        <Upload className="h-8 w-8" />
                        <span className="text-base font-medium">Drop to upload</span>
                    </div>
                </div>
            )}
        </div>
    );
}
