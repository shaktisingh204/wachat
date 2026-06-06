'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Button,
  StatCard,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  Plus,
  Trash2,
  Download,
  X } from 'lucide-react';
import {
    useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  } from 'react';

/**
 * <SettingsEntityShell /> — settings-style list page chrome per CRM
 * §1D.4 (settings list) bar. Composes:
 *
 *   - <EntityListShell> chrome (header + search + filter row + bulk bar
 *     + pagination + +New CTA)
 *   - KPI strip (2-4 clickable cards)
 *   - Filter chips
 *   - Bulk-select with sticky bulk-action bar (delete · export CSV +
 *     optional extra actions)
 *   - Inline-create + inline-edit dialog (re-uses the field renderer
 *     from <HrEntityPage>)
 *   - Confirm-delete alert dialog
 *
 * Server actions follow the existing contract:
 *   - getAllAction(): Promise<T[]>
 *   - saveAction(prev, formData): Promise<{ message?: string; error?: string; id?: string }>
 *   - deleteAction(id): Promise<{ success: boolean; error?: string }>
 *
 * Preserves every FormData key the existing save actions read (the
 * dialog renders fields verbatim by name).
 *
 * Field renderer + CSV helpers live in `settings-entity-shell-field`
 * to keep this file under the 600-line budget.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    downloadCsv,
    type SettingsColumn,
    type SettingsField,
} from '@/components/crm/settings-entity-shell-field';
import { SettingsEntityDialog } from '@/components/crm/settings-entity-dialog';
import { SettingsEntityTable } from '@/components/crm/settings-entity-table';

export type {
    SettingsField,
    SettingsColumn,
    SettingsFieldType,
} from '@/components/crm/settings-entity-shell-field';

/* ─── Public types ───────────────────────────────────────────────────── */

export interface SettingsKpi {
    label: string;
    value: React.ReactNode;
    icon?: React.ReactNode;
    /** If set, clicking the card activates this filter key. */
    filterKey?: string;
    active?: boolean;
}

export interface SettingsFilterChip {
    key: string;
    label: string;
    active: boolean;
}

export interface SettingsEntityShellProps<T extends { _id: string }> {
    /* Identity */
    title: string;
    subtitle: string;
    singular: string;

    /* Data + server actions */
    getAllAction: () => Promise<T[]>;
    saveAction: (
        prev: any,
        formData: FormData,
    ) => Promise<{ message?: string; error?: string; id?: string }>;
    deleteAction: (id: string) => Promise<{ success: boolean; error?: string }>;

    /* Schema */
    columns: SettingsColumn<T>[];
    fields: SettingsField[];

    /* §1D bar */
    kpis?: (rows: T[], allRows: T[]) => SettingsKpi[];
    searchPredicate?: (row: T, query: string) => boolean;
    filterChips?: SettingsFilterChip[];
    onFilterChange?: (key: string) => void;
    onKpiClick?: (filterKey: string) => void;
    extraBulkActions?: (selectedIds: string[]) => React.ReactNode;
    extraRowActions?: (row: T) => React.ReactNode;
    extraHeaderActions?: React.ReactNode;
    newAction?: { href?: string; onClick?: () => void; label?: string };
    hideNew?: boolean;
    hiddenInputs?: (editing: T | null) => React.ReactNode;
    csvFilename?: string;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function SettingsEntityShell<T extends { _id: string; [k: string]: any }>(
    props: SettingsEntityShellProps<T>,
) {
    const {
        title,
        subtitle,
        singular,
        getAllAction,
        saveAction,
        deleteAction,
        columns,
        fields,
        kpis,
        searchPredicate,
        filterChips,
        onFilterChange,
        onKpiClick,
        extraBulkActions,
        extraRowActions,
        extraHeaderActions,
        newAction,
        hideNew,
        hiddenInputs,
        csvFilename,
    } = props;
    const { toast } = useZoruToast();

    const [allRows, setAllRows] = useState<T[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<T | null>(null);
    const [entityValues, setEntityValues] = useState<Record<string, string>>({});

    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [bulkDeleting, setBulkDeleting] = useState(false);

    const [saveState, saveFormAction, isSaving] = useActionState(saveAction, {
        message: '',
        error: '',
    } as any);

    const refresh = useCallback(() => {
        startLoading(async () => {
            try {
                const list = await getAllAction();
                setAllRows(Array.isArray(list) ? list : []);
            } catch (e) {
                console.error('Failed to load entities:', e);
            }
        });
    }, [getAllAction]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        if (saveState?.message) {
            toast({ title: 'Saved', description: saveState.message });
            setDialogOpen(false);
            setEditing(null);
            refresh();
        }
        if (saveState?.error) {
            toast({
                title: 'Error',
                description: saveState.error,
                variant: 'destructive',
            });
        }
    }, [saveState, toast, refresh]);

    useEffect(() => {
        if (!dialogOpen) {
            setEntityValues({});
            return;
        }
        const init: Record<string, string> = {};
        for (const f of fields) {
            if (f.type === 'entity') {
                const raw = editing?.[f.name];
                if (raw !== undefined && raw !== null) init[f.name] = String(raw);
            }
        }
        setEntityValues(init);
    }, [dialogOpen, editing, fields]);

    const onEntityChange = useCallback(
        (name: string, id: string | null) => {
            setEntityValues((prev) => {
                const next = { ...prev };
                if (id == null || id === '') delete next[name];
                else next[name] = id;
                for (const f of fields) {
                    if (f.type !== 'entity' || !f.cascadeFilterFrom) continue;
                    if (f.name === name) continue;
                    if (!Object.prototype.hasOwnProperty.call(next, f.name)) continue;
                    const before = JSON.stringify(f.cascadeFilterFrom(prev) ?? {});
                    const after = JSON.stringify(f.cascadeFilterFrom(next) ?? {});
                    if (before !== after) delete next[f.name];
                }
                return next;
            });
        },
        [fields],
    );

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return allRows;
        const pred =
            searchPredicate ??
            ((row: T, query: string) =>
                columns.some((c) => {
                    const v = (row as Record<string, unknown>)[c.key];
                    if (v === null || v === undefined) return false;
                    return String(v).toLowerCase().includes(query);
                }));
        return allRows.filter((r) => pred(r, q));
    }, [allRows, columns, search, searchPredicate]);

    const kpiCards = kpis?.(filteredRows, allRows) ?? [];

    const handleDelete = async () => {
        if (!deletingId) return;
        const res = await deleteAction(deletingId);
        if (res.success) {
            toast({ title: 'Deleted', description: `${singular} removed.` });
            setDeletingId(null);
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(deletingId);
                return next;
            });
            refresh();
        } else {
            toast({
                title: 'Error',
                description: res.error || 'Failed to delete',
                variant: 'destructive',
            });
        }
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selected);
        if (!ids.length) return;
        setBulkDeleting(true);
        let ok = 0;
        let failed = 0;
        for (const id of ids) {
            try {
                const res = await deleteAction(id);
                if (res.success) ok += 1;
                else failed += 1;
            } catch {
                failed += 1;
            }
        }
        setBulkDeleting(false);
        setSelected(new Set());
        toast({
            title: 'Bulk delete',
            description: `${ok} removed${failed ? `, ${failed} failed` : ''}.`,
            variant: failed ? 'destructive' : undefined,
        });
        refresh();
    };

    const exportSelectedCsv = () => {
        const subset = selected.size
            ? filteredRows.filter((r) => selected.has(r._id))
            : filteredRows;
        const name =
            (csvFilename ?? `${title.toLowerCase().replace(/\s+/g, '-')}`) + '.csv';
        downloadCsv(name, columns, subset);
    };

    const toggleAll = () => {
        setSelected((prev) => {
            if (prev.size === filteredRows.length) return new Set();
            return new Set(filteredRows.map((r) => r._id));
        });
    };
    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const openCreate = () => {
        if (newAction?.href) return;
        if (newAction?.onClick) {
            newAction.onClick();
            return;
        }
        setEditing(null);
        setDialogOpen(true);
    };

    const newCta = !hideNew ? (
        newAction?.href ? (
            <Button asChild>
                <Link href={newAction.href}>
                    <Plus className="h-4 w-4" />
                    {newAction.label ?? `New ${singular}`}
                </Link>
            </Button>
        ) : (
            <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {newAction?.label ?? `New ${singular}`}
            </Button>
        )
    ) : null;

    const headerActions = (
        <>
            {extraHeaderActions}
            {newCta}
        </>
    );

    return (
        <>
            <EntityListShell
                title={title}
                subtitle={subtitle}
                primaryAction={headerActions}
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: `Search ${title.toLowerCase()}…`,
                }}
                filters={
                    filterChips && filterChips.length > 0 ? (
                        <>
                            {filterChips.map((chip) => (
                                <Button
                                    key={chip.key}
                                    type="button"
                                    variant={chip.active ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => onFilterChange?.(chip.key)}
                                >
                                    {chip.label}
                                </Button>
                            ))}
                        </>
                    ) : null
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 text-[13px]">
                            <span className="font-medium text-[var(--st-text)]">
                                {selected.size} selected
                            </span>
                            <span className="text-[var(--st-text-secondary)]">·</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={bulkDeleting}
                                onClick={handleBulkDelete}
                            >
                                <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                                Delete
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={exportSelectedCsv}
                            >
                                <Download className="h-3.5 w-3.5" />
                                Export CSV
                            </Button>
                            {extraBulkActions?.(Array.from(selected))}
                            <span className="ml-auto" />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelected(new Set())}
                            >
                                <X className="h-3.5 w-3.5" />
                                Clear
                            </Button>
                        </div>
                    ) : null
                }
                loading={isLoading && allRows.length === 0}
            >
                <div className="flex flex-col gap-4">
                    {kpiCards.length > 0 ? (
                        <div
                            className={`grid grid-cols-1 gap-3 md:grid-cols-${Math.min(
                                4,
                                kpiCards.length,
                            )}`}
                        >
                            {kpiCards.map((kpi, i) => {
                                const card = (
                                    <StatCard
                                        label={kpi.label}
                                        value={kpi.value}
                                        icon={kpi.icon}
                                        className={
                                            kpi.active
                                                ? 'ring-1 ring-[var(--st-text)] rounded-[var(--zoru-radius-lg)]'
                                                : undefined
                                        }
                                    />
                                );
                                if (kpi.filterKey) {
                                    return (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => onKpiClick?.(kpi.filterKey!)}
                                            className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
                                        >
                                            {card}
                                        </button>
                                    );
                                }
                                return <div key={i}>{card}</div>;
                            })}
                        </div>
                    ) : null}

                    <SettingsEntityTable
                        rows={filteredRows}
                        columns={columns}
                        isLoading={isLoading}
                        search={search}
                        singular={singular}
                        selected={selected}
                        onToggleAll={toggleAll}
                        onToggleOne={toggleOne}
                        onEdit={(row) => {
                            setEditing(row);
                            setDialogOpen(true);
                        }}
                        onDelete={(id) => setDeletingId(id)}
                        extraRowActions={extraRowActions}
                    />
                </div>
            </EntityListShell>

            <SettingsEntityDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                singular={singular}
                editing={editing}
                fields={fields}
                formAction={saveFormAction}
                isSaving={isSaving}
                entityValues={entityValues}
                onEntityChange={onEntityChange}
                hiddenInputs={hiddenInputs}
            />

            {/* Confirm delete */}
            <ZoruAlertDialog
                open={deletingId !== null}
                onOpenChange={(o) => !o && setDeletingId(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            Delete {singular.toLowerCase()}?
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This action cannot be undone.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleDelete}>
                            Delete
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}

export default SettingsEntityShell;
