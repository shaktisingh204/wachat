'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Download,
    File as FileIcon,
    Folder,
    FolderOpen,
    FolderPlus,
    HardDrive,
    LayoutGrid,
    Link2,
    List as ListIcon,
    MoreHorizontal,
    Pencil,
    Plus,
    Share2,
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
    Field,
    IconButton,
    Input,
    Menu,
    MenuItem,
    MenuSeparator,
    PageActions,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Progress,
    SegmentedControl,
    StatCard,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
    useToast,
} from '@/components/sabcrm/20ui';

import {
    SabFolderCard,
    SabFileTable,
    SabFileGridCard,
    SabFileDetailsPanel,
    SabUploadDropzone,
    SabSectionHeading,
    SabFilePeopleShareDialog,
    useNodeMembers,
    formatBytes,
    type SabFileView,
    type SabFolderRollupMap,
} from '@/components/sabfiles/views';

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
    initialRollups?: SabFolderRollupMap;
}

function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = React.useState(false);
    React.useEffect(() => {
        const m = window.matchMedia(query);
        const handler = () => setMatches(m.matches);
        handler();
        m.addEventListener('change', handler);
        return () => m.removeEventListener('change', handler);
    }, [query]);
    return matches;
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

export function FileManager({
    parentId,
    initialNodes,
    initialBreadcrumb,
    initialRollups,
}: FileManagerProps) {
    const { toast } = useToast();
    const router = useRouter();
    const isWide = useMediaQuery('(min-width: 1280px)');

    const [nodes, setNodes] = React.useState<SabfilesNode[]>(initialNodes);
    const [uploads, setUploads] = React.useState<UploadTask[]>([]);
    const [view, setView] = React.useState<SabFileView>('list');
    const [selectedId, setSelectedId] = React.useState<string | null>(null);

    const [showNewFolder, setShowNewFolder] = React.useState(false);
    const [newFolderName, setNewFolderName] = React.useState('');

    const [renameTarget, setRenameTarget] = React.useState<SabfilesNode | null>(null);
    const [renameValue, setRenameValue] = React.useState('');

    const [shareTarget, setShareTarget] = React.useState<SabfilesNode | null>(null);
    const [shareOpen, setShareOpen] = React.useState(false);

    const headerUploadRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => setNodes(initialNodes), [initialNodes]);

    const folders = React.useMemo(() => nodes.filter((n) => n.type === 'folder'), [nodes]);
    const files = React.useMemo(() => nodes.filter((n) => n.type !== 'folder'), [nodes]);
    const membersByNode = useNodeMembers(files);
    const selectedNode = React.useMemo(
        () => files.find((n) => n.id === selectedId) ?? null,
        [files, selectedId],
    );

    // ── Upload (presign → PUT → confirm), preserved from the prior browser ──
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
        (list: File[]) => {
            for (const f of list) void startUpload(f);
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
            if (selectedId === node.id) setSelectedId(null);
            toast.success('1 item moved to trash');
        },
        [parentId, toast, selectedId],
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

    const openShare = React.useCallback((node: SabfilesNode) => {
        setShareTarget(node);
        setShareOpen(true);
    }, []);

    // Drag-and-drop overlay.
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
            if (e.dataTransfer.files) handleUpload(Array.from(e.dataTransfer.files));
        },
        [handleUpload],
    );

    // KPIs for the compact stat strip (this folder only).
    const folderCount = folders.length;
    const fileCount = files.length;
    const sharedCount = nodes.filter((n) => n.shareToken || (n.members?.length ?? 0) > 0).length;
    const sizeInView = files.reduce((sum, n) => sum + (n.size ?? 0), 0);

    const here = initialBreadcrumb[initialBreadcrumb.length - 1];
    const isRoot = !here?.id;
    const title = isRoot ? 'My files' : here?.name || 'Folder';
    const pathLabel = initialBreadcrumb.map((c) => c.name).join(' / ');

    const currentFolderNode: SabfilesNode | null =
        !isRoot && here?.id
            ? {
                  _id: here.id,
                  id: here.id,
                  userId: '',
                  parentId: null,
                  type: 'folder',
                  name: here.name,
                  createdAt: '',
                  updatedAt: '',
              }
            : null;

    // Per-node actions menu, shared by folder cards, file cards and the table.
    const nodeMenu = React.useCallback(
        (node: SabfilesNode): React.ReactNode => (
            <Menu
                align="end"
                label={`Actions for ${node.name}`}
                trigger={
                    <IconButton label={`Actions for ${node.name}`} icon={MoreHorizontal} variant="ghost" size="sm" />
                }
            >
                <MenuItem icon={Pencil} onSelect={() => openRename(node)}>
                    Rename
                </MenuItem>
                <MenuItem icon={Star} onSelect={() => void handleStar(node)}>
                    {node.starred ? 'Remove star' : 'Add star'}
                </MenuItem>
                {node.type === 'file' ? (
                    <MenuItem icon={Download} onSelect={() => void handleDownload(node)}>
                        Download
                    </MenuItem>
                ) : null}
                <MenuItem icon={Share2} onSelect={() => openShare(node)}>
                    Share
                </MenuItem>
                {node.shareToken ? (
                    <MenuItem icon={Link2} onSelect={() => handleCopyLink(node)}>
                        Copy link
                    </MenuItem>
                ) : null}
                <MenuSeparator />
                <MenuItem icon={Trash2} danger onSelect={() => void handleDelete(node)}>
                    Move to trash
                </MenuItem>
            </Menu>
        ),
        [openRename, handleStar, handleDownload, openShare, handleCopyLink, handleDelete],
    );

    const viewToggle = (
        <SegmentedControl<SabFileView>
            items={[
                { value: 'list', label: 'List', icon: ListIcon },
                { value: 'grid', label: 'Grid', icon: LayoutGrid },
            ]}
            value={view}
            onChange={setView}
            size="sm"
            aria-label="File view mode"
        />
    );

    return (
        <div
            className="relative flex flex-col gap-[var(--st-space-5)]"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabFiles</PageEyebrow>
                    <PageTitle>{title}</PageTitle>
                    <PageDescription>
                        Upload, organise and share your files. Drag files anywhere on this page to upload.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Menu
                        align="end"
                        label="Create new"
                        trigger={
                            <Button variant="primary" iconLeft={Plus}>
                                Create New
                            </Button>
                        }
                    >
                        <MenuItem icon={FolderPlus} onSelect={() => setShowNewFolder(true)}>
                            New folder
                        </MenuItem>
                        <MenuItem icon={Upload} onSelect={() => headerUploadRef.current?.click()}>
                            Upload file
                        </MenuItem>
                    </Menu>
                    {currentFolderNode ? (
                        <Button variant="secondary" iconLeft={Share2} onClick={() => openShare(currentFolderNode)}>
                            Share
                        </Button>
                    ) : null}
                </PageActions>
            </PageHeader>

            <input
                ref={headerUploadRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                    if (e.target.files?.length) handleUpload(Array.from(e.target.files));
                    if (headerUploadRef.current) headerUploadRef.current.value = '';
                }}
            />

            <div className="grid grid-cols-2 gap-[var(--st-space-3)] md:grid-cols-4">
                <StatCard label="Files" value={fileCount} icon={FileIcon} />
                <StatCard label="Folders" value={folderCount} icon={Folder} />
                <StatCard label="Size in view" value={formatBytes(sizeInView)} icon={HardDrive} />
                <StatCard label="Shared" value={sharedCount} icon={Share2} />
            </div>

            <FilesBreadcrumb crumbs={initialBreadcrumb} />

            {nodes.length === 0 ? (
                <Card variant="ghost" padding="lg">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-6 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
                            <FolderOpen size={24} aria-hidden="true" />
                        </span>
                        <div>
                            <div className="text-base font-semibold text-[var(--st-text)]">This folder is empty</div>
                            <p className="text-sm text-[var(--st-text-secondary)]">
                                Drop files here or use Create New to add your first file.
                            </p>
                        </div>
                        <SabUploadDropzone onFiles={handleUpload} className="w-full" />
                    </div>
                </Card>
            ) : (
                <div className="flex items-start gap-[var(--st-space-5)]">
                    <div className="flex min-w-0 flex-1 flex-col gap-[var(--st-space-5)]">
                        {folders.length > 0 ? (
                            <section className="flex flex-col gap-3">
                                <SabSectionHeading title="Folders" count={folders.length} />
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                                    {folders.map((node) => (
                                        <SabFolderCard
                                            key={node.id}
                                            node={node}
                                            rollup={initialRollups?.[node.id]}
                                            onOpen={() => router.push(`/dashboard/sabfiles/folder/${node.id}`)}
                                            menu={nodeMenu(node)}
                                        />
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        <section className="flex flex-col gap-3">
                            <SabSectionHeading title="Files" count={files.length} action={viewToggle} />
                            {files.length === 0 ? (
                                <Card variant="ghost" padding="lg">
                                    <p className="py-4 text-center text-sm text-[var(--st-text-secondary)]">
                                        No files in this folder yet.
                                    </p>
                                </Card>
                            ) : view === 'grid' ? (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                                    {files.map((node) => (
                                        <SabFileGridCard
                                            key={node.id}
                                            node={node}
                                            members={membersByNode[node.id]}
                                            selected={selectedId === node.id}
                                            onOpen={() => setSelectedId(node.id)}
                                            menu={nodeMenu(node)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <Card padding="none">
                                    <SabFileTable
                                        nodes={files}
                                        membersByNode={membersByNode}
                                        selectedId={selectedId}
                                        onOpen={(node) => setSelectedId(node.id)}
                                        renderActions={(node) => nodeMenu(node)}
                                    />
                                </Card>
                            )}
                        </section>
                    </div>

                    {isWide ? (
                        <SabFileDetailsPanel
                            node={selectedNode}
                            members={selectedNode ? membersByNode[selectedNode.id] : undefined}
                            pathLabel={pathLabel}
                            mode="rail"
                            open={!!selectedNode}
                            onClose={() => setSelectedId(null)}
                            onDownload={handleDownload}
                            onShare={openShare}
                            onRename={openRename}
                            onTrash={handleDelete}
                        />
                    ) : null}
                </div>
            )}

            {!isWide ? (
                <SabFileDetailsPanel
                    node={selectedNode}
                    members={selectedNode ? membersByNode[selectedNode.id] : undefined}
                    pathLabel={pathLabel}
                    mode="sheet"
                    open={!!selectedNode}
                    onClose={() => setSelectedId(null)}
                    onDownload={handleDownload}
                    onShare={openShare}
                    onRename={openRename}
                    onTrash={handleDelete}
                />
            ) : null}

            <UploadDock
                tasks={uploads}
                onClear={() => setUploads([])}
                onDismiss={(id) => setUploads((u) => u.filter((t) => t.id !== id))}
            />

            <SabFilePeopleShareDialog
                node={shareTarget}
                open={shareOpen}
                onOpenChange={setShareOpen}
                parentId={parentId}
                onChanged={() => router.refresh()}
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
