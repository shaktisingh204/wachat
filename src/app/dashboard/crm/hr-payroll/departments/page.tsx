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
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCheckbox,
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
import {
  Building2,
  CheckCircle2,
  Download,
  Edit,
  GitBranch,
  ListChecks,
  LoaderCircle,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';

/**
 * Departments — list page (canonical, Rust-backed).
 *
 * Adds KPI strip, bulk delete, and CSV export on top of the
 * existing search + active filter + table.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill } from '@/components/crm/status-pill';
import { useT } from '@/lib/i18n/client';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  deleteDepartmentAction,
  listDepartments,
} from '@/app/actions/crm/departments.actions';
import type { CrmDepartmentDoc } from '@/lib/rust-client/crm-departments';

const BASE = '/dashboard/crm/hr-payroll/departments';

type ActiveFilter = 'all' | 'active' | 'inactive';

interface DeptKpi {
  total: number;
  active: number;
  withPositions: number;
  headcount: number;
}

function computeKpi(items: CrmDepartmentDoc[]): DeptKpi {
  const total = items.length;
  const active = items.filter((d) => d.active !== false).length;
  // headCount field may come from Rust doc; fall back to 0
  const headcount = items.reduce(
    (s, d) => s + ((d as Record<string, unknown>).headCount as number | undefined ?? 0),
    0,
  );
  // "with open positions" — approximate via openPositions field if available
  const withPositions = items.filter(
    (d) =>
      ((d as Record<string, unknown>).openPositions as number | undefined ?? 0) > 0,
  ).length;
  return { total, active, withPositions, headcount };
}

interface KpiPillProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}

function KpiPill({ icon, label, value }: KpiPillProps) {
  return (
    <ZoruCard>
      <ZoruCardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink-muted">
          {icon}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            {label}
          </p>
          <p className="text-[18px] font-semibold leading-tight text-zoru-ink">
            {value}
          </p>
        </div>
      </ZoruCardContent>
    </ZoruCard>
  );
}

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
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);
  const [bulkDeleting, startBulkDelete] = React.useTransition();
  const { toast } = useZoruToast();

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
              activeFilter === 'active' ? d.active !== false : d.active === false,
            );
      setDepartments(filtered);
    } catch {
      setDepartments([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, activeFilter]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  // Clear selection when data changes
  React.useEffect(() => {
    setSelected(new Set());
  }, [departments]);

  const kpi = React.useMemo(() => computeKpi(departments), [departments]);

  /* ── Selection helpers ── */
  const headChecked =
    departments.length > 0 && departments.every((d) => selected.has(d._id));

  const toggleAll = (all: boolean) =>
    setSelected(all ? new Set(departments.map((d) => d._id)) : new Set());

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ── Single delete ── */
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
          description:
            result.error ?? t('hrm.payroll.departments.toast.errorDescription'),
          variant: 'destructive',
        });
      }
    });
  };

  /* ── Bulk delete ── */
  const runBulkDelete = () => {
    if (selected.size === 0) return;
    setBulkConfirmOpen(false);
    const ids = Array.from(selected);
    startBulkDelete(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        const res = await deleteDepartmentAction(id);
        if (res.success) ok += 1;
        else failed += 1;
      }
      toast({
        title:
          failed === 0
            ? `${ok} department${ok === 1 ? '' : 's'} deleted`
            : `${ok} deleted · ${failed} failed`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
      setSelected(new Set());
      await refresh();
    });
  };

  /* ── Export CSV ── */
  const handleExportCsv = () => {
    const headers = ['Name', 'Code', 'Cost Center', 'Status', 'Description'];
    const exportRows = departments.map((d) => ({
      Name: d.name,
      Code: d.code ?? '',
      'Cost Center': d.costCenter ?? '',
      Status: d.active !== false ? 'Active' : 'Inactive',
      Description: d.description ?? '',
    }));
    downloadCsv(`departments-${dateStamp()}.csv`, headers, exportRows);
  };

  return (
    <>
      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiPill icon={<Building2 className="h-4 w-4" />} label="Total" value={kpi.total} />
        <KpiPill icon={<CheckCircle2 className="h-4 w-4" />} label="Active" value={kpi.active} />
        <KpiPill icon={<GitBranch className="h-4 w-4" />} label="With open positions" value={kpi.withPositions} />
        <KpiPill icon={<Users className="h-4 w-4" />} label="Headcount" value={kpi.headcount} />
      </div>

      <EntityListShell
        title={t('hrm.payroll.departments.title')}
        subtitle={t('hrm.payroll.departments.subtitle')}
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              CSV
            </ZoruButton>
            <ZoruButton variant="outline" asChild>
              <Link href={`${BASE}/hierarchy`}>
                <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                {t('hrm.payroll.departments.action.hierarchy')}
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t('hrm.payroll.departments.action.new')}
              </Link>
            </ZoruButton>
          </div>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t('hrm.payroll.departments.search.placeholder'),
        }}
        filters={
          <ZoruSelect
            value={activeFilter}
            onValueChange={(v) => setActiveFilter(v as ActiveFilter)}
          >
            <ZoruSelectTrigger className="h-9 w-[200px]">
              <ZoruSelectValue
                placeholder={t('hrm.payroll.departments.activeFilter.placeholder')}
              />
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
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                <ListChecks className="h-4 w-4 text-zoru-primary" />
                {selected.size} selected
              </div>
              <div className="flex items-center gap-1">
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkConfirmOpen(true)}
                  disabled={bulkDeleting}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(new Set())}
                  aria-label="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && departments.length === 0}
      >
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-8">
                  <ZoruCheckbox
                    checked={headChecked}
                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  {t('hrm.payroll.departments.col.name')}
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  {t('hrm.payroll.departments.col.code')}
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  {t('hrm.payroll.departments.col.costCenter')}
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  {t('hrm.payroll.departments.col.status')}
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  {t('hrm.payroll.departments.col.actions')}
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={6} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : departments.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-zoru-ink-muted"
                  >
                    {t('hrm.payroll.departments.empty')}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                departments.map((d) => {
                  const active = d.active !== false;
                  const checked = selected.has(d._id);
                  return (
                    <ZoruTableRow key={d._id} className="border-zoru-line">
                      <ZoruTableCell>
                        <ZoruCheckbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(d._id)}
                          aria-label={`Select ${d.name}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        <EntityRowLink
                          href={`${BASE}/${d._id}`}
                          label={d.name}
                          subtitle={d.description || undefined}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                        {d.code ?? '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {d.costCenter ? (
                          <ZoruBadge variant="outline">{d.costCenter}</ZoruBadge>
                        ) : (
                          '—'
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill
                          label={
                            active
                              ? t('hrm.payroll.departments.status.active')
                              : t('hrm.payroll.departments.status.inactive')
                          }
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

      {/* Single delete confirm */}
      <ZoruAlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              {t('hrm.payroll.departments.delete.title')}
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {t('hrm.payroll.departments.delete.description', {
                name: pendingDelete?.name ?? '',
              })}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>
              {t('hrm.payroll.departments.delete.cancel')}
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
              {deletePending
                ? t('hrm.payroll.departments.delete.inProgress')
                : t('hrm.payroll.departments.delete.confirm')}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Bulk delete confirm */}
      <ZoruAlertDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete {selected.size} department{selected.size === 1 ? '' : 's'}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes the selected departments. This action cannot
              be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={runBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? 'Deleting…' : 'Delete all'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
