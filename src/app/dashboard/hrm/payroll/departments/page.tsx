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
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  Edit,
  GitBranch,
  LoaderCircle,
  Plus,
  Trash2,
  } from 'lucide-react';

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

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill } from '@/components/crm/status-pill';
import { useT } from '@/lib/i18n/client';

import {
    deleteDepartmentAction,
    listDepartments,
} from '@/app/actions/crm/departments.actions';
import type { CrmDepartmentDoc } from '@/lib/rust-client/crm-departments';

const BASE = '/dashboard/hrm/payroll/departments';

type ActiveFilter = 'all' | 'active' | 'inactive';

export default function DepartmentsListPage() {
    const { t } = useT();
    const ACTIVE_OPTIONS: Array<{ value: ActiveFilter; label: string }> = [
        { value: 'all', label: t('hrm.payroll.departments.filter.all') },
        { value: 'active', label: t('hrm.payroll.departments.filter.activeOnly') },
        { value: 'inactive', label: t('hrm.payroll.departments.filter.inactiveOnly') },
    ];
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
                toast({ title: t('hrm.payroll.departments.toast.deleted') });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: t('hrm.payroll.departments.toast.error'),
                    description: result.error ?? t('hrm.payroll.departments.toast.errorDescription'),
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title={t('hrm.payroll.departments.title')}
                    subtitle={t('hrm.payroll.departments.subtitle')}
                    primaryAction={
                        <div className="flex items-center gap-2">
                            <Button variant="outline" asChild>
                                <Link href={`${BASE}/hierarchy`}>
                                    <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                                    {t('hrm.payroll.departments.action.hierarchy')}
                                </Link>
                            </Button>
                            <Button asChild>
                                <Link href={`${BASE}/new`}>
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    {t('hrm.payroll.departments.action.new')}
                                </Link>
                            </Button>
                        </div>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: t('hrm.payroll.departments.search.placeholder'),
                    }}
                    filters={
                        <Select
                            value={activeFilter}
                            onValueChange={(v) => setActiveFilter(v as ActiveFilter)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[200px]">
                                <ZoruSelectValue placeholder={t('hrm.payroll.departments.activeFilter.placeholder')} />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {ACTIVE_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    }
                    loading={isLoading && departments.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                                    <ZoruTableHead className="text-[var(--st-text-secondary)]">{t('hrm.payroll.departments.col.name')}</ZoruTableHead>
                                    <ZoruTableHead className="text-[var(--st-text-secondary)]">{t('hrm.payroll.departments.col.code')}</ZoruTableHead>
                                    <ZoruTableHead className="text-[var(--st-text-secondary)]">{t('hrm.payroll.departments.col.costCenter')}</ZoruTableHead>
                                    <ZoruTableHead className="text-[var(--st-text-secondary)]">{t('hrm.payroll.departments.col.status')}</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">{t('hrm.payroll.departments.col.actions')}</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-[var(--st-border)]">
                                        <ZoruTableCell colSpan={5} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : departments.length === 0 ? (
                                    <ZoruTableRow className="border-[var(--st-border)]">
                                        <ZoruTableCell
                                            colSpan={5}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            {t('hrm.payroll.departments.empty')}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    departments.map((d) => {
                                        const active = d.active !== false;
                                        return (
                                            <ZoruTableRow key={d._id} className="border-[var(--st-border)]">
                                                <ZoruTableCell className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${d._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {d.name}
                                                    </Link>
                                                    {d.description ? (
                                                        <div className="text-[11.5px] text-[var(--st-text-secondary)]">
                                                            {d.description}
                                                        </div>
                                                    ) : null}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {d.code ?? '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-[var(--st-text)]">
                                                    {d.costCenter ? (
                                                        <Badge variant="outline">
                                                            {d.costCenter}
                                                        </Badge>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill
                                                        label={active ? t('hrm.payroll.departments.status.active') : t('hrm.payroll.departments.status.inactive')}
                                                        tone={active ? 'green' : 'neutral'}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${d._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(d)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                                    </Button>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </Table>
                    </div>
            </EntityListShell>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>{t('hrm.payroll.departments.delete.title')}</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            {t('hrm.payroll.departments.delete.description', { name: pendingDelete?.name ?? '' })}
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>{t('hrm.payroll.departments.delete.cancel')}</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? t('hrm.payroll.departments.delete.inProgress') : t('hrm.payroll.departments.delete.confirm')}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
