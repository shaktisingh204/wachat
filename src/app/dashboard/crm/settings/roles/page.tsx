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
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  Shield,
  Users,
  UserCog,
  UserCheck,
  Pencil,
  Trash2,
  LoaderCircle,
  Search,
  Download,
  X,
  Plus,
  } from 'lucide-react';
import { useEffect,
  useState,
  useTransition } from 'react';

/**
 * Roles list — §1D bar:
 *  - KPI strip (Total · System · Custom · Members assigned)
 *  - Search across name / display name / description
 *  - Filter chips: All / System / Custom / Admin
 *  - Bulk delete + CSV export (Custom roles only — System rows are
 *    delete-blocked at the action layer)
 *  - +New CTA routes to /roles/new
 *  - Row click routes to /roles/[id] for the full permission matrix
 *
 * Note: this entity uses dedicated /new and /[id] routes (not the
 * inline-create dialog) because the permission matrix is too rich for
 * a dialog.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import {
    getRolesWithCounts,
    deleteRole,
} from '@/app/actions/worksuite/rbac.actions';
import type { WsRole } from '@/lib/worksuite/rbac-types';

type Row = WsRole & { _id: string; memberCount: number };
type Filter = 'all' | 'system' | 'custom' | 'admin';

function csvCell(v: unknown): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function exportCsv(rows: Row[]): void {
    const header = ['Name', 'Slug', 'Description', 'Members', 'Admin', 'System'];
    const lines = rows.map((r) =>
        [
            r.display_name || r.name,
            r.name,
            r.description ?? '',
            r.memberCount,
            r.is_admin ? 'yes' : 'no',
            r.is_system ? 'yes' : 'no',
        ]
            .map(csvCell)
            .join(','),
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roles.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export default function RolesPage() {
    const { toast } = useZoruToast();
    const [allRows, setAllRows] = useState<Row[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);

    const refresh = React.useCallback(() => {
        startLoading(async () => {
            try {
                const list = (await getRolesWithCounts()) as Row[];
                setAllRows(Array.isArray(list) ? list : []);
            } catch (e) {
                console.error('Failed to load roles:', e);
            }
        });
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const filtered = React.useMemo(() => {
        let list = allRows;
        if (filter === 'system') list = list.filter((r) => r.is_system);
        else if (filter === 'custom')
            list = list.filter((r) => !r.is_system && !r.is_admin);
        else if (filter === 'admin') list = list.filter((r) => r.is_admin);
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((r) =>
                [r.name, r.display_name, r.description]
                    .filter(Boolean)
                    .some((s) => String(s).toLowerCase().includes(q)),
            );
        }
        return list;
    }, [allRows, filter, search]);

    const totalMembers = allRows.reduce((s, r) => s + (r.memberCount || 0), 0);

    const handleDelete = async () => {
        if (!deletingId) return;
        const res = await deleteRole(deletingId);
        if (res.success) {
            toast({ title: 'Deleted', description: 'Role removed.' });
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
                description: res.error || 'Failed',
                variant: 'destructive',
            });
        }
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selected).filter((id) => {
            const r = allRows.find((x) => x._id === id);
            return r && !r.is_system; // system roles can't be deleted
        });
        if (!ids.length) {
            toast({
                title: 'Nothing to delete',
                description: 'System roles cannot be removed.',
            });
            return;
        }
        setBulkDeleting(true);
        let ok = 0;
        let failed = 0;
        for (const id of ids) {
            const res = await deleteRole(id);
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

    const toggleAll = () => {
        setSelected((prev) => {
            if (prev.size === filtered.length) return new Set();
            return new Set(filtered.map((r) => r._id));
        });
    };
    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    };

    return (
        <>
            <EntityListShell
                title="Roles"
                subtitle="Define custom roles for your CRM and assign the permissions they grant."
                primaryAction={
                    <ZoruButton asChild>
                        <Link href="/dashboard/crm/settings/roles/new">
                            <Plus className="h-4 w-4" /> New Role
                        </Link>
                    </ZoruButton>
                }
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search roles…',
                }}
                filters={
                    <>
                        {(
                            [
                                { k: 'all', l: 'All' },
                                { k: 'system', l: 'System' },
                                { k: 'admin', l: 'Admin' },
                                { k: 'custom', l: 'Custom' },
                            ] as { k: Filter; l: string }[]
                        ).map(({ k, l }) => (
                            <ZoruButton
                                key={k}
                                type="button"
                                variant={filter === k ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilter(k)}
                            >
                                {l}
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
                                Delete (custom only)
                            </ZoruButton>
                            <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    exportCsv(
                                        filtered.filter((r) => selected.has(r._id)),
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
                loading={isLoading && allRows.length === 0}
            >
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
                        >
                            <ZoruStatCard
                                label="Total"
                                value={allRows.length}
                                icon={<Shield className="h-4 w-4" />}
                                className={
                                    filter === 'all'
                                        ? 'ring-1 ring-zoru-primary rounded-[var(--zoru-radius-lg)]'
                                        : undefined
                                }
                            />
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('system')}
                            className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
                        >
                            <ZoruStatCard
                                label="System"
                                value={allRows.filter((r) => r.is_system).length}
                                icon={<UserCheck className="h-4 w-4" />}
                                className={
                                    filter === 'system'
                                        ? 'ring-1 ring-zoru-primary rounded-[var(--zoru-radius-lg)]'
                                        : undefined
                                }
                            />
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('custom')}
                            className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
                        >
                            <ZoruStatCard
                                label="Custom"
                                value={
                                    allRows.filter((r) => !r.is_system && !r.is_admin)
                                        .length
                                }
                                icon={<UserCog className="h-4 w-4" />}
                                className={
                                    filter === 'custom'
                                        ? 'ring-1 ring-zoru-primary rounded-[var(--zoru-radius-lg)]'
                                        : undefined
                                }
                            />
                        </button>
                        <ZoruStatCard
                            label="Members assigned"
                            value={totalMembers}
                            icon={<Users className="h-4 w-4" />}
                        />
                    </div>

                    <ZoruCard className="p-0">
                        <div className="overflow-x-auto rounded-lg">
                            <ZoruTable>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="hover:bg-transparent">
                                        <ZoruTableHead className="w-[40px]">
                                            <ZoruCheckbox
                                                checked={
                                                    filtered.length > 0 &&
                                                    selected.size === filtered.length
                                                }
                                                onCheckedChange={toggleAll}
                                                aria-label="Select all"
                                            />
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Role
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Slug
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Members
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Type
                                        </ZoruTableHead>
                                        <ZoruTableHead className="w-[180px] text-right text-zoru-ink-muted">
                                            Actions
                                        </ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {isLoading && allRows.length === 0 ? (
                                        <ZoruTableRow>
                                            <ZoruTableCell
                                                colSpan={6}
                                                className="h-20 text-center text-[13px] text-zoru-ink-muted"
                                            >
                                                <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ) : filtered.length === 0 ? (
                                        <ZoruTableRow>
                                            <ZoruTableCell
                                                colSpan={6}
                                                className="h-20 text-center text-[13px] text-zoru-ink-muted"
                                            >
                                                {search
                                                    ? `No roles matched “${search}”.`
                                                    : 'No roles yet — click New Role to get started.'}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ) : (
                                        filtered.map((row) => (
                                            <ZoruTableRow key={row._id}>
                                                <ZoruTableCell>
                                                    <ZoruCheckbox
                                                        checked={selected.has(row._id)}
                                                        onCheckedChange={() =>
                                                            toggleOne(row._id)
                                                        }
                                                        aria-label="Select row"
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-[13px] text-zoru-ink">
                                                    <EntityRowLink
                                                        href={`/dashboard/crm/settings/roles/${row._id}/edit`}
                                                        label={row.display_name || row.name}
                                                        subtitle={row.description || undefined}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                                                    <code>{row.name}</code>
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <ZoruBadge variant="ghost">
                                                        <Users className="h-3 w-3" />
                                                        {row.memberCount}
                                                    </ZoruBadge>
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <div className="flex gap-1">
                                                        {row.is_admin ? (
                                                            <ZoruBadge variant="default">
                                                                Admin
                                                            </ZoruBadge>
                                                        ) : null}
                                                        {row.is_system ? (
                                                            <ZoruBadge variant="ghost">
                                                                System
                                                            </ZoruBadge>
                                                        ) : null}
                                                        {!row.is_admin && !row.is_system ? (
                                                            <ZoruBadge variant="success">
                                                                Custom
                                                            </ZoruBadge>
                                                        ) : null}
                                                    </div>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <ZoruButton
                                                            variant="ghost"
                                                            size="sm"
                                                            asChild
                                                            aria-label="Edit"
                                                        >
                                                            <Link
                                                                href={`/dashboard/crm/settings/roles/${row._id}`}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Link>
                                                        </ZoruButton>
                                                        <ZoruButton
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={!!row.is_system}
                                                            onClick={() =>
                                                                setDeletingId(row._id)
                                                            }
                                                            aria-label="Delete"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                                                        </ZoruButton>
                                                    </div>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        ))
                                    )}
                                </ZoruTableBody>
                            </ZoruTable>
                        </div>
                    </ZoruCard>
                </div>
            </EntityListShell>

            <ZoruAlertDialog
                open={deletingId !== null}
                onOpenChange={(o) => !o && setDeletingId(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete role?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            All member assignments and permission grants for this role
                            will be removed. This cannot be undone.
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
