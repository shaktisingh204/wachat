'use client';

/**
 * Weekly Timesheets — §1D deep list page.
 *
 * KPI strip (4): Total · Submitted · Approved · Rejected
 * Filters: status · employee · week start range
 * Bulk: approve · reject · delete
 * Export: CSV
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Download,
  Edit,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruInput,
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

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  deleteCrmTimesheet,
  getCrmTimesheets,
  type CrmTimesheetDoc,
  type CrmTimesheetStatus,
} from '@/app/actions/crm-timesheets.actions';
import {
  bulkApproveTimesheets,
  bulkDeleteTimesheets,
  bulkRejectTimesheets,
  getTimesheetKpis,
  type HrTimesheetKpis,
} from '@/app/actions/hr.actions';

const BASE = '/dashboard/crm/hr/timesheets';

const STATUS_OPTIONS: Array<{ value: CrmTimesheetStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<CrmTimesheetStatus, StatusTone> = {
  draft: 'neutral',
  submitted: 'amber',
  approved: 'green',
  rejected: 'red',
  archived: 'neutral',
};

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

const EMPTY_KPIS: HrTimesheetKpis = { total: 0, submitted: 0, approved: 0, rejected: 0 };

export default function TimesheetsListPage(): React.JSX.Element {
  const [timesheets, setTimesheets] = React.useState<CrmTimesheetDoc[]>([]);
  const [kpis, setKpis] = React.useState<HrTimesheetKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<CrmTimesheetStatus | 'all'>('all');
  const [weekFrom, setWeekFrom] = React.useState('');
  const [weekTo, setWeekTo] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = React.useState<CrmTimesheetDoc | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState<'approve' | 'reject' | 'delete' | null>(null);
  const [busy, startTransition] = React.useTransition();
  const { toast } = useZoruToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [res, k] = await Promise.all([
        getCrmTimesheets({
          q: search.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          weekStartFrom: weekFrom || undefined,
          weekStartTo: weekTo || undefined,
          limit: 200,
        }),
        getTimesheetKpis(),
      ]);
      setTimesheets(res ?? []);
      setKpis(k);
    } catch {
      setTimesheets([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, weekFrom, weekTo]);

  React.useEffect(() => {
    const t = window.setTimeout(() => { void refresh(); }, 250);
    return () => window.clearTimeout(t);
  }, [refresh]);

  const allSelected =
    timesheets.length > 0 && timesheets.every((t) => selected.has(t._id));

  const toggleAll = (v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) for (const t of timesheets) next.add(t._id);
      else for (const t of timesheets) next.delete(t._id);
      return next;
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

  const hasFilters = !!search.trim() || statusFilter !== 'all' || !!weekFrom || !!weekTo;

  const handleExport = () => {
    const source =
      selected.size > 0 ? timesheets.filter((t) => selected.has(t._id)) : timesheets;
    downloadCsv(
      `timesheets-${dateStamp()}.csv`,
      ['Employee', 'Week start', 'Week end', 'Total hours', 'Status'],
      source.map((t) => ({
        Employee: t.employeeName || t.employeeId || '',
        'Week start': fmtDate(t.weekStartDate),
        'Week end': fmtDate(t.weekEndDate),
        'Total hours': t.totalHours.toFixed(2),
        Status: t.status,
      })),
    );
  };

  const handleSingleDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    startTransition(async () => {
      const result = await deleteCrmTimesheet(id);
      if (result.success) {
        toast({ title: 'Timesheet deleted' });
        setPendingDelete(null);
        await refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Could not delete timesheet.',
          variant: 'destructive',
        });
      }
    });
  };

  const runBulk = (op: 'approve' | 'reject' | 'delete') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      let res: { success: boolean; error?: string };
      if (op === 'approve') {
        const r = await bulkApproveTimesheets(ids);
        res = { success: r.success, error: r.error };
      } else if (op === 'reject') {
        const r = await bulkRejectTimesheets(ids);
        res = { success: r.success, error: r.error };
      } else {
        const r = await bulkDeleteTimesheets(ids);
        res = { success: r.success, error: r.error };
      }
      if (res.success) {
        toast({
          title: `${ids.length} timesheets ${op === 'approve' ? 'approved' : op === 'reject' ? 'rejected' : 'deleted'}`,
        });
        setSelected(new Set());
        setPendingBulk(null);
        await refresh();
      } else {
        toast({ title: 'Bulk action failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  return (
    <>
      <EntityListShell
        title="Weekly Timesheets"
        subtitle="Weekly time records per employee with submit / approve workflow."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5" /> Export
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuItem onSelect={handleExport}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Download CSV
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New timesheet
              </Link>
            </ZoruButton>
          </div>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search by employee, notes…',
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as CrmTimesheetStatus | 'all')}
            >
              <ZoruSelectTrigger className="h-9 w-[180px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>{o.label}</ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruInput
              type="date"
              value={weekFrom}
              onChange={(e) => setWeekFrom(e.target.value)}
              className="h-9 w-[160px] text-[13px]"
              aria-label="Week start from"
            />
            <ZoruInput
              type="date"
              value={weekTo}
              onChange={(e) => setWeekTo(e.target.value)}
              className="h-9 w-[160px] text-[13px]"
              aria-label="Week start to"
            />
            {hasFilters ? (
              <ZoruButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setWeekFrom('');
                  setWeekTo('');
                }}
              >
                <X className="h-3.5 w-3.5" /> Reset
              </ZoruButton>
            ) : null}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-zoru-ink">{selected.size} selected</span>
              <div className="flex flex-wrap gap-2">
                <ZoruButton size="sm" variant="outline" onClick={() => setSelected(new Set())}>
                  Clear
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5" /> Export selected
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" disabled={busy} onClick={() => runBulk('approve')}>
                  Approve
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" disabled={busy} onClick={() => setPendingBulk('reject')}>
                  Reject
                </ZoruButton>
                <ZoruButton size="sm" variant="destructive" disabled={busy} onClick={() => setPendingBulk('delete')}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && timesheets.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Total sheets', value: kpis.total },
              { label: 'Submitted', value: kpis.submitted },
              { label: 'Approved', value: kpis.approved },
              { label: 'Rejected', value: kpis.rejected },
            ].map((k) => (
              <ZoruCard key={k.label} className="p-3">
                <p className="text-xs text-zoru-ink-muted">{k.label}</p>
                <p className="mt-1 text-xl font-semibold text-zoru-ink">{k.value}</p>
              </ZoruCard>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                  <ZoruTableHead className="w-10">
                    <ZoruCheckbox
                      aria-label="Select all"
                      checked={allSelected}
                      onCheckedChange={(v) => toggleAll(Boolean(v))}
                    />
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Week</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Total Hrs</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading ? (
                  <ZoruTableRow className="border-zoru-line">
                    <ZoruTableCell colSpan={6} className="h-24 text-center">
                      <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : timesheets.length === 0 ? (
                  <ZoruTableRow className="border-zoru-line">
                    <ZoruTableCell colSpan={6} className="h-24 text-center text-zoru-ink-muted">
                      No timesheets match this filter.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  timesheets.map((t) => {
                    const tone = STATUS_TONE[t.status] ?? 'neutral';
                    const isSelected = selected.has(t._id);
                    return (
                      <ZoruTableRow key={t._id} className="border-zoru-line">
                        <ZoruTableCell>
                          <ZoruCheckbox
                            aria-label={`Select timesheet for ${t.employeeName ?? t.employeeId}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(t._id)}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="font-medium text-zoru-ink">
                          <EntityRowLink
                            href={`${BASE}/${t._id}`}
                            label={t.employeeName || t.employeeId}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-zoru-ink">
                          {fmtDate(t.weekStartDate)} &rarr; {fmtDate(t.weekEndDate)}
                        </ZoruTableCell>
                        <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                          {t.totalHours.toFixed(2)}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill label={t.status} tone={tone} />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <ZoruButton variant="ghost" size="icon" asChild>
                            <Link href={`${BASE}/${t._id}`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </ZoruButton>
                          <ZoruButton
                            variant="ghost"
                            size="icon"
                            onClick={() => setPendingDelete(t)}
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
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete timesheet?"
        description={
          pendingDelete
            ? `Deleting this timesheet for "${pendingDelete.employeeName || pendingDelete.employeeId}" cannot be undone.`
            : ''
        }
        confirmLabel={busy ? 'Deleting…' : 'Delete'}
        onConfirm={handleSingleDelete}
      />

      <ConfirmDialog
        open={pendingBulk === 'reject'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Reject ${selected.size} timesheets?`}
        description="Their status will be set to rejected. Employees will need to resubmit."
        confirmTone="primary"
        confirmLabel="Reject all"
        onConfirm={() => runBulk('reject')}
      />

      <ConfirmDialog
        open={pendingBulk === 'delete'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Delete ${selected.size} timesheets?`}
        description="Permanent — cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={() => runBulk('delete')}
      />
    </>
  );
}
