'use client';

/**
 * Custom Fields list — §1D bar:
 *  - KPI strip (Total · By entity (distinct) · Entity-ref count · Required)
 *  - Search across label / slug
 *  - Filter chips by `belongs_to` entity
 *  - Bulk delete + CSV export (filtered subset)
 *  - +New CTA routes to /custom-fields/new (richer dedicated form)
 *  - "Manage Groups" secondary action routes to /custom-fields/groups
 *  - Grouped table preserved (one card per group with move up/down and
 *    edit/delete row actions) — extracted to _components/.
 */

import * as React from 'react';
import Link from 'next/link';
import {
    Layers,
    Plus,
    Trash2,
    FolderTree,
    Asterisk,
    Link2,
    LayoutGrid,
    Download,
    X,
} from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import {
    ZoruAlertDialog,
    ZoruAlertDialogAction,
    ZoruAlertDialogCancel,
    ZoruAlertDialogContent,
    ZoruAlertDialogDescription,
    ZoruAlertDialogFooter,
    ZoruAlertDialogHeader,
    ZoruAlertDialogTitle,
    ZoruButton,
    ZoruCard,
    ZoruStatCard,
    useZoruToast,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    getCustomFieldGroups,
    getCustomFields,
    deleteCustomField,
    reorderCustomFields,
} from '@/app/actions/worksuite/meta.actions';
import {
    CustomFieldsGroupedTable,
    type FieldRow,
    type GroupRow,
} from './_components/custom-fields-grouped-table';

function csvCell(v: unknown): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function exportCsv(fields: FieldRow[], groups: GroupRow[]): void {
    const groupMap = new Map<string, GroupRow>();
    groups.forEach((g) => groupMap.set(String(g._id), g));
    const header = [
        'Group',
        'Belongs to',
        'Label',
        'Slug',
        'Type',
        'Required',
        'In Table',
    ];
    const lines = fields.map((f) => {
        const g = groupMap.get(String(f.group_id));
        return [
            g?.name ?? '',
            g?.belongs_to ?? f.belongs_to ?? '',
            f.label,
            f.name,
            f.type,
            f.is_required ? 'yes' : 'no',
            f.display_in_table ? 'yes' : 'no',
        ]
            .map(csvCell)
            .join(',');
    });
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-fields.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export default function CustomFieldsPage() {
    const { toast } = useZoruToast();
    const [groups, setGroups] = useState<GroupRow[]>([]);
    const [fields, setFields] = useState<FieldRow[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [isPending, startReorder] = useTransition();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [entityFilter, setEntityFilter] = useState<string>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);

    const refresh = React.useCallback(() => {
        startLoading(async () => {
            try {
                const [g, f] = await Promise.all([
                    getCustomFieldGroups() as Promise<GroupRow[]>,
                    getCustomFields() as Promise<FieldRow[]>,
                ]);
                setGroups(Array.isArray(g) ? g : []);
                setFields(Array.isArray(f) ? f : []);
            } catch (e) {
                console.error('Failed to load custom fields:', e);
            }
        });
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const entitiesInUse = React.useMemo(() => {
        const s = new Set<string>();
        groups.forEach((g) => s.add(g.belongs_to as string));
        return Array.from(s);
    }, [groups]);

    const filteredFields = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return fields.filter((f) => {
            if (q) {
                const matches = [f.label, f.name].some((v) =>
                    String(v ?? '')
                        .toLowerCase()
                        .includes(q),
                );
                if (!matches) return false;
            }
            if (entityFilter !== 'all') {
                const g = groups.find((x) => String(x._id) === String(f.group_id));
                if ((g?.belongs_to as string) !== entityFilter) return false;
            }
            return true;
        });
    }, [fields, groups, search, entityFilter]);

    const filteredGroups = React.useMemo(
        () =>
            entityFilter === 'all'
                ? groups
                : groups.filter((g) => (g.belongs_to as string) === entityFilter),
        [groups, entityFilter],
    );

    const handleDelete = async () => {
        if (!deletingId) return;
        const res = await deleteCustomField(deletingId);
        if (res.success) {
            toast({ title: 'Deleted', description: 'Field removed.' });
            setDeletingId(null);
            setSelected((prev) => {
                const n = new Set(prev);
                n.delete(deletingId);
                return n;
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
            const res = await deleteCustomField(id);
            if (res.success) ok += 1;
            else failed += 1;
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

    const move = (groupId: string, fieldId: string, dir: -1 | 1) => {
        const groupFields = fields
            .filter((f) => String(f.group_id) === String(groupId))
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const idx = groupFields.findIndex((f) => f._id === fieldId);
        if (idx === -1) return;
        const j = idx + dir;
        if (j < 0 || j >= groupFields.length) return;
        const ordered = [...groupFields];
        [ordered[idx], ordered[j]] = [ordered[j], ordered[idx]];
        const orderedIds = ordered.map((f) => f._id);
        startReorder(async () => {
            const res = await reorderCustomFields(groupId, orderedIds);
            if (res.success) refresh();
            else
                toast({
                    title: 'Error',
                    description: res.error || 'Reorder failed',
                    variant: 'destructive',
                });
        });
    };

    return (
        <>
            <EntityListShell
                title="Custom Fields"
                subtitle="Extend any CRM entity with custom fields grouped by target module."
                primaryAction={
                    <div className="flex items-center gap-2">
                        <ZoruButton variant="outline" asChild>
                            <Link href="/dashboard/crm/settings/custom-fields/groups">
                                <FolderTree className="h-4 w-4" />
                                Manage Groups
                            </Link>
                        </ZoruButton>
                        <ZoruButton asChild>
                            <Link href="/dashboard/crm/settings/custom-fields/new">
                                <Plus className="h-4 w-4" />
                                New Field
                            </Link>
                        </ZoruButton>
                    </div>
                }
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search by label or slug…',
                }}
                filters={
                    <>
                        <ZoruButton
                            type="button"
                            variant={entityFilter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setEntityFilter('all')}
                        >
                            All
                        </ZoruButton>
                        {entitiesInUse.map((e) => (
                            <ZoruButton
                                key={e}
                                type="button"
                                variant={entityFilter === e ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setEntityFilter(e)}
                            >
                                {e}
                            </ZoruButton>
                        ))}
                    </>
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 text-[13px]">
                            <span className="font-medium text-zoru-ink">
                                {selected.size} selected
                            </span>
                            <span className="text-zoru-ink-muted">·</span>
                            <ZoruButton
                                variant="ghost"
                                size="sm"
                                disabled={bulkDeleting}
                                onClick={handleBulkDelete}
                            >
                                <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                                Delete
                            </ZoruButton>
                            <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    exportCsv(
                                        filteredFields.filter((f) => selected.has(f._id)),
                                        groups,
                                    )
                                }
                            >
                                <Download className="h-3.5 w-3.5" />
                                Export CSV
                            </ZoruButton>
                            <span className="ml-auto" />
                            <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelected(new Set())}
                            >
                                <X className="h-3.5 w-3.5" />
                                Clear
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={isLoading && groups.length === 0}
            >
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <ZoruStatCard
                            label="Total fields"
                            value={fields.length}
                            icon={<Layers className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Entities used"
                            value={entitiesInUse.length}
                            icon={<LayoutGrid className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="entity_ref fields"
                            value={fields.filter((f) => f.type === 'entity_ref').length}
                            icon={<Link2 className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Required"
                            value={fields.filter((f) => f.is_required).length}
                            icon={<Asterisk className="h-4 w-4" />}
                        />
                    </div>

                    {groups.length === 0 ? (
                        <ZoruCard className="p-6">
                            <div className="text-center">
                                <p className="text-[13px] text-zoru-ink-muted">
                                    No groups yet. Create a group first, then add fields
                                    to it.
                                </p>
                                <div className="mt-4">
                                    <ZoruButton asChild>
                                        <Link href="/dashboard/crm/settings/custom-fields/groups">
                                            Create a Group
                                        </Link>
                                    </ZoruButton>
                                </div>
                            </div>
                        </ZoruCard>
                    ) : (
                        <CustomFieldsGroupedTable
                            groups={filteredGroups}
                            fields={filteredFields}
                            selected={selected}
                            setSelected={setSelected}
                            onDelete={(id) => setDeletingId(id)}
                            onMove={move}
                            isReorderPending={isPending}
                            search={search}
                            entityFilter={entityFilter}
                        />
                    )}
                </div>
            </EntityListShell>

            <ZoruAlertDialog
                open={deletingId !== null}
                onOpenChange={(o) => !o && setDeletingId(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete custom field?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This will also invalidate the stored value for this slug on
                            existing records.
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
