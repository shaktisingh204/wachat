'use client';

/**
 * Disciplinary Cases — §1D deep list page.
 *
 * KPI strip (4): Total · Open · Resolved · Warnings issued
 * Filters: status · severity · search
 * Bulk: close · archive · delete
 * Export: CSV
 *
 * Converted from server component to client component for selection +
 * bulk-action state. Data fetched via `getDisciplinaryCases()` server
 * action (multi-tenant, scoped by getSession).
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
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
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  bulkArchiveDisciplinaryCases,
  bulkCloseDisciplinaryCases,
  bulkDeleteDisciplinaryCases,
  getDisciplinaryCases,
  getDisciplinaryKpis,
  type HrDisciplinaryCase,
  type HrDisciplinaryKpis,
} from '@/app/actions/hr.actions';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'closed', label: 'Closed' },
];

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All severities' },
  { value: 'verbal_warning', label: 'Verbal warning' },
  { value: 'written_warning', label: 'Written warning' },
  { value: 'minor', label: 'Minor' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

function statusVariant(
  status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status ?? '').toLowerCase();
  if (['resolved', 'dismissed', 'closed'].includes(s)) return 'success';
  if (['open', 'under_review'].includes(s)) return 'ghost';
  if (['critical', 'high'].includes(s)) return 'danger';
  return 'warning';
}

const EMPTY_KPIS: HrDisciplinaryKpis = {
  total: 0,
  open: 0,
  resolved: 0,
  warningsIssued: 0,
};

export default function DisciplinaryPage(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<HrDisciplinaryCase[]>([]);
  const [kpis, setKpis] = React.useState<HrDisciplinaryKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [severityFilter, setSeverityFilter] = React.useState<string>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = React.useState<
    'close' | 'archive' | 'delete' | null
  >(null);
  const [busy, startTransition] = React.useTransition();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, k] = await Promise.all([
        getDisciplinaryCases(),
        getDisciplinaryKpis(),
      ]);
      setRows(data);
      setKpis(k);
    } catch {
      setRows([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (
        statusFilter !== 'all' &&
        (c.status ?? 'open').toLowerCase() !== statusFilter
      ) {
        return false;
      }
      if (
        severityFilter !== 'all' &&
        (c.severity ?? '').toLowerCase() !== severityFilter
      ) {
        return false;
      }
      if (q) {
        const hay = [
          c.caseNo ?? '',
          c.employeeName ?? '',
          c.type ?? '',
          c.raisedByName ?? '',
          c.decision ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, severityFilter]);

  const allSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c._id));

  const toggleAll = (v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) for (const c of filtered) next.add(c._id);
      else for (const c of filtered) next.delete(c._id);
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

  const hasFilters =
    !!search.trim() || statusFilter !== 'all' || severityFilter !== 'all';

  const handleExport = () => {
    const source =
      selected.size > 0
        ? filtered.filter((c) => selected.has(c._id))
        : filtered;
    downloadCsv(
      `disciplinary-cases-${dateStamp()}.csv`,
      ['Case no.', 'Employee', 'Severity', 'Type', 'Raised by', 'Status', 'Decision'],
      source.map((c) => ({
        'Case no.': c.caseNo ?? c._id,
        Employee: c.employeeName ?? c.employeeId ?? '',
        Severity: c.severity ?? '',
        Type: c.type ?? '',
        'Raised by': c.raisedByName ?? c.raisedById ?? '',
        Status: c.status ?? '',
        Decision: c.decision ?? '',
      })),
    );
  };

  const runBulk = (op: 'close' | 'archive' | 'delete') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      let res: { success: boolean; error?: string };
      if (op === 'close') {
        const r = await bulkCloseDisciplinaryCases(ids);
        res = { success: r.success, error: r.error };
      } else if (op === 'archive') {
        const r = await bulkArchiveDisciplinaryCases(ids);
        res = { success: r.success, error: r.error };
      } else {
        const r = await bulkDeleteDisciplinaryCases(ids);
        res = { success: r.success, error: r.error };
      }
      if (res.success) {
        toast({
          title: `${ids.length} case${ids.length === 1 ? '' : 's'} ${
            op === 'close'
              ? 'closed'
              : op === 'archive'
                ? 'archived'
                : 'deleted'
          }`,
        });
        setSelected(new Set());
        setPendingBulk(null);
        await refresh();
      } else {
        toast({
          title: 'Bulk action failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <>
      <EntityListShell
        title="Disciplinary Cases"
        subtitle="Record warnings, investigations and outcomes of disciplinary action."
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
            <ZoruButton variant="outline" size="sm" asChild>
              <Link href="/dashboard/crm/hr/disciplinary/new">
                <Plus className="h-4 w-4" /> New case
              </Link>
            </ZoruButton>
          </div>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search by employee, type, decision…',
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect value={statusFilter} onValueChange={setStatusFilter}>
              <ZoruSelectTrigger className="h-9 w-[170px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect value={severityFilter} onValueChange={setSeverityFilter}>
              <ZoruSelectTrigger className="h-9 w-[180px]">
                <ZoruSelectValue placeholder="Severity" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {SEVERITY_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            {hasFilters ? (
              <ZoruButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setSeverityFilter('all');
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
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5" /> Export selected
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setPendingBulk('close')}
                >
                  Close
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setPendingBulk('archive')}
                >
                  Archive
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setPendingBulk('delete')}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && rows.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total cases', value: kpis.total, cls: 'text-zoru-ink' },
              {
                label: 'Open',
                value: kpis.open,
                cls: 'text-zoru-warning-ink',
              },
              {
                label: 'Resolved',
                value: kpis.resolved,
                cls: 'text-zoru-success-ink',
              },
              {
                label: 'Warnings issued',
                value: kpis.warningsIssued,
                cls: 'text-zoru-ink',
              },
            ].map((k) => (
              <ZoruCard key={k.label} className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                  {k.label}
                </p>
                <p
                  className={`mt-1 text-[20px] font-semibold leading-tight ${k.cls}`}
                >
                  {k.value}
                </p>
              </ZoruCard>
            ))}
          </div>

          {/* Table */}
          <ZoruCard className="p-0">
            <div className="overflow-x-auto rounded-[var(--zoru-radius)]">
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
                    <ZoruTableHead className="text-zoru-ink-muted">
                      Case no.
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">
                      Employee
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">
                      Severity
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">
                      Raised by
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">
                      Decision
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">
                      Status
                    </ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {isLoading ? (
                    <ZoruTableRow className="border-zoru-line">
                      <ZoruTableCell colSpan={8} className="h-24 text-center">
                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : filtered.length === 0 ? (
                    <ZoruTableRow className="border-zoru-line">
                      <ZoruTableCell
                        colSpan={8}
                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                      >
                        {hasFilters
                          ? 'No cases match these filters.'
                          : 'No disciplinary cases yet. Log an incident to start a confidential trail.'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    filtered.map((c) => {
                      const isSelected = selected.has(c._id);
                      return (
                        <ZoruTableRow key={c._id} className="border-zoru-line">
                          <ZoruTableCell>
                            <ZoruCheckbox
                              aria-label={`Select case ${c.caseNo ?? c._id}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(c._id)}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                            <EntityRowLink
                              href={`/dashboard/crm/hr/disciplinary/${c._id}`}
                              label={c.caseNo ?? c._id.slice(-6)}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {c.employeeName ?? c.employeeId ?? '—'}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ZoruBadge variant={statusVariant(c.severity)}>
                              {c.severity ?? 'minor'}
                            </ZoruBadge>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {c.type ?? '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {c.raisedByName ?? c.raisedById ?? '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {c.decision ?? '—'}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ZoruBadge variant={statusVariant(c.status)}>
                              {c.status ?? 'open'}
                            </ZoruBadge>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })
                  )}
                </ZoruTableBody>
              </ZoruTable>
            </div>
          </ZoruCard>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={pendingBulk === 'close'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Close ${selected.size} case${selected.size === 1 ? '' : 's'}?`}
        description="Their status will be set to closed."
        confirmTone="primary"
        confirmLabel="Close cases"
        onConfirm={() => runBulk('close')}
      />

      <ConfirmDialog
        open={pendingBulk === 'archive'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Archive ${selected.size} case${selected.size === 1 ? '' : 's'}?`}
        description="Archived cases are hidden from the active list but kept for audit."
        confirmTone="primary"
        confirmLabel="Archive"
        onConfirm={() => runBulk('archive')}
      />

      <ConfirmDialog
        open={pendingBulk === 'delete'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Delete ${selected.size} case${selected.size === 1 ? '' : 's'}?`}
        description="Permanent — cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={() => runBulk('delete')}
      />
    </>
  );
}
