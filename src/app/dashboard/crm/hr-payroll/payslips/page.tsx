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
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCheckbox,
  ZoruInput,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  BadgeIndianRupee,
  CheckCheck,
  Download,
  Eye,
  FileText,
  ListChecks,
  LoaderCircle,
  MailCheck,
  Trash2,
  X,
} from 'lucide-react';

/**
 * Payslips — list page (Rust-backed).
 *
 * Adds KPI strip, bulk mark-dispatched (issued), bulk delete, and CSV export.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  getPayslipsList,
  acknowledgePayslipAction,
  archivePayslipAction,
} from '@/app/actions/crm-payslips.actions';
import type {
  CrmPayslipDoc,
  CrmPayslipStatus,
} from '@/lib/rust-client/crm-payslips';

const BASE = '/dashboard/crm/hr-payroll/payslips';

const STATUS_TONE: Record<CrmPayslipStatus, StatusTone> = {
  draft: 'amber',
  issued: 'blue',
  paid: 'green',
  archived: 'neutral',
};

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtPeriod(p: string | undefined): string {
  if (!p) return '—';
  const m = /^(\d{4})-(\d{2})/.exec(p);
  if (!m) return p;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return d.toLocaleString('default', { month: 'short', year: 'numeric' });
}

interface PayslipKpi {
  total: number;
  issuedThisMonth: number;
  pendingDispatch: number;
  netPaidThisMonth: number;
}

function computeKpi(items: CrmPayslipDoc[]): PayslipKpi {
  const now = new Date();
  const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const issuedThisMonth = items.filter(
    (p) => (p.payPeriod ?? '').startsWith(curYM),
  ).length;
  const pendingDispatch = items.filter((p) => p.status === 'draft').length;
  const netPaidThisMonth = items
    .filter(
      (p) =>
        (p.payPeriod ?? '').startsWith(curYM) &&
        (p.status === 'paid' || p.status === 'issued'),
    )
    .reduce((s, p) => s + (p.net ?? 0), 0);
  return { total: items.length, issuedThisMonth, pendingDispatch, netPaidThisMonth };
}

interface KpiPillProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
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

export default function PayslipsListPage() {
  const [rows, setRows] = React.useState<CrmPayslipDoc[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<CrmPayslipStatus | 'all'>(
    'all',
  );
  const [payPeriod, setPayPeriod] = React.useState<string>('');

  // Bulk
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = React.useState<'dispatch' | 'delete' | null>(
    null,
  );
  const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);
  const [bulkPending, startBulkTransition] = React.useTransition();

  const { toast } = useZoruToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getPayslipsList({
        q: search.trim() || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        payPeriod: payPeriod || undefined,
        limit: 100,
      });
      setRows(res.items ?? []);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, payPeriod]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh();
    }, 250);
    return () => window.clearTimeout(t);
  }, [refresh]);

  React.useEffect(() => {
    setSelected(new Set());
  }, [rows]);

  const kpi = React.useMemo(() => computeKpi(rows), [rows]);

  /* ── Selection ── */
  const headChecked =
    rows.length > 0 && rows.every((p) => selected.has(p._id));

  const toggleAll = (all: boolean) =>
    setSelected(all ? new Set(rows.map((p) => p._id)) : new Set());

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ── Bulk dispatch (mark issued) ── */
  const openBulkDispatch = () => {
    setBulkAction('dispatch');
    setBulkConfirmOpen(true);
  };

  /* ── Bulk delete (archive) ── */
  const openBulkDelete = () => {
    setBulkAction('delete');
    setBulkConfirmOpen(true);
  };

  const runBulkAction = () => {
    if (!bulkAction || selected.size === 0) return;
    setBulkConfirmOpen(false);
    const ids = Array.from(selected);
    startBulkTransition(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        const res =
          bulkAction === 'dispatch'
            ? await acknowledgePayslipAction(id)
            : await archivePayslipAction(id);
        if (res.success) ok += 1;
        else failed += 1;
      }
      const verb = bulkAction === 'dispatch' ? 'dispatched' : 'archived';
      toast({
        title:
          failed === 0
            ? `${ok} payslip${ok === 1 ? '' : 's'} ${verb}`
            : `${ok} ${verb} · ${failed} failed`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
      setSelected(new Set());
      setBulkAction(null);
      await refresh();
    });
  };

  /* ── Export CSV ── */
  const handleExportCsv = () => {
    const headers = [
      'Employee',
      'Pay period',
      'Gross',
      'Net',
      'Status',
      'Issued at',
    ];
    const exportRows = rows.map((p) => ({
      Employee: p.employeeName ?? p.employeeId ?? '',
      'Pay period': fmtPeriod(p.payPeriod),
      Gross: p.gross ?? 0,
      Net: p.net ?? 0,
      Status: p.status ?? '',
      'Issued at': fmtDate(p.issuedAt),
    }));
    downloadCsv(`payslips-${dateStamp()}.csv`, headers, exportRows);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiPill icon={<FileText className="h-4 w-4" />} label="Total payslips" value={kpi.total} />
        <KpiPill
          icon={<CheckCheck className="h-4 w-4" />}
          label="Issued this month"
          value={kpi.issuedThisMonth}
        />
        <KpiPill
          icon={<MailCheck className="h-4 w-4" />}
          label="Pending dispatch"
          value={kpi.pendingDispatch}
        />
        <KpiPill
          icon={<BadgeIndianRupee className="h-4 w-4" />}
          label="Net paid this month"
          value={inr.format(kpi.netPaidThisMonth)}
        />
      </div>

      <EntityListShell
        title="Payslips"
        subtitle="Issued payslips by employee and pay period."
        primaryAction={
          <ZoruButton variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </ZoruButton>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search by employee…',
        }}
        filters={
          <>
            <EnumFilterField
              enumName="payslipStatus"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as CrmPayslipStatus | 'all')}
              allLabel="All statuses"
            />
            <ZoruInput
              type="month"
              className="h-9 w-[160px]"
              value={payPeriod}
              onChange={(e) => setPayPeriod(e.target.value)}
              placeholder="Pay period"
            />
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                <ListChecks className="h-4 w-4 text-zoru-primary" />
                {selected.size} selected
              </div>
              <div className="flex items-center gap-2">
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={openBulkDispatch}
                  disabled={bulkPending}
                >
                  <MailCheck className="h-3.5 w-3.5" /> Mark dispatched
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  onClick={openBulkDelete}
                  disabled={bulkPending}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Archive
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
        loading={isLoading && rows.length === 0}
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
                <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Pay period</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Gross</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Net</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Issued at</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={8} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : rows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={8} className="h-24 text-center text-zoru-ink-muted">
                    No payslips match this filter.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((p) => {
                  const status = (p.status ?? 'draft') as CrmPayslipStatus;
                  const tone = STATUS_TONE[status] ?? 'neutral';
                  const checked = selected.has(p._id);
                  return (
                    <ZoruTableRow key={p._id} className="border-zoru-line">
                      <ZoruTableCell>
                        <ZoruCheckbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(p._id)}
                          aria-label={`Select payslip for ${p.employeeName ?? p.employeeId}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        <EntityRowLink
                          href={`${BASE}/${p._id}`}
                          label={p.employeeName ?? p.employeeId ?? '—'}
                          subtitle={fmtPeriod(p.payPeriod)}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {fmtPeriod(p.payPeriod)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right font-mono text-zoru-ink">
                        {inr.format(p.gross ?? 0)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right font-mono text-zoru-ink">
                        {inr.format(p.net ?? 0)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill label={status} tone={tone} />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {fmtDate(p.issuedAt)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <ZoruButton variant="ghost" size="icon" asChild>
                          <Link href={`${BASE}/${p._id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
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

      {/* Bulk confirm dialog */}
      <ZoruAlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              {bulkAction === 'dispatch'
                ? `Mark ${selected.size} payslip${selected.size === 1 ? '' : 's'} as dispatched?`
                : `Archive ${selected.size} payslip${selected.size === 1 ? '' : 's'}?`}
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {bulkAction === 'dispatch'
                ? 'This marks the selected payslips as issued/dispatched.'
                : 'This archives the selected payslips. This action cannot be undone.'}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={runBulkAction} disabled={bulkPending}>
              {bulkPending
                ? 'Saving…'
                : bulkAction === 'dispatch'
                  ? 'Mark dispatched'
                  : 'Archive all'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
