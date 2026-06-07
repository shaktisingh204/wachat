'use client';

import {
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    EmptyState,
    Field,
    Input,
    Progress,
    SegmentedControl,
    cn,
    useToast,
} from '@/components/sabcrm/20ui';
import {
    AlertCircle,
    Check,
    File as FileIcon,
    FileImage,
    FileText,
    FileVideo,
    FileAudio,
    Loader2,
    RefreshCw,
    Search,
    Upload,
    X,
    } from 'lucide-react';

/**
 * SabFilePicker - the project-wide single source for picking a file.
 * Replaces every ad-hoc `<input type="file">` and every "media URL"
 * text field across the app.
 *
 * **No external URLs.** SabNode policy is that every file lives in
 * SabFiles. The picker has exactly two modes - Library (existing
 * SabFiles) and Upload (new). External URL paste is intentionally
 * absent; users cannot point at random hosts.
 *
 * The picker calls back with a `SabFilePick` object describing the
 * selected file. Callers can render `<SabFilePicker>` controlled (with
 * `open` + `onOpenChange`) or use the helper trigger
 * `<SabFilePickerButton>` below.
 */

import * as React from 'react';
import { usePathname } from 'next/navigation';

import {
    confirmUpload,
    getLibrary,
    presignUpload,
} from '@/app/actions/sabfiles.actions';
import { getCrmStorageDefaults } from '@/app/actions/crm/module-connections.actions';
import type {
    SabfilesCategory,
    SabfilesNode,
} from '@/lib/rust-client/sabfiles';

export type SabFileAccept = SabfilesCategory | 'all';

export interface SabFilePick {
    /** SabFiles node id (always present - every file lives in SabFiles). */
    id: string;
    /** Stable URL the caller should use as the value. */
    url: string;
    /** Display name. */
    name: string;
    /** MIME type if known. */
    mime?: string;
    /** Size in bytes if known. */
    size?: number;
}

export interface SabFilePickerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (pick: SabFilePick) => void;
    /** Restrict the library + upload tabs to a single category. */
    accept?: SabFileAccept;
    /** Allow uploading new files. Defaults to `true`. */
    allowUpload?: boolean;
    /** Cap upload size per file (bytes). Defaults to 200 MB. */
    maxSize?: number;
    /** Optional title override. */
    title?: string;
    /**
     * Override the SabFiles parent folder for uploads. When omitted and
     * the picker is rendered under `/dashboard/crm/*`, the CRM to Storage
     * binding (configured at `/dashboard/crm/settings/integrations/storage`)
     * is auto-applied as the upload destination. Pass `null` to force
     * the root regardless of binding.
     */
    defaultParentId?: string | null;
}

type Mode = 'library' | 'upload';

const CATEGORY_TABS: { id: SabfilesCategory; label: string; mime?: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'image', label: 'Images', mime: 'image/*' },
    { id: 'video', label: 'Videos', mime: 'video/*' },
    { id: 'audio', label: 'Audio', mime: 'audio/*' },
    { id: 'document', label: 'Documents' },
    { id: 'other', label: 'Other' },
];

function categoryAccept(c: SabfilesCategory): string | undefined {
    if (c === 'image') return 'image/*';
    if (c === 'video') return 'video/*';
    if (c === 'audio') return 'audio/*';
    if (c === 'document') return '.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.rtf';
    return undefined;
}

function iconFor(mime?: string): React.ReactElement {
    if (mime?.startsWith('image/')) return <FileImage className="text-[var(--st-text)]" aria-hidden="true" />;
    if (mime?.startsWith('video/')) return <FileVideo className="text-[var(--st-text)]" aria-hidden="true" />;
    if (mime?.startsWith('audio/')) return <FileAudio className="text-[var(--st-text)]" aria-hidden="true" />;
    if (mime?.includes('pdf') || mime?.includes('text')) return <FileText className="text-[var(--st-text)]" aria-hidden="true" />;
    return <FileIcon className="text-[var(--st-text-secondary)]" aria-hidden="true" />;
}

function fmtSize(bytes?: number): string {
    if (bytes == null) return '';
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

interface UploadTask {
    id: string;
    name: string;
    progress: number;
    status: 'queued' | 'uploading' | 'done' | 'error';
    error?: string;
    node?: SabfilesNode;
}

export function SabFilePicker({
    open,
    onOpenChange,
    onPick,
    accept = 'all',
    allowUpload = true,
    maxSize = 200 * 1024 * 1024,
    title = 'Pick a file',
    defaultParentId,
}: SabFilePickerProps) {
    const pathname = usePathname();
    // Auto-resolve the CRM storage binding when the picker opens on a
    // CRM route and the caller hasn't already pinned a parent. The
    // binding is set via the wizard at
    // `/dashboard/crm/settings/integrations/storage`.
    const [resolvedParentId, setResolvedParentId] = React.useState<
        string | null
    >(defaultParentId ?? null);
    React.useEffect(() => {
        if (defaultParentId !== undefined) {
            setResolvedParentId(defaultParentId);
            return;
        }
        if (!open) return;
        const onCrmRoute = (pathname ?? '').startsWith('/dashboard/crm');
        if (!onCrmRoute) {
            setResolvedParentId(null);
            return;
        }
        let cancelled = false;
        void getCrmStorageDefaults().then((b) => {
            if (cancelled) return;
            setResolvedParentId(b?.rootFolderId ?? null);
        });
        return () => {
            cancelled = true;
        };
    }, [defaultParentId, open, pathname]);
    const [mode, setMode] = React.useState<Mode>('library');
    const [category, setCategory] = React.useState<SabfilesCategory>(
        accept === 'all' ? 'all' : (accept as SabfilesCategory),
    );
    const [query, setQuery] = React.useState('');
    const [debouncedQuery, setDebouncedQuery] = React.useState('');
    const [items, setItems] = React.useState<SabfilesNode[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [libraryError, setLibraryError] = React.useState<string | null>(null);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [tasks, setTasks] = React.useState<UploadTask[]>([]);
    // Bumping this counter triggers a library refetch - used by the
    // refresh button and immediately after an upload confirms so files
    // dropped here AND files added in another tab both appear.
    const [refreshTick, setRefreshTick] = React.useState(0);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    // Keep toast in a ref so the library effect doesn't re-fire on every
    // render just because the hook returned a new function reference.
    const toastRef = React.useRef(toast);
    React.useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    // Reset internal state each time the dialog re-opens.
    React.useEffect(() => {
        if (!open) return;
        setMode('library');
        setCategory(accept === 'all' ? 'all' : (accept as SabfilesCategory));
        setQuery('');
        setDebouncedQuery('');
        setSelectedId(null);
        setTasks([]);
        setLibraryError(null);
        // Force a refetch so files uploaded elsewhere (e.g. the main
        // SabFiles dashboard) show up on every re-open.
        setRefreshTick((n) => n + 1);
    }, [open, accept]);

    // Debounce query then fetch.
    React.useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(query), 250);
        return () => clearTimeout(id);
    }, [query]);

    React.useEffect(() => {
        if (!open || mode !== 'library') return;
        let cancelled = false;
        setLoading(true);
        setLibraryError(null);
        void getLibrary({
            category: category === 'all' ? undefined : category,
            query: debouncedQuery || undefined,
            limit: 200,
        }).then((res) => {
            if (cancelled) return;
            setLoading(false);
            if ('error' in res && res.error) {
                const msg = String(res.error);
                setLibraryError(msg);
                toastRef.current({
                    title: 'Library failed to load',
                    description: msg,
                    tone: 'danger',
                });
                setItems([]);
            } else {
                setItems(res.nodes);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [open, mode, category, debouncedQuery, refreshTick]);

    const restrictAccept = accept !== 'all';
    const acceptAttr = restrictAccept
        ? categoryAccept(accept as SabfilesCategory)
        : undefined;

    const onUploadFiles = React.useCallback(
        (list: FileList | null) => {
            if (!list || list.length === 0) return;
            for (const f of Array.from(list)) {
                if (f.size > maxSize) {
                    toast({
                        title: 'File too large',
                        description: `${f.name} exceeds ${fmtSize(maxSize)}.`,
                        tone: 'danger',
                    });
                    continue;
                }
                void runUpload(f);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [maxSize, toast],
    );

    const runUpload = React.useCallback(
        async (file: File) => {
            const taskId = `${file.name}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`;
            setTasks((t) => [
                ...t,
                { id: taskId, name: file.name, progress: 0, status: 'queued' },
            ]);

            const failTask = (err: string) => {
                setTasks((t) =>
                    t.map((x) => (x.id === taskId ? { ...x, status: 'error', error: err } : x)),
                );
                toastRef.current({
                    title: 'Upload failed',
                    description: `${file.name}: ${err}`,
                    tone: 'danger',
                });
            };

            const presign = await presignUpload({
                name: file.name,
                size: file.size,
                mime: file.type || undefined,
                parent_id: resolvedParentId,
            });
            if ('error' in presign) {
                failTask(presign.error);
                return;
            }

            const ok = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
                const xhr = new XMLHttpRequest();
                xhr.open(presign.method, presign.upload_url);
                for (const [k, v] of Object.entries(presign.headers || {})) {
                    xhr.setRequestHeader(k, v);
                }
                xhr.upload.addEventListener('progress', (e) => {
                    if (!e.lengthComputable) return;
                    const pct = Math.round((e.loaded / e.total) * 100);
                    setTasks((t) =>
                        t.map((x) =>
                            x.id === taskId ? { ...x, status: 'uploading', progress: pct } : x,
                        ),
                    );
                });
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve({ ok: true });
                    } else {
                        resolve({ ok: false, error: `Storage returned ${xhr.status}` });
                    }
                });
                xhr.addEventListener('error', () => resolve({ ok: false, error: 'Network error' }));
                xhr.addEventListener('abort', () => resolve({ ok: false, error: 'Upload cancelled' }));
                xhr.send(file);
            });

            if (!ok.ok) {
                failTask(ok.error ?? 'Upload failed');
                return;
            }

            const confirmed = await confirmUpload({
                key: presign.key,
                name: file.name,
                size: file.size,
                mime: file.type || undefined,
                parent_id: resolvedParentId,
            });
            if ('error' in confirmed) {
                failTask(confirmed.error);
                return;
            }
            setTasks((t) =>
                t.map((x) =>
                    x.id === taskId
                        ? {
                              ...x,
                              status: 'done',
                              progress: 100,
                              node: confirmed.node,
                          }
                        : x,
                ),
            );
            // Auto-select the freshly uploaded file so a single click
            // ("Use this file") finishes the flow.
            setSelectedId(confirmed.node.id);
            // Also feed it into the library list so it appears with its
            // siblings if the user toggles back.
            setItems((curr) => [confirmed.node, ...curr]);
            // And refetch in the background so the server-side ordering
            // matches what the user sees.
            setRefreshTick((n) => n + 1);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [resolvedParentId],
    );

    const onConfirmPick = React.useCallback(() => {
        if (!selectedId) return;
        const node =
            tasks.find((t) => t.node?.id === selectedId)?.node ??
            items.find((n) => n.id === selectedId);
        if (!node) return;
        const url =
            node.url ??
            // Fallback when no R2_PUBLIC_URL is configured: caller can later
            // request a presigned GET via getDownloadUrl, but for embedding in
            // tags (img src, etc.) we need a stable URL. Use the SabFiles
            // download endpoint as a last resort.
            `/api/sabfiles/raw/${node.id}`;
        onPick({
            id: node.id,
            url,
            name: node.name,
            mime: node.mime,
            size: node.size,
        });
        onOpenChange(false);
    }, [selectedId, tasks, items, onPick, onOpenChange]);

    const visibleTabs = restrictAccept
        ? CATEGORY_TABS.filter((t) => t.id === 'all' || t.id === accept)
        : CATEGORY_TABS;

    const inFlight = tasks.filter(
        (t) => t.status === 'queued' || t.status === 'uploading',
    ).length;

    const doneCount = tasks.filter((t) => t.status === 'done').length;

    const modeItems: { value: Mode; label: React.ReactNode; icon: typeof FileImage }[] = [
        { value: 'library', label: 'Library', icon: FileImage },
    ];
    if (allowUpload) {
        modeItems.push({
            value: 'upload',
            icon: Upload,
            label: (
                <span className="inline-flex items-center gap-1.5">
                    Upload
                    {inFlight > 0 && (
                        <Badge tone="accent" kind="solid">
                            {inFlight}
                        </Badge>
                    )}
                </span>
            ),
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* The picker is frequently opened from INSIDE another modal (e.g. the
                SabCRM create dialog at z-index 1000). A file picker must always
                sit on top of whatever invoked it, so we raise its content +
                backdrop above app-level modal overlays. */}
            <DialogContent
                className="z-[1300] flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0"
                overlayClassName="z-[1290]"
            >
                <div className="flex flex-col gap-3 border-b border-[var(--st-border)] p-5">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>
                            Pick a file from your SabFiles library or upload a new one.
                        </DialogDescription>
                    </DialogHeader>

                    <SegmentedControl<Mode>
                        items={modeItems}
                        value={mode}
                        onChange={setMode}
                        aria-label="Pick source"
                        className="w-fit"
                    />
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-5">
                    {mode === 'library' && (
                        <>
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    <Field label="Search files">
                                        <Input
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            iconLeft={Search}
                                            placeholder="Search your files..."
                                        />
                                    </Field>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="md"
                                    aria-label="Refresh library"
                                    disabled={loading}
                                    iconLeft={RefreshCw}
                                    className={cn(loading && '[&_svg]:animate-spin')}
                                    onClick={() => setRefreshTick((n) => n + 1)}
                                />
                            </div>

                            <SegmentedControl<SabfilesCategory>
                                items={visibleTabs.map((t) => ({ value: t.id, label: t.label }))}
                                value={category}
                                onChange={setCategory}
                                size="sm"
                                aria-label="Filter by category"
                                className="w-fit"
                            />

                            <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40">
                                {loading ? (
                                    <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-[var(--st-text-secondary)]">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Loading
                                        your library...
                                    </div>
                                ) : libraryError ? (
                                    <div className="flex h-full min-h-[320px] items-center justify-center">
                                        <EmptyState
                                            icon={AlertCircle}
                                            tone="danger"
                                            title="Could not load your library"
                                            description={libraryError}
                                            action={
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    iconLeft={RefreshCw}
                                                    onClick={() => setRefreshTick((n) => n + 1)}
                                                >
                                                    Try again
                                                </Button>
                                            }
                                        />
                                    </div>
                                ) : items.length === 0 ? (
                                    <div className="flex h-full min-h-[320px] items-center justify-center">
                                        <EmptyState
                                            icon={FileImage}
                                            title={debouncedQuery ? 'No matches' : 'Nothing here yet'}
                                            description={
                                                debouncedQuery
                                                    ? `No files matched "${debouncedQuery}". Try clearing the search or switching category.`
                                                    : 'Upload a file to add it to your SabFiles library.'
                                            }
                                            action={
                                                allowUpload && !debouncedQuery ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        iconLeft={Upload}
                                                        onClick={() => setMode('upload')}
                                                    >
                                                        Upload now
                                                    </Button>
                                                ) : undefined
                                            }
                                        />
                                    </div>
                                ) : (
                                    <ul className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                        {items.map((n) => {
                                            const selected = selectedId === n.id;
                                            return (
                                                <li key={n.id}>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        aria-pressed={selected}
                                                        aria-label={`Select ${n.name}`}
                                                        className={cn(
                                                            'group !h-auto !w-full !items-stretch !justify-start gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] !p-2 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--st-text)]/40 hover:shadow-md [&_.u-btn__label]:flex [&_.u-btn__label]:w-full [&_.u-btn__label]:flex-col [&_.u-btn__label]:gap-1.5',
                                                            selected &&
                                                                'border-[var(--st-text)] ring-2 ring-[var(--st-text)]/30',
                                                        )}
                                                        onClick={() => setSelectedId(n.id)}
                                                        onDoubleClick={() => {
                                                            setSelectedId(n.id);
                                                            setTimeout(onConfirmPick, 0);
                                                        }}
                                                    >
                                                        <span className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)]">
                                                            {n.mime?.startsWith('image/') &&
                                                            n.url ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                    src={n.url}
                                                                    alt={n.name}
                                                                    className="h-full w-full object-cover"
                                                                    loading="lazy"
                                                                />
                                                            ) : (
                                                                <span className="[&>svg]:h-8 [&>svg]:w-8">
                                                                    {iconFor(n.mime)}
                                                                </span>
                                                            )}
                                                            {selected && (
                                                                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--st-text)] text-[var(--st-text-inverted)] shadow">
                                                                    <Check className="h-3 w-3" aria-hidden="true" />
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="truncate text-xs font-medium text-[var(--st-text)]">
                                                            {n.name}
                                                        </span>
                                                        <span className="text-[10px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                                                            {fmtSize(n.size)}
                                                        </span>
                                                    </Button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </>
                    )}

                    {mode === 'upload' && (
                        <div className="flex min-h-0 flex-1 flex-col gap-3">
                            <div
                                role="button"
                                tabIndex={0}
                                aria-label="Choose or drop files to upload"
                                onClick={() => fileInputRef.current?.click()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        fileInputRef.current?.click();
                                    }
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    onUploadFiles(e.dataTransfer.files);
                                }}
                                className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--st-radius-lg)] border-2 border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 p-6 text-center transition-colors hover:border-[var(--st-text)]/40 hover:bg-[var(--st-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg)] text-[var(--st-text-secondary)] shadow-sm">
                                    <Upload className="h-5 w-5" aria-hidden="true" />
                                </div>
                                <div className="text-sm font-medium text-[var(--st-text)]">
                                    Click or drag files here
                                </div>
                                <div className="text-xs text-[var(--st-text-secondary)]">
                                    Files upload directly to your SabFiles library.
                                    {acceptAttr && <> Accepts {acceptAttr}.</>} Max{' '}
                                    {fmtSize(maxSize)} per file.
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                hidden
                                accept={acceptAttr}
                                onChange={(e) => {
                                    onUploadFiles(e.target.files);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                            />
                            {tasks.length > 0 && (
                                <div className="flex min-h-0 flex-1 flex-col rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]">
                                    <div className="flex items-center justify-between border-b border-[var(--st-border)] px-3 py-2">
                                        <span className="text-xs font-semibold text-[var(--st-text)]">
                                            Uploads
                                            <span className="ml-1 text-[var(--st-text-secondary)]">
                                                ({doneCount}/{tasks.length})
                                            </span>
                                            {inFlight > 0 && (
                                                <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-[var(--st-text-secondary)]" aria-hidden="true" />
                                            )}
                                        </span>
                                        {doneCount > 0 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setMode('library')}
                                            >
                                                View in library
                                            </Button>
                                        )}
                                    </div>
                                    <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto p-3">
                                        {tasks.map((t) => (
                                            <li
                                                key={t.id}
                                                className="flex flex-col gap-1 rounded-[var(--st-radius-sm)] border border-[var(--st-border)]/60 bg-[var(--st-bg-secondary)]/40 p-2"
                                            >
                                                <div className="flex items-center justify-between gap-2 text-xs">
                                                    <span className="truncate font-medium text-[var(--st-text)]">
                                                        {t.name}
                                                    </span>
                                                    {t.status === 'done' && t.node && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            iconLeft={selectedId === t.node.id ? Check : undefined}
                                                            onClick={() =>
                                                                setSelectedId(t.node!.id)
                                                            }
                                                        >
                                                            {selectedId === t.node.id
                                                                ? 'Selected'
                                                                : 'Select'}
                                                        </Button>
                                                    )}
                                                    {t.status === 'error' && (
                                                        <Badge tone="danger">Failed</Badge>
                                                    )}
                                                    {(t.status === 'uploading' ||
                                                        t.status === 'queued') && (
                                                        <span className="text-[11px] text-[var(--st-text-secondary)]">
                                                            {t.progress}%
                                                        </span>
                                                    )}
                                                </div>
                                                {t.status === 'error' ? (
                                                    <span className="text-[11px] text-[var(--st-danger)]">
                                                        {t.error}
                                                    </span>
                                                ) : (
                                                    <Progress
                                                        value={t.progress}
                                                        size="sm"
                                                    />
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 px-5 py-3">
                    <div className="mr-auto flex items-center text-xs text-[var(--st-text-secondary)]">
                        {selectedId
                            ? `1 file selected`
                            : mode === 'library'
                              ? items.length > 0
                                  ? 'Click a file to select it'
                                  : ''
                              : 'Upload to continue'}
                    </div>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={onConfirmPick} disabled={!selectedId}>
                        Use this file
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ----------------------------------------------------------------------
// Controlled "file chip" input: holds a SabFiles URL as its value, but
// the UI only shows the picked file's name + Browse + Clear. Free-text
// URL paste is intentionally disabled - every file MUST come from
// SabFiles (library or upload). The component still exposes `name=`
// and `value=` so existing forms that POST a `*Url` field via FormData
// keep working transparently.
//
// Backwards compatibility: kept the `SabFileUrlInput` export name (and
// its `value` / `onChange(value)` shape) so the 16+ migrated call sites
// don't need updates. The legacy `placeholder` and `allowFreeText`
// props are accepted but ignored.
// ----------------------------------------------------------------------
export interface SabFileUrlInputProps {
    value: string;
    onChange: (value: string, pick?: SabFilePick) => void;
    accept?: SabFileAccept;
    /** Hint shown when no file is picked. */
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    /** @deprecated Free-text URL paste is no longer allowed. Ignored. */
    allowFreeText?: boolean;
    /** Title for the picker dialog. */
    pickerTitle?: string;
    /** No-op (kept for backwards compatibility with migrated call sites). */
    id?: string;
    /** Renders a hidden input with this name + value for FormData submission. */
    name?: string;
}

/**
 * Derive a friendly file name from a SabFiles URL when the picker
 * hasn't told us the actual name yet (e.g. value loaded from saved
 * state on first render).
 */
function nameFromUrl(url: string): string {
    if (!url) return '';
    try {
        const path = new URL(url, 'http://x').pathname;
        const last = path.split('/').filter(Boolean).pop() ?? '';
        // R2 keys we mint look like `users/<id>/files/<yyyy>/<mm>/<rand>-<safe>`,
        // so strip the leading random hex prefix when present.
        const decoded = decodeURIComponent(last);
        const stripRandHex = decoded.replace(/^[0-9a-f]{16,}-/i, '');
        return stripRandHex || decoded || url;
    } catch {
        return url;
    }
}

export function SabFileUrlInput({
    value,
    onChange,
    accept = 'all',
    placeholder = 'No file chosen',
    className,
    disabled,
    pickerTitle,
    name,
}: SabFileUrlInputProps) {
    const [open, setOpen] = React.useState(false);
    // Latest pick name (preferred over deriving from URL).
    const [lastName, setLastName] = React.useState<string | null>(null);
    const [lastMime, setLastMime] = React.useState<string | undefined>(undefined);

    // Reset cached display fields when the value is cleared from outside.
    React.useEffect(() => {
        if (!value) {
            setLastName(null);
            setLastMime(undefined);
        }
    }, [value]);

    const displayName = lastName ?? (value ? nameFromUrl(value) : '');

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <div
                className={cn(
                    'flex h-9 flex-1 items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 text-sm',
                    disabled && 'opacity-60',
                )}
            >
                {value ? (
                    <>
                        {lastMime?.startsWith('image/') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={value}
                                alt=""
                                className="h-5 w-5 rounded object-cover"
                            />
                        ) : (
                            <FileIcon className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                        )}
                        <span className="truncate text-[var(--st-text)]">{displayName}</span>
                    </>
                ) : (
                    <span className="text-[var(--st-text-secondary)]">{placeholder}</span>
                )}
            </div>
            {/* Hidden field so existing FormData-based submissions still work. */}
            {name && <input type="hidden" name={name} value={value} />}
            <Button
                type="button"
                variant="outline"
                disabled={disabled}
                iconLeft={Upload}
                onClick={() => setOpen(true)}
            >
                {value ? 'Change' : 'Choose file'}
            </Button>
            {value && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Clear"
                    iconLeft={X}
                    disabled={disabled}
                    onClick={() => {
                        setLastName(null);
                        setLastMime(undefined);
                        onChange('');
                    }}
                />
            )}
            <SabFilePicker
                open={open}
                onOpenChange={setOpen}
                accept={accept}
                title={pickerTitle}
                onPick={(p) => {
                    setLastName(p.name);
                    setLastMime(p.mime);
                    onChange(p.url, p);
                }}
            />
        </div>
    );
}

// ----------------------------------------------------------------------
// Bridge utility: download a picked SabFile back into a `File` object.
//
// Used by Meta-pipeline forms (template headers, broadcast media,
// WhatsApp profile picture, chat-message attachments, etc.) whose
// existing handlers expect a `File` to feed into Meta's resumable
// upload. The user picks from SabFiles, the browser pulls the bytes
// from R2 (or the `/api/sabfiles/raw/:id` proxy), and the form gets
// the same `File` shape it would have got from a `<input type="file">`.
// ----------------------------------------------------------------------
export async function fetchSabFilePickAsFile(pick: SabFilePick): Promise<File> {
    const res = await fetch(pick.url, { credentials: 'include' });
    if (!res.ok) {
        throw new Error(`Failed to fetch SabFile (${res.status})`);
    }
    const blob = await res.blob();
    return new File([blob], pick.name, {
        type: pick.mime || blob.type || 'application/octet-stream',
    });
}

export interface SabFileToFileButtonProps
    extends Omit<SabFilePickerProps, 'open' | 'onOpenChange' | 'onPick'> {
    /** Called with the picked file as a `File` object once it's been fetched. */
    onPickFile: (file: File, pick: SabFilePick) => void | Promise<void>;
    onError?: (err: Error) => void;
    children?: React.ReactNode;
    className?: string;
    variant?: 'default' | 'outline' | 'ghost' | 'destructive';
}

/**
 * Variant of `SabFilePickerButton` for legacy `File`-based handlers.
 * The button opens the SabFiles picker, then transparently downloads
 * the picked object and hands the resulting `File` to `onPickFile`.
 *
 * Use this in chat composers, template forms, and anywhere else whose
 * existing pipeline expects a `File`. It augments rather than replaces
 * the existing `<input type="file">`.
 */
export function SabFileToFileButton({
    onPickFile,
    onError,
    children,
    className,
    variant = 'outline',
    ...rest
}: SabFileToFileButtonProps) {
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    return (
        <>
            <Button
                type="button"
                variant={variant}
                className={className}
                loading={busy}
                disabled={busy}
                onClick={() => setOpen(true)}
            >
                {children ?? 'Pick from SabFiles'}
            </Button>
            <SabFilePicker
                {...rest}
                open={open}
                onOpenChange={setOpen}
                onPick={async (p) => {
                    setBusy(true);
                    try {
                        const file = await fetchSabFilePickAsFile(p);
                        await onPickFile(file, p);
                    } catch (e) {
                        if (onError) onError(e as Error);
                        else if (typeof window !== 'undefined') {
                            // Fallback so silent failures don't go unnoticed.
                            console.error('SabFileToFileButton fetch failed', e);
                        }
                    } finally {
                        setBusy(false);
                    }
                }}
            />
        </>
    );
}

// ----------------------------------------------------------------------
// Convenience: a button that opens the picker. For non-input call sites
// (e.g. "attach a file" buttons in chat composers).
// ----------------------------------------------------------------------
export interface SabFilePickerButtonProps
    extends Omit<SabFilePickerProps, 'open' | 'onOpenChange'> {
    children?: React.ReactNode;
    className?: string;
    variant?: 'default' | 'outline' | 'ghost' | 'destructive';
}

export function SabFilePickerButton({
    children,
    className,
    variant = 'outline',
    onPick,
    ...rest
}: SabFilePickerButtonProps) {
    const [open, setOpen] = React.useState(false);
    return (
        <>
            <Button
                type="button"
                variant={variant}
                className={className}
                iconLeft={children ? undefined : Upload}
                onClick={() => setOpen(true)}
            >
                {children ?? 'Choose file'}
            </Button>
            <SabFilePicker
                {...rest}
                open={open}
                onOpenChange={setOpen}
                onPick={(p) => {
                    onPick(p);
                    setOpen(false);
                }}
            />
        </>
    );
}
