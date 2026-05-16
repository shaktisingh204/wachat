'use client';

/**
 * Departments — list page (canonical, Rust-backed).
 *
 * Settings-style list with search + active filter and an inline-rendered
 * table. Mirrors the canonical Policies template
 * (`src/app/dashboard/hrm/hr/policies/page.tsx`).
 *
 * Data: `listDepartments` (Rust BFF) — never reads Mongo directly.
 * Delete: `deleteDepartmentAction`, gated by `useCan('crm_department', 'delete')`.
 * Hierarchy + New: dedicated sub-routes (`./hierarchy`, `./new`).
 */

import * as React from 'react';
import Link from 'next/link';
import {
    Building2,
    Edit,
    GitBranch,
    LoaderCircle,
    Plus,
    Trash2,
} from 'lucide-react';

import {
    ZoruAlertDialog,
    ZoruAlertDialogAction,
    ZoruAlertDialogCancel,
    ZoruAlertDialogContent,
    ZoruAlertDialogDescription,
    ZoruAlertDialogFooter,
    ZoruAlertDialogHeader,
    ZoruAlertDialogTitle,
    ZoruBadge,
    ZoruButton,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill } from '@/components/crm/status-pill';

import {
    deleteDepartmentAction,
    listDepartments,
} from '@/app/actions/crm/departments.actions';
import type { CrmDepartmentDoc } from '@/lib/rust-client/crm-departments';

const BASE = '/dashboard/hrm/payroll/departments';

type ActiveFilter = 'all' | 'active' | 'inactive';

const ACTIVE_OPTIONS: Array<{ value: ActiveFilter; label: string }> = [
    { value: 'all', label: 'All departments' },
    { value: 'active', label: 'Active only' },
    { value: 'inactive', label: 'Inactive only' },
];

export default function DepartmentsListPage() {
    const [departments, setDepartments] = React.useState<CrmDepartmentDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [activeFilter, setActiveFilter] = React.useState<ActiveFilter>('all');
    const [pendingDelete, setPendingDelete] = React.useState<CrmDepartmentDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

    // RBAC is enforced server-side inside the actions (`requirePermission(
    // 'crm_department', …)`); the UI always renders the buttons and the
    // server returns a friendly error if the caller lacks the capability.

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await listDepartments({
                q: search.trim() || undefined,
                limit: 100,
            });
            const items = res.items ?? [];
            const filtered =
                activeFilter === 'all'
                    ? items
                    : items.filter((d) =>
                          activeFilter === 'active'
                              ? d.active !== false
                              : d.active === false,
                      );
            setDepartments(filtered);
        } catch {
            setDepartments([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, activeFilter]);

    React.useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh();
        }, 250);
        return () => window.clearTimeout(t);
    }, [refresh]);

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const result = await deleteDepartmentAction(id);
            if (result.success) {
                toast({ title: 'Department deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete department.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    breadcrumbs={[
                        { label: 'HRM', href: '/dashboard/hrm' },
                        { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                        { label: 'Departments' },
                    ]}
                    title="Departments"
                    subtitle="Organisational units used to scope employees, payroll runs and reports."
                    icon={Building2}
                    actions={
                        <div className="flex items-center gap-2">
                            <ZoruButton variant="outline" asChild>
                                <Link href={`${BASE}/hierarchy`}>
                                    <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                                    Hierarchy
                                </Link>
                            </ZoruButton>
                            <ZoruButton asChild>
                                <Link href={`${BASE}/new`}>
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    New department
                                </Link>
                            </ZoruButton>
                        </div>
                    }
                />

                <EntityListShell
                    title=""
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search departments…',
                    }}
                    filters={
                        <ZoruSelect
                            value={activeFilter}
                            onValueChange={(v) => setActiveFilter(v as ActiveFilter)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[200px]">
                                <ZoruSelectValue placeholder="Active filter" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {ACTIVE_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    }
                    loading={isLoading && departments.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Code</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Cost centre</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={5} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : departments.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={5}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No departments match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    departments.map((d) => {
                                        const active = d.active !== false;
                                        return (
                                            <ZoruTableRow key={d._id} className="border-zoru-line">
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <Link
                                                        href={`${BASE}/${d._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {d.name}
                                                    </Link>
                                                    {d.description ? (
                                                        <div className="text-[11.5px] text-zoru-ink-muted">
                                                            {d.description}
                                                        </div>
                                                    ) : null}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    {d.code ?? '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {d.costCenter ? (
                                                        <ZoruBadge variant="outline">
                                                            {d.costCenter}
                                                        </ZoruBadge>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill
                                                        label={active ? 'Active' : 'Inactive'}
                                                        tone={active ? 'green' : 'neutral'}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <ZoruButton variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${d._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(d)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </ZoruButton>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </EntityListShell>
            </div>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete department?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; removes it from the
                            directory. Employees assigned to this department keep their
                            historical record but the department reference will resolve to
                            an empty value.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
