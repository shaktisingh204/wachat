'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, Checkbox, Input, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
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
    const { toast } = useToast();
    const [allRows, setAllRows] = useState<Row[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [mounted, setMounted] = useState(false);

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
        setMounted(true);
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

    if (!mounted) {
        return (
            <div className="flex h-60 items-center justify-center">
                <span className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Loading roles...
                </span>
            </div>
        );
    }

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
                    <Button asChild>
                        <Link href="/dashboard/crm/settings/roles/new">
                            <Plus className="h-4 w-4" /> New Role
                        </Link>
                    </Button>
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
                            <Button
                                key={k}
                                type="button"
                                variant={filter === k ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilter(k)}
                            >
                                {l}
                            </Button>
                        ))}
                    </>
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
                                Delete (custom only)
                            </Button>
                            <Button
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
                            </Button>
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
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
                        >
                            <StatCard
                                label="Total"
                                value={allRows.length}
                                icon={<Shield className="h-4 w-4" />}
                                className={
                                    filter === 'all'
                                        ? 'ring-1 ring-[var(--st-text)] rounded-[var(--st-radius-lg)]'
                                        : undefined
                                }
                            />
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('system')}
                            className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
                        >
                            <StatCard
                                label="System"
                                value={allRows.filter((r) => r.is_system).length}
                                icon={<UserCheck className="h-4 w-4" />}
                                className={
                                    filter === 'system'
                                        ? 'ring-1 ring-[var(--st-text)] rounded-[var(--st-radius-lg)]'
                                        : undefined
                                }
                            />
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('custom')}
                            className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
                        >
                            <StatCard
                                label="Custom"
                                value={
                                    allRows.filter((r) => !r.is_system && !r.is_admin)
                                        .length
                                }
                                icon={<UserCog className="h-4 w-4" />}
                                className={
                                    filter === 'custom'
                                        ? 'ring-1 ring-[var(--st-text)] rounded-[var(--st-radius-lg)]'
                                        : undefined
                                }
                            />
                        </button>
                        <StatCard
                            label="Members assigned"
                            value={totalMembers}
                            icon={<Users className="h-4 w-4" />}
                        />
                    </div>

                    <Card className="p-0">
                        <div className="overflow-x-auto rounded-lg">
                            <Table>
                                <THead>
                                    <Tr className="hover:bg-transparent">
                                        <Th className="w-[40px]">
                                            <Checkbox
                                                checked={
                                                    filtered.length > 0 &&
                                                    selected.size === filtered.length
                                                }
                                                onCheckedChange={toggleAll}
                                                aria-label="Select all"
                                            />
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Role
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Slug
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Members
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Type
                                        </Th>
                                        <Th className="w-[180px] text-right text-[var(--st-text-secondary)]">
                                            Actions
                                        </Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {isLoading && allRows.length === 0 ? (
                                        <Tr>
                                            <Td
                                                colSpan={6}
                                                className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                                            >
                                                <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                                            </Td>
                                        </Tr>
                                    ) : filtered.length === 0 ? (
                                        <Tr>
                                            <Td
                                                colSpan={6}
                                                className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                                            >
                                                {search
                                                    ? `No roles matched “${search}”.`
                                                    : 'No roles yet — click New Role to get started.'}
                                            </Td>
                                        </Tr>
                                    ) : (
                                        filtered.map((row) => (
                                            <Tr key={row._id}>
                                                <Td>
                                                    <Checkbox
                                                        checked={selected.has(row._id)}
                                                        onCheckedChange={() =>
                                                            toggleOne(row._id)
                                                        }
                                                        aria-label="Select row"
                                                    />
                                                </Td>
                                                <Td className="text-[13px] text-[var(--st-text)]">
                                                    <EntityRowLink
                                                        href={`/dashboard/crm/settings/roles/${row._id}/edit`}
                                                        label={row.display_name || row.name}
                                                        subtitle={row.description || undefined}
                                                    />
                                                </Td>
                                                <Td className="text-[12px] text-[var(--st-text-secondary)]">
                                                    <code>{row.name}</code>
                                                </Td>
                                                <Td>
                                                    <Badge variant="ghost">
                                                        <Users className="h-3 w-3" />
                                                        {row.memberCount}
                                                    </Badge>
                                                </Td>
                                                <Td>
                                                    <div className="flex gap-1">
                                                        {row.is_admin ? (
                                                            <Badge variant="default">
                                                                Admin
                                                            </Badge>
                                                        ) : null}
                                                        {row.is_system ? (
                                                            <Badge variant="ghost">
                                                                System
                                                            </Badge>
                                                        ) : null}
                                                        {!row.is_admin && !row.is_system ? (
                                                            <Badge variant="success">
                                                                Custom
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                </Td>
                                                <Td className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
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
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={!!row.is_system}
                                                            onClick={() =>
                                                                setDeletingId(row._id)
                                                            }
                                                            aria-label="Delete"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                                                        </Button>
                                                    </div>
                                                </Td>
                                            </Tr>
                                        ))
                                    )}
                                </TBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            </EntityListShell>

            <AlertDialog
                open={deletingId !== null}
                onOpenChange={(o) => !o && setDeletingId(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete role?</AlertDialogTitle>
                        <AlertDialogDescription>
                            All member assignments and permission grants for this role
                            will be removed. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
