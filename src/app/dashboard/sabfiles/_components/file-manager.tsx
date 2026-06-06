'use client';

import * as React from 'react';
import Link from 'next/link';
import {
    Download,
    File as FileIcon,
    FileText,
    FolderPlus,
    Folder,
    Image as ImageIcon,
    Link2,
    MoreHorizontal,
    Pencil,
    Star,
    Trash2,
    Upload,
    X,
} from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardBody,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    EmptyState,
    Field,
    IconButton,
    Input,
    Menu,
    MenuItem,
    MenuSeparator,
    Progress,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
    useToast,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';

import {
    confirmUpload,
    createFolder,
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

function formatBytes(bytes?: number): string {
    if (bytes == null || Number.isNaN(bytes)) return '-';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / 1024 ** i;
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(value?: string): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function nodeIcon(node: SabfilesNode) {
    if (node.type === 'folder') return Folder;
    if (node.mime?.startsWith('image/')) return ImageIcon;
    if (node.mime?.startsWith('text/') || node.mime === 'application/pdf') return FileText;
    return FileIcon;
}

function FilesBreadcrumb({ crumbs }: { crumbs: SabfilesBreadcrumbEntry[] }) {
    return (
        <nav aria-label="Folder path" className="text-sm">
            <BreadcrumbList>
                {crumbs.map((c, i) => {
                    const last = i === crumbs.length - 1;
                    const href = c.id ? `/dashboard/sabfiles/folder/${c.id}` : '/dashboard/sabfiles';
                    return (
                        <React.Fragment key={`${c.id ?? 'root'}-${i}`}>
                            <BreadcrumbItem>
                                {last ? (
                                    <BreadcrumbPage>{c.name}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink asChild>
                                        <Link href={href}>{c.name}</Link>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!last ? <BreadcrumbSeparator /> : null}
                        </React.Fragment>
                    );
                })}
            </BreadcrumbList>
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
            <Card variant="elevated" padding="none">
                <CardBody className="p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
                            Uploads ({tasks.length})
                            {inFlight > 0 ? (
                                <Badge tone="info" kind="soft">
                                    {inFlight} active
                                </Badge>
                            ) : null}
                        </span>
                        <Button variant="ghost" size="sm" onClick={onClear}>
                            Clear
                        </Button>
                    </div>
                    <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                        {tasks.map((t) => (
                            <li key={t.id} className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="truncate text-[var(--st-text)]">{t.file.name}</span>
                                    <IconButton
                                        label="Dismiss upload"
                                        icon={X}
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => onDismiss(t.id)}
                                    />
                                </div>
                                {t.status === 'error' ? (
                                    <span className="text-[11px] text-[var(--st-danger)]">{t.error}</span>
                                ) : (
                                    <Progress
                                        value={t.progress}
                                        size="sm"
                                        tone={t.status === 'done' ? 'success' : 'accent'}
                                        aria-label={`Upload progress for ${t.file.name}`}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                </CardBody>
            </Card>
        </div>
    );
}

function FileRow({
    node,
    onRename,
    onStar,
    onDownload,
    onCopyLink,
    onDelete,
}: {
    node: SabfilesNode;
    onRename: () => void;
    onStar: () => void;
    onDownload: () => void;
    onCopyLink: () => void;
    onDelete: () => void;
}) {
    const Icon = nodeIcon(node);
    const isFolder = node.type === 'folder';
    return (
        <Tr>
            <Td>
                <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
                        <Icon size={18} aria-hidden="true" />
                    </span>
                    {isFolder ? (
                        <Link
                            href={`/dashboard/sabfiles/folder/${node.id}`}
                            className="truncate text-left font-medium text-[var(--st-text)] hover:underline"
                        >
                            {node.name}
                        </Link>
                    ) : (
                        <span className="truncate font-medium text-[var(--st-text)]">{node.name}</span>
                    )}
                    {node.starred ? (
                        <Badge tone="warning" kind="soft" dot>
                            Starred
                        </Badge>
                    ) : null}
                    {node.shareToken ? (
                        <Badge tone="info" kind="soft">
                            Shared
                        </Badge>
                    ) : null}
                </div>
            </Td>
            <Td align="right" className="text-[var(--st-text-secondary)]">
                {isFolder ? '-' : formatBytes(node.size)}
            </Td>
            <Td align="right" className="text-[var(--st-text-secondary)]">
                {formatDate(node.updatedAt)}
            </Td>
            <Td align="right">
                <Menu
                    align="end"
                    label={`Actions for ${node.name}`}
                    trigger={
                        <IconButton label={`Actions for ${node.name}`} icon={MoreHorizontal} variant="ghost" size="sm" />
                    }
                >
                    <MenuItem icon={Pencil} onSelect={onRename}>
                        Rename
                    </MenuItem>
                    <MenuItem icon={Star} onSelect={onStar}>
                        {node.starred ? 'Remove star' : 'Add star'}
                    </MenuItem>
                    {!isFolder ? (
                        <MenuItem icon={Download} onSelect={onDownload}>
                            Download
                        </MenuItem>
                    ) : null}
                    {node.shareToken ? (
                        <MenuItem icon={Link2} onSelect={onCopyLink}>
                            Copy share link
                        </MenuItem>
                    ) : null}
                    <MenuSeparator />
                    <MenuItem icon={Trash2} danger onSelect={onDelete}>
                        Move to trash
                    </MenuItem>
                </Menu>
            </Td>
        </Tr>
    );
}

export function FileManager({
    parentId,
    initialNodes,
    initialBreadcrumb,
}: FileManagerProps) {
    const { toast } = useToast();

    const [nodes, setNodes] = React.useState<SabfilesNode[]>(initialNodes);
    const [uploads, setUploads] = React.useState<UploadTask[]>([]);

    // New folder dialog state.
    const [showNewFolder, setShowNewFolder] = React.useState(false);
    const [newFolderName, setNewFolderName] = React.useState('');

    // Inline rename dialog state.
    const [renameTarget, setRenameTarget] = React.useState<SabfilesNode | null>(null);
    const [renameValue, setRenameValue] = React.useState('');

    // R2 upload logic - drives the SabFiles backend via presigned PUT.
    const startUpload = React.useCallback(
        async (file: File): Promise<void> => {
            const taskId = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            setUploads((u) => [...u, { id: taskId, file, progress: 0, status: 'queued' }]);

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
                toast.error({ title: 'Upload failed', description: presign.error });
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
                            u.map((t) =>
                                t.id === taskId
                                    ? { ...t, status: 'error', error: `Storage returned ${xhr.status}` }
                                    : t,
                            ),
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
                toast.error({ title: 'Upload failed', description: res.error });
                return;
            }
            setUploads((u) => u.map((t) => (t.id === taskId ? { ...t, status: 'done', progress: 100 } : t)));
            setNodes((curr) => [res.node, ...curr]);
        },
        [parentId, toast],
    );

    const handleUpload = React.useCallback(
        (files: File[]) => {
            for (const f of files) void startUpload(f);
        },
        [startUpload],
    );

    const handleNewFolderSubmit = React.useCallback(async () => {
        const name = newFolderName.trim();
        if (!name) return;
        const res = await createFolder(parentId, name);
        if ('error' in res) {
            toast.error({ title: 'Could not create folder', description: res.error });
            return;
        }
        setNodes((curr) => [res.node, ...curr]);
        setShowNewFolder(false);
        setNewFolderName('');
        toast.success({ title: 'Folder created', description: name });
    }, [newFolderName, parentId, toast]);

    const openRename = React.useCallback((node: SabfilesNode) => {
        setRenameTarget(node);
        setRenameValue(node.name);
    }, []);

    const handleRenameSubmit = React.useCallback(async () => {
        if (!renameTarget) return;
        const name = renameValue.trim();
        if (!name || name === renameTarget.name) {
            setRenameTarget(null);
            return;
        }
        const res = await renameNode(renameTarget.id, name, parentId);
        if ('error' in res) {
            toast.error({ title: 'Rename failed', description: res.error });
            return;
        }
        setNodes((curr) => curr.map((n) => (n.id === renameTarget.id ? res.node : n)));
        setRenameTarget(null);
        toast.success('Renamed');
    }, [renameTarget, renameValue, parentId, toast]);

    const handleDelete = React.useCallback(
        async (node: SabfilesNode) => {
            const res = await trashNodes([node.id], parentId);
            if ('error' in res) {
                toast.error({ title: 'Move-to-trash failed', description: res.error });
                return;
            }
            setNodes((curr) => curr.filter((n) => n.id !== node.id));
            toast.success('1 item moved to trash');
        },
        [parentId, toast],
    );

    const handleStar = React.useCallback(
        async (node: SabfilesNode) => {
            const next = !node.starred;
            const res = await starNodes([node.id], next, parentId);
            if ('error' in res) {
                toast.error({ title: 'Action failed', description: res.error });
                return;
            }
            setNodes((curr) => curr.map((n) => (n.id === node.id ? { ...n, starred: next } : n)));
        },
        [parentId, toast],
    );

    const handleDownload = React.useCallback(
        async (node: SabfilesNode) => {
            const res = await getDownloadUrl(node.id);
            if ('error' in res) {
                toast.error({ title: 'Download failed', description: res.error });
                return;
            }
            window.open(res.url, '_blank', 'noopener,noreferrer');
        },
        [toast],
    );

    const handleCopyLink = React.useCallback(
        (node: SabfilesNode) => {
            if (!node.shareToken) return;
            const url =
                typeof window !== 'undefined'
                    ? `${window.location.origin}/share/${node.shareToken}`
                    : `/share/${node.shareToken}`;
            navigator.clipboard?.writeText(url).then(
                () => toast.success('Link copied'),
                () => toast.error('Copy failed'),
            );
        },
        [toast],
    );

    // Drag-and-drop overlay logic.
    const [isDragging, setIsDragging] = React.useState(false);
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
        [handleUpload],
    );

    return (
        <div
            className="relative flex flex-col gap-4"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <FilesBreadcrumb crumbs={initialBreadcrumb} />
                <div className="flex items-center gap-2">
                    <Button variant="secondary" iconLeft={FolderPlus} onClick={() => setShowNewFolder(true)}>
                        New folder
                    </Button>
                    <SabFileToFileButton variant="default" onPickFile={(file) => startUpload(file)}>
                        <span className="inline-flex items-center gap-2">
                            <Upload size={14} aria-hidden="true" />
                            Upload
                        </span>
                    </SabFileToFileButton>
                </div>
            </div>

            {nodes.length === 0 ? (
                <Card variant="ghost" padding="lg">
                    <EmptyState
                        icon={Folder}
                        title="This folder is empty"
                        description="Drop files anywhere on this page, or use Upload to add your first file."
                    />
                </Card>
            ) : (
                <Card padding="none">
                    <Table hover>
                        <THead>
                            <Tr>
                                <Th>Name</Th>
                                <Th align="right" width={120}>
                                    Size
                                </Th>
                                <Th align="right" width={140}>
                                    Modified
                                </Th>
                                <Th align="right" width={64}>
                                    <span className="sr-only">Actions</span>
                                </Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {nodes.map((node) => (
                                <FileRow
                                    key={node.id}
                                    node={node}
                                    onRename={() => openRename(node)}
                                    onStar={() => void handleStar(node)}
                                    onDownload={() => void handleDownload(node)}
                                    onCopyLink={() => handleCopyLink(node)}
                                    onDelete={() => void handleDelete(node)}
                                />
                            ))}
                        </TBody>
                    </Table>
                </Card>
            )}

            <UploadDock
                tasks={uploads}
                onClear={() => setUploads([])}
                onDismiss={(id) => setUploads((u) => u.filter((t) => t.id !== id))}
            />

            <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>New folder</DialogTitle>
                        <DialogDescription>
                            Name your folder. Folder names must be unique inside a parent.
                        </DialogDescription>
                    </DialogHeader>
                    <Field label="Folder name">
                        <Input
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Untitled folder"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') void handleNewFolderSubmit();
                            }}
                        />
                    </Field>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowNewFolder(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleNewFolderSubmit} disabled={!newFolderName.trim()}>
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={renameTarget != null} onOpenChange={(open) => !open && setRenameTarget(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Rename</DialogTitle>
                        <DialogDescription>Give this item a new name.</DialogDescription>
                    </DialogHeader>
                    <Field label="Name">
                        <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            placeholder="New name"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') void handleRenameSubmit();
                            }}
                        />
                    </Field>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRenameTarget(null)}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleRenameSubmit} disabled={!renameValue.trim()}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {isDragging ? (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[var(--st-radius-lg)] border-2 border-dashed border-[var(--st-accent)] bg-[var(--st-bg)]/80 backdrop-blur">
                    <div className="flex flex-col items-center gap-2 text-[var(--st-text)]">
                        <Upload className="h-8 w-8" aria-hidden="true" />
                        <span className="text-base font-medium">Drop to upload</span>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
