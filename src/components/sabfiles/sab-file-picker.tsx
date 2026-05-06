'use client';

/**
 * SabFilePicker — the project-wide single source for picking a file.
 * Replaces every ad-hoc `<input type="file">` and every "media URL"
 * text field across the app.
 *
 * **No external URLs.** SabNode policy is that every file lives in
 * SabFiles. The picker has exactly two modes — Library (existing
 * SabFiles) and Upload (new). External URL paste is intentionally
 * absent; users cannot point at random hosts.
 *
 * The picker calls back with a `SabFilePick` object describing the
 * selected file. Callers can render `<SabFilePicker>` controlled (with
 * `open` + `onOpenChange`) or use the helper trigger
 * `<SabFilePickerButton>` below.
 */

import * as React from 'react';
import {
    Check,
    File as FileIcon,
    FileImage,
    FileText,
    FileVideo,
    FileAudio,
    Loader2,
    Search,
    Upload,
    X,
} from 'lucide-react';

import {
    ZoruButton,
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruInput,
    ZoruLabel,
    ZoruProgress,
    cn,
    useZoruToast,
} from '@/components/zoruui';
import {
    confirmUpload,
    getLibrary,
    presignUpload,
} from '@/app/actions/sabfiles.actions';
import type {
    SabfilesCategory,
    SabfilesNode,
} from '@/lib/rust-client/sabfiles';

export type SabFileAccept = SabfilesCategory | 'all';

export interface SabFilePick {
    /** SabFiles node id (always present — every file lives in SabFiles). */
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
    if (mime?.startsWith('image/')) return <FileImage className="text-violet-500" />;
    if (mime?.startsWith('video/')) return <FileVideo className="text-rose-500" />;
    if (mime?.startsWith('audio/')) return <FileAudio className="text-emerald-500" />;
    if (mime?.includes('pdf') || mime?.includes('text')) return <FileText className="text-sky-500" />;
    return <FileIcon className="text-zoru-ink-muted" />;
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
}: SabFilePickerProps) {
    const [mode, setMode] = React.useState<Mode>('library');
    const [category, setCategory] = React.useState<SabfilesCategory>(
        accept === 'all' ? 'all' : (accept as SabfilesCategory),
    );
    const [query, setQuery] = React.useState('');
    const [debouncedQuery, setDebouncedQuery] = React.useState('');
    const [items, setItems] = React.useState<SabfilesNode[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [tasks, setTasks] = React.useState<UploadTask[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const { toast } = useZoruToast();

    // Reset internal state each time the dialog re-opens.
    React.useEffect(() => {
        if (!open) return;
        setMode('library');
        setCategory(accept === 'all' ? 'all' : (accept as SabfilesCategory));
        setQuery('');
        setDebouncedQuery('');
        setSelectedId(null);
        setTasks([]);
    }, [open, accept]);

    // Debounce query → fetch.
    React.useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(query), 250);
        return () => clearTimeout(id);
    }, [query]);

    React.useEffect(() => {
        if (!open || mode !== 'library') return;
        let cancelled = false;
        setLoading(true);
        void getLibrary({
            category: category === 'all' ? undefined : category,
            query: debouncedQuery || undefined,
            limit: 200,
        }).then((res) => {
            if (cancelled) return;
            setLoading(false);
            if ('error' in res && res.error) {
                toast({
                    title: 'Library failed',
                    description: String(res.error),
                    variant: 'destructive',
                });
                setItems([]);
            } else {
                setItems(res.nodes);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [open, mode, category, debouncedQuery, toast]);

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
                        variant: 'destructive',
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

            const presign = await presignUpload({
                name: file.name,
                size: file.size,
                mime: file.type || undefined,
                parent_id: null,
            });
            if ('error' in presign) {
                setTasks((t) =>
                    t.map((x) =>
                        x.id === taskId ? { ...x, status: 'error', error: presign.error } : x,
                    ),
                );
                return;
            }

            const ok = await new Promise<boolean>((resolve) => {
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
                    resolve(xhr.status >= 200 && xhr.status < 300);
                });
                xhr.addEventListener('error', () => resolve(false));
                xhr.send(file);
            });

            if (!ok) {
                setTasks((t) =>
                    t.map((x) =>
                        x.id === taskId
                            ? { ...x, status: 'error', error: 'Upload failed' }
                            : x,
                    ),
                );
                return;
            }

            const confirmed = await confirmUpload({
                key: presign.key,
                name: file.name,
                size: file.size,
                mime: file.type || undefined,
                parent_id: null,
            });
            if ('error' in confirmed) {
                setTasks((t) =>
                    t.map((x) =>
                        x.id === taskId ? { ...x, status: 'error', error: confirmed.error } : x,
                    ),
                );
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
            // ("Pick" button) finishes the flow.
            setSelectedId(confirmed.node.id);
            // Also feed it into the library list so it appears with its
            // siblings if the user toggles back.
            setItems((curr) => [confirmed.node, ...curr]);
        },
        [],
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

    return (
        <ZoruDialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="max-w-3xl">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>{title}</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        Pick a file from your SabFiles library or upload a new one.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>

                <div className="flex flex-wrap items-center gap-1 rounded-[var(--zoru-radius)] border border-zoru-line p-1">
                    <ModeButton
                        active={mode === 'library'}
                        icon={<FileImage />}
                        label="Library"
                        onClick={() => setMode('library')}
                    />
                    {allowUpload && (
                        <ModeButton
                            active={mode === 'upload'}
                            icon={<Upload />}
                            label="Upload"
                            onClick={() => setMode('upload')}
                        />
                    )}
                </div>

                {mode === 'library' && (
                    <>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {visibleTabs.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setCategory(t.id)}
                                    className={cn(
                                        'rounded-full border border-zoru-line px-3 py-1 text-xs text-zoru-ink-muted hover:text-zoru-ink',
                                        category === t.id &&
                                            'border-zoru-ink bg-zoru-ink text-zoru-on-primary',
                                    )}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        <ZoruInput
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            leadingSlot={<Search />}
                            placeholder="Search by name…"
                        />
                        <div className="min-h-[280px]">
                            {loading ? (
                                <div className="flex h-[280px] items-center justify-center text-sm text-zoru-ink-muted">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading library…
                                </div>
                            ) : items.length === 0 ? (
                                <div className="flex h-[280px] items-center justify-center text-sm text-zoru-ink-muted">
                                    Nothing here yet — switch to Upload to add a file.
                                </div>
                            ) : (
                                <ul className="grid max-h-[360px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
                                    {items.map((n) => {
                                        const selected = selectedId === n.id;
                                        return (
                                            <li key={n.id}>
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        'group relative flex w-full flex-col items-stretch gap-1 rounded-[var(--zoru-radius)] border border-zoru-line p-2 text-left transition-colors hover:border-zoru-ink/40',
                                                        selected && 'border-zoru-ink bg-zoru-surface-2',
                                                    )}
                                                    onClick={() => setSelectedId(n.id)}
                                                    onDoubleClick={() => {
                                                        setSelectedId(n.id);
                                                        // Fire pick on double-click.
                                                        setTimeout(onConfirmPick, 0);
                                                    }}
                                                >
                                                    <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-[var(--zoru-radius-sm)] bg-zoru-surface">
                                                        {n.mime?.startsWith('image/') && n.url ? (
                                                            <img
                                                                src={n.url}
                                                                alt={n.name}
                                                                className="h-full w-full object-cover"
                                                                loading="lazy"
                                                            />
                                                        ) : (
                                                            <span className="[&>svg]:h-7 [&>svg]:w-7">
                                                                {iconFor(n.mime)}
                                                            </span>
                                                        )}
                                                        {selected && (
                                                            <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zoru-ink text-zoru-on-primary">
                                                                <Check className="h-3 w-3" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="truncate text-xs font-medium text-zoru-ink">
                                                        {n.name}
                                                    </div>
                                                    <div className="text-[10px] text-zoru-ink-muted">
                                                        {fmtSize(n.size)}
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </>
                )}

                {mode === 'upload' && (
                    <div className="flex flex-col gap-3">
                        <div
                            role="button"
                            tabIndex={0}
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
                            className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--zoru-radius-lg)] border-2 border-dashed border-zoru-line p-6 text-center hover:border-zoru-ink/40"
                        >
                            <Upload className="h-8 w-8 text-zoru-ink-muted" />
                            <div className="text-sm font-medium text-zoru-ink">
                                Click or drag files here
                            </div>
                            <div className="text-xs text-zoru-ink-muted">
                                Files upload directly to your SabFiles library.
                                {acceptAttr && <> Accepts {acceptAttr}.</>}
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
                            <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-2">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-xs font-medium text-zoru-ink">
                                        Uploads ({tasks.length})
                                        {inFlight > 0 && (
                                            <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-zoru-ink-muted" />
                                        )}
                                    </span>
                                </div>
                                <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
                                    {tasks.map((t) => (
                                        <li key={t.id} className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between gap-2 text-xs">
                                                <span className="truncate">{t.name}</span>
                                                {t.status === 'done' && t.node && (
                                                    <button
                                                        type="button"
                                                        className="text-emerald-600 hover:underline"
                                                        onClick={() => setSelectedId(t.node!.id)}
                                                    >
                                                        {selectedId === t.node.id ? 'Selected' : 'Select'}
                                                    </button>
                                                )}
                                            </div>
                                            {t.status === 'error' ? (
                                                <span className="text-[11px] text-red-500">{t.error}</span>
                                            ) : (
                                                <ZoruProgress value={t.progress} className="h-1" />
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                <ZoruDialogFooter>
                    <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </ZoruButton>
                    <ZoruButton onClick={onConfirmPick} disabled={!selectedId}>
                        Use this file
                    </ZoruButton>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

function ModeButton({
    active,
    icon,
    label,
    onClick,
}: {
    active: boolean;
    icon: React.ReactElement;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-[var(--zoru-radius-sm)] px-3 py-1 text-xs text-zoru-ink-muted hover:text-zoru-ink',
                active && 'bg-zoru-ink text-zoru-on-primary',
            )}
        >
            {icon}
            {label}
        </button>
    );
}

// ──────────────────────────────────────────────────────────────────────
// Controlled "file chip" input: holds a SabFiles URL as its value, but
// the UI only shows the picked file's name + Browse + Clear. Free-text
// URL paste is intentionally disabled — every file MUST come from
// SabFiles (library or upload). The component still exposes `name=`
// and `value=` so existing forms that POST a `*Url` field via FormData
// keep working transparently.
//
// Backwards compatibility: kept the `SabFileUrlInput` export name (and
// its `value` / `onChange(value)` shape) so the 16+ migrated call sites
// don't need updates. The legacy `placeholder` and `allowFreeText`
// props are accepted but ignored.
// ──────────────────────────────────────────────────────────────────────
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
                    'flex h-9 flex-1 items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 text-sm',
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
                            <FileIcon className="h-4 w-4 text-zoru-ink-muted" />
                        )}
                        <span className="truncate text-zoru-ink">{displayName}</span>
                    </>
                ) : (
                    <span className="text-zoru-ink-muted">{placeholder}</span>
                )}
            </div>
            {/* Hidden field so existing FormData-based submissions still work. */}
            {name && <input type="hidden" name={name} value={value} />}
            <ZoruButton
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => setOpen(true)}
            >
                <Upload /> {value ? 'Change' : 'Choose file'}
            </ZoruButton>
            {value && (
                <ZoruButton
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Clear"
                    disabled={disabled}
                    onClick={() => {
                        setLastName(null);
                        setLastMime(undefined);
                        onChange('');
                    }}
                >
                    <X />
                </ZoruButton>
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

// ──────────────────────────────────────────────────────────────────────
// Bridge utility: download a picked SabFile back into a `File` object.
//
// Used by Meta-pipeline forms (template headers, broadcast media,
// WhatsApp profile picture, chat-message attachments, etc.) whose
// existing handlers expect a `File` to feed into Meta's resumable
// upload. The user picks from SabFiles, the browser pulls the bytes
// from R2 (or the `/api/sabfiles/raw/:id` proxy), and the form gets
// the same `File` shape it would have got from a `<input type="file">`.
// ──────────────────────────────────────────────────────────────────────
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
            <ZoruButton
                type="button"
                variant={variant}
                className={className}
                disabled={busy}
                onClick={() => setOpen(true)}
            >
                {busy ? <Loader2 className="animate-spin" /> : null}
                {children ?? 'Pick from SabFiles'}
            </ZoruButton>
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

// ──────────────────────────────────────────────────────────────────────
// Convenience: a button that opens the picker. For non-input call sites
// (e.g. "attach a file" buttons in chat composers).
// ──────────────────────────────────────────────────────────────────────
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
            <ZoruButton
                type="button"
                variant={variant}
                className={className}
                onClick={() => setOpen(true)}
            >
                {children ?? (
                    <>
                        <Upload /> Choose file
                    </>
                )}
            </ZoruButton>
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
