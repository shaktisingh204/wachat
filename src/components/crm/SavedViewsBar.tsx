'use client';

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
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter,
  useSearchParams } from 'next/navigation';
import { Star,
  StarOff,
  Trash2,
  Plus,
  Eye,
  Share2,
  Lock } from 'lucide-react';

/**
 * SavedViewsBar — horizontal chip-row of saved views for any list page.
 *
 * Per CRM_REBUILD_PLAN §5.10. Reusable across every CRM list — pass the
 * `entityKind` (e.g. `'invoice'`, `'lead'`, `'contact'`) and the current
 * filter + visible-column state, and the bar handles:
 *   - listing the user's saved views (private + tenant-shared),
 *   - applying a view (calls `onApplyView`),
 *   - saving the current state as a new view (modal capture),
 *   - star-toggling a default,
 *   - persisting the active view id into the URL (`?viewId=…`) so the
 *     link is shareable.
 *
 * Permission gating happens server-side in the actions — the bar just
 * surfaces what comes back, so an RBAC-restricted user simply sees no
 * "Save" button (because saves fail) but the bar still renders other
 * users' shared views read-only.
 */

import * as React from 'react';

import {
    deleteSavedView,
    getSavedViews,
    saveSavedViewFromForm,
    setDefaultSavedView,
} from '@/app/actions/crm-saved-views.actions';
import type { SavedView, SavedViewScope } from '@/lib/saved-views/types';

export interface SavedViewsBarProps {
    /** Which list this bar belongs to. Required. */
    entityKind: string;
    /** Current filter map — written into a freshly-saved view. */
    currentFilters: Record<string, unknown>;
    /** Currently visible columns. */
    currentColumns: string[];
    /** Active sort column, if any. */
    currentSortBy?: string;
    /** Active sort direction, if any. */
    currentSortDir?: 'asc' | 'desc';
    /** Called when the user picks a view from the row. */
    onApplyView: (view: SavedView) => void;
    /**
     * Optional override for the "Save current as view" button — if you
     * want a host-page CTA elsewhere, return `false` here and render your
     * own trigger that calls `openSaveDialog()` on the ref-returned API.
     */
    onSaveCurrentAsView?: () => void;
    /** Optional className for the outer container. */
    className?: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function readViewIdFromUrl(searchParams: URLSearchParams | null): string | null {
    if (!searchParams) return null;
    const id = searchParams.get('viewId');
    return id && id.trim() ? id : null;
}

/* ─── Component ───────────────────────────────────────────────────────── */

export function SavedViewsBar({
    entityKind,
    currentFilters,
    currentColumns,
    currentSortBy,
    currentSortDir,
    onApplyView,
    onSaveCurrentAsView,
    className,
}: SavedViewsBarProps): React.ReactElement {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useZoruToast();

    const [views, setViews] = React.useState<SavedView[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [activeId, setActiveId] = React.useState<string | null>(
        readViewIdFromUrl(searchParams),
    );

    // Save-modal state.
    const [saveOpen, setSaveOpen] = React.useState(false);
    const [saveName, setSaveName] = React.useState('');
    const [saveScope, setSaveScope] = React.useState<SavedViewScope>('private');
    const [saveIsDefault, setSaveIsDefault] = React.useState(false);
    const [savePending, startSaveTransition] = React.useTransition();

    /* ─── Initial + post-mutation load ───────────────────────────────── */
    const reload = React.useCallback(async () => {
        setLoading(true);
        try {
            const next = await getSavedViews(entityKind);
            setViews(next);
        } finally {
            setLoading(false);
        }
    }, [entityKind]);

    React.useEffect(() => {
        void reload();
    }, [reload]);

    /* ─── Apply a view ──────────────────────────────────────────────── */
    const applyView = React.useCallback(
        (view: SavedView): void => {
            setActiveId(view._id);
            onApplyView(view);
            // Persist into URL — keep all other params intact.
            const next = new URLSearchParams(
                searchParams ? searchParams.toString() : '',
            );
            next.set('viewId', view._id);
            router.replace(`?${next.toString()}`, { scroll: false });
        },
        [onApplyView, router, searchParams],
    );

    /* ─── On initial load, auto-apply ?viewId / default ─────────────── */
    React.useEffect(() => {
        if (loading || views.length === 0) return;
        const urlId = readViewIdFromUrl(searchParams);
        if (urlId) {
            const v = views.find((x) => x._id === urlId);
            if (v && v._id !== activeId) {
                applyView(v);
            }
            return;
        }
        // No URL view → pick user's default if one exists.
        const def = views.find((x) => x.isDefault);
        if (def && def._id !== activeId) {
            applyView(def);
        }
        // We intentionally exclude `activeId` so this only re-runs when
        // the underlying set changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, views]);

    /* ─── Save current state ────────────────────────────────────────── */
    const openSaveDialog = React.useCallback((): void => {
        setSaveName('');
        setSaveScope('private');
        setSaveIsDefault(false);
        setSaveOpen(true);
        onSaveCurrentAsView?.();
    }, [onSaveCurrentAsView]);

    const handleSubmitSave = React.useCallback((): void => {
        const name = saveName.trim();
        if (!name) {
            toast({
                title: 'Name required',
                description: 'Give the view a short name so it shows up here.',
                variant: 'destructive',
            });
            return;
        }
        const fd = new FormData();
        fd.set('name', name);
        fd.set('entityKind', entityKind);
        fd.set('scope', saveScope);
        fd.set('filters', JSON.stringify(currentFilters ?? {}));
        fd.set('visibleColumns', JSON.stringify(currentColumns ?? []));
        if (currentSortBy) fd.set('sortBy', currentSortBy);
        if (currentSortDir) fd.set('sortDir', currentSortDir);
        fd.set('isDefault', saveIsDefault ? 'true' : 'false');

        startSaveTransition(async () => {
            const res = await saveSavedViewFromForm(undefined, fd);
            if (res.error) {
                toast({
                    title: 'Could not save view',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            toast({ title: 'View saved', description: name });
            setSaveOpen(false);
            await reload();
            if (res.view) {
                applyView(res.view);
            }
        });
    }, [
        applyView,
        currentColumns,
        currentFilters,
        currentSortBy,
        currentSortDir,
        entityKind,
        reload,
        saveIsDefault,
        saveName,
        saveScope,
        toast,
    ]);

    /* ─── Delete / set-default chip actions ─────────────────────────── */
    const handleDelete = React.useCallback(
        async (view: SavedView): Promise<void> => {
            const res = await deleteSavedView(view._id);
            if (!res.success) {
                toast({
                    title: 'Could not delete',
                    description: res.error ?? 'Try again.',
                    variant: 'destructive',
                });
                return;
            }
            toast({ title: 'View removed' });
            if (activeId === view._id) {
                setActiveId(null);
                const next = new URLSearchParams(
                    searchParams ? searchParams.toString() : '',
                );
                next.delete('viewId');
                const qs = next.toString();
                router.replace(qs ? `?${qs}` : '?', { scroll: false });
            }
            await reload();
        },
        [activeId, reload, router, searchParams, toast],
    );

    const handleToggleDefault = React.useCallback(
        async (view: SavedView): Promise<void> => {
            const res = await setDefaultSavedView(entityKind, view._id);
            if (!res.success) {
                toast({
                    title: 'Could not pin default',
                    description: res.error ?? 'Try again.',
                    variant: 'destructive',
                });
                return;
            }
            await reload();
        },
        [entityKind, reload, toast],
    );

    /* ─── Render ────────────────────────────────────────────────────── */
    return (
        <div
            className={cn(
                'flex w-full flex-wrap items-center gap-2 rounded-md border border-zoru-line bg-zoru-surface p-2',
                className,
            )}
            data-saved-views-bar
            data-entity-kind={entityKind}
        >
            <span className="inline-flex items-center gap-1 px-1 text-[12px] font-medium text-zoru-ink-muted">
                <Eye className="h-3.5 w-3.5" /> Views
            </span>

            {loading ? (
                <span className="text-[12px] text-zoru-ink-muted">Loading…</span>
            ) : views.length === 0 ? (
                <span className="text-[12px] text-zoru-ink-muted">
                    No saved views yet — capture the current filters below.
                </span>
            ) : (
                <ul className="flex flex-wrap items-center gap-1" role="list">
                    {views.map((view) => {
                        const isActive = activeId === view._id;
                        return (
                            <li key={view._id}>
                                <span
                                    className={cn(
                                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] transition-colors',
                                        isActive
                                            ? 'border-zoru-accent bg-zoru-accent/10 text-zoru-ink'
                                            : 'border-zoru-line bg-zoru-bg text-zoru-ink-muted hover:border-zoru-line-strong hover:text-zoru-ink',
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => applyView(view)}
                                        className="inline-flex items-center gap-1"
                                        aria-pressed={isActive}
                                        title={
                                            view.scope === 'shared'
                                                ? 'Shared view'
                                                : 'Private view'
                                        }
                                    >
                                        {view.scope === 'shared' ? (
                                            <Share2 className="h-3 w-3 opacity-60" />
                                        ) : (
                                            <Lock className="h-3 w-3 opacity-60" />
                                        )}
                                        {view.isDefault ? (
                                            <Star className="h-3 w-3 fill-current text-amber-500" />
                                        ) : null}
                                        <span className="max-w-[16ch] truncate">
                                            {view.name}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleToggleDefault(view)}
                                        className="ml-1 inline-flex items-center text-zoru-ink-muted hover:text-amber-500"
                                        aria-label={
                                            view.isDefault
                                                ? 'Unpin default'
                                                : 'Pin as default'
                                        }
                                        title={
                                            view.isDefault
                                                ? 'Default view'
                                                : 'Set as default'
                                        }
                                    >
                                        {view.isDefault ? (
                                            <StarOff className="h-3 w-3" />
                                        ) : (
                                            <Star className="h-3 w-3" />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleDelete(view)}
                                        className="inline-flex items-center text-zoru-ink-muted hover:text-rose-500"
                                        aria-label="Delete view"
                                        title="Delete view"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="ml-auto">
                <ZoruButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openSaveDialog}
                >
                    <Plus className="h-3.5 w-3.5" /> Save current as view
                </ZoruButton>
            </div>

            <ZoruDialog open={saveOpen} onOpenChange={setSaveOpen}>
                <ZoruDialogContent className="sm:max-w-[480px]">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Save current view</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Captures your filters, columns and sort so you can
                            jump back in one click.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>

                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                            <ZoruLabel htmlFor="savedview-name">Name</ZoruLabel>
                            <ZoruInput
                                id="savedview-name"
                                value={saveName}
                                onChange={(e) => setSaveName(e.target.value)}
                                placeholder="e.g. Hot leads this week"
                                maxLength={80}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <ZoruLabel htmlFor="savedview-scope">Scope</ZoruLabel>
                            <ZoruSelect
                                value={saveScope}
                                onValueChange={(v) =>
                                    setSaveScope(
                                        v === 'shared' ? 'shared' : 'private',
                                    )
                                }
                            >
                                <ZoruSelectTrigger id="savedview-scope">
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="private">
                                        Private (only me)
                                    </ZoruSelectItem>
                                    <ZoruSelectItem value="shared">
                                        Shared (everyone in this workspace)
                                    </ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-zoru-ink">
                            <input
                                type="checkbox"
                                checked={saveIsDefault}
                                onChange={(e) =>
                                    setSaveIsDefault(e.target.checked)
                                }
                            />
                            Pin as my default for {entityKind}
                        </label>
                    </div>

                    <ZoruDialogFooter>
                        <ZoruButton
                            variant="ghost"
                            type="button"
                            onClick={() => setSaveOpen(false)}
                            disabled={savePending}
                        >
                            Cancel
                        </ZoruButton>
                        <ZoruButton
                            type="button"
                            onClick={handleSubmitSave}
                            disabled={savePending}
                        >
                            {savePending ? 'Saving…' : 'Save view'}
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}

export default SavedViewsBar;
