'use client';

/**
 * Contract Renewals list — `/dashboard/crm/contracts/renewals`.
 *
 * Ships:
 *   - KPI strip: total renewals, expiring in 30 days, expiring in 60 days,
 *     expired (past to_date)
 *   - Filter row: search by contract_id, from/to date range
 *   - Table: contract ref (EntityRowLink), from date, to date, new value,
 *     days remaining badge, actions
 *   - Checkbox selection
 *   - Bulk delete with confirm
 *   - Export CSV
 */

import * as React from 'react';

import { Alert, AlertTitle, AlertDescription, Badge, Button, Card, Checkbox, Input, Label, Skeleton, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Clock,
  Download,
  RefreshCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  getContractRenewals,
  deleteContractRenewal,
  sendExpirationReminder,
} from '@/app/actions/worksuite/contracts-ext.actions';
import type { WsContractRenew } from '@/lib/worksuite/contracts-ext-types';

type Row = WsContractRenew & { _id: string };

/* ─── Helpers ──────────────────────────────────────────────────────── */

function daysUntil(dateStr: string | Date | undefined): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

function DaysRemaining({ toDate }: { toDate: Date | undefined }) {
  const days = daysUntil(toDate);
  if (days === null) return <span className="text-[var(--st-text-secondary)]">—</span>;
  if (days < 0)
    return <Badge variant="destructive">Expired {Math.abs(days)}d ago</Badge>;
  if (days <= 30) return <Badge variant="warning">{days}d left</Badge>;
  if (days <= 60) return <Badge variant="info">{days}d left</Badge>;
  return <Badge variant="outline">{days}d left</Badge>;
}

/* ─── KPI card ─────────────────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  highlight?: 'warn' | 'danger';
}) {
  const bg =
    highlight === 'danger'
      ? 'border-destructive/30 bg-[var(--st-text)]/5'
      : highlight === 'warn'
        ? 'border-[var(--st-border)]/40 bg-[var(--st-bg-muted)]/40 dark:bg-[var(--st-text)]/10'
        : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)]';
  return (
    <div className={`kpi-card flex flex-col gap-1 rounded-lg border p-3 ${bg}`}>
      <div className="flex items-center gap-1.5 text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
        {icon}
        {label}
      </div>
      <span className="text-xl font-semibold text-[var(--st-text)]">{value}</span>
    </div>
  );
}

/* ─── Component ────────────────────────────────────────────────────── */

export default function ContractRenewalsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [isLoading, startLoading] = React.useTransition();
  const [bulkPending, startBulkTransition] = React.useTransition();

  /* Filters */
  const [search, setSearch] = React.useState('');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  /* Dialogs */
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [bulkDeletePending, setBulkDeletePending] = React.useState(false);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const data = await getContractRenewals();
      setRows(data as unknown as Row[]);
    });
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const containerRef = React.useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (isLoading) return;
      
      gsap.fromTo(
        '.kpi-card',
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.05, duration: 0.3, ease: 'power2.out', clearProps: 'all' }
      );

      gsap.fromTo(
        '.table-row-animate',
        { x: -10, opacity: 0 },
        { x: 0, opacity: 1, stagger: 0.03, duration: 0.25, ease: 'power1.out', clearProps: 'all' }
      );
    },
    { scope: containerRef, dependencies: [rows, filtered, isLoading] }
  );

  /* KPI computations */
  const now = Date.now();
  const kpi = React.useMemo(() => {
    let expiredCount = 0;
    let due30 = 0;
    let due60 = 0;
    for (const r of rows) {
      const d = daysUntil(r.to_date);
      if (d === null) continue;
      if (d < 0) expiredCount += 1;
      else if (d <= 30) due30 += 1;
      else if (d <= 60) due60 += 1;
    }
    return { total: rows.length, expiredCount, due30, due60 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, now]);

  /* Filtered list */
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() : null;
    return rows.filter((r) => {
      if (q && !String(r.contract_id ?? '').toLowerCase().includes(q)) return false;
      if (fromTs && r.to_date) {
        const t = new Date(r.to_date).getTime();
        if (!Number.isNaN(t) && t < fromTs) return false;
      }
      if (toTs && r.to_date) {
        const t = new Date(r.to_date).getTime();
        if (!Number.isNaN(t) && t > toTs) return false;
      }
      return true;
    });
  }, [rows, search, fromDate, toDate]);

  const filtersActive = Boolean(search) || Boolean(fromDate) || Boolean(toDate);

  const allSelectedOnPage =
    filtered.length > 0 && filtered.every((r) => selected.has(r._id));

  const toggleRow = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      const allSel = filtered.every((r) => prev.has(r._id));
      if (allSel) {
        const next = new Set(prev);
        for (const r of filtered) next.delete(r._id);
        return next;
      }
      const next = new Set(prev);
      for (const r of filtered) next.add(r._id);
      return next;
    });
  }, [filtered]);

  /* Delete single */
  const handleDelete = React.useCallback(async () => {
    if (!deletingId) return;
    const res = await deleteContractRenewal(deletingId);
    if (res.success) {
      toast({ title: 'Renewal deleted.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({ title: 'Error', description: res.error || 'Failed to delete', variant: 'destructive' });
    }
  }, [deletingId, refresh, toast]);

  /* Bulk delete */
  const runBulkDelete = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      let failed = 0;
      for (const id of ids) {
        const res = await deleteContractRenewal(id);
        if (!res.success) failed += 1;
      }
      if (failed === 0) {
        toast({ title: `${ids.length} renewal${ids.length === 1 ? '' : 's'} deleted` });
      } else {
        toast({
          title: `${ids.length - failed} deleted, ${failed} failed`,
          variant: 'destructive',
        });
      }
      setSelected(new Set());
      router.refresh();
      refresh();
    });
  }, [selected, router, toast, refresh]);

  /* Bulk remind */
  const runBulkRemind = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    
    const selectedRows = filtered.filter(r => selected.has(r._id));
    
    startBulkTransition(async () => {
      let failed = 0;
      for (const row of selectedRows) {
        const res = await sendExpirationReminder(row.contract_id);
        if (!res.success) failed += 1;
      }
      if (failed === 0) {
        toast({ title: `Sent reminders for ${ids.length} contract${ids.length === 1 ? '' : 's'}` });
      } else {
        toast({
          title: `Sent ${ids.length - failed} reminders, ${failed} failed`,
          variant: 'destructive',
        });
      }
      setSelected(new Set());
    });
  }, [selected, filtered, toast]);

  /* Export CSV */
  const handleExportCsv = React.useCallback(() => {
    const exportRows = filtered.filter((r) => selected.size === 0 || selected.has(r._id));
    if (exportRows.length === 0) {
      toast({ title: 'Nothing to export' });
      return;
    }
    downloadCsv(
      `contract-renewals-${dateStamp()}.csv`,
      ['Contract ID', 'From Date', 'To Date', 'New Value', 'Days Remaining'],
      exportRows.map((r) => ({
        'Contract ID': r.contract_id,
        'From Date': r.from_date ? new Date(r.from_date).toLocaleDateString() : '',
        'To Date': r.to_date ? new Date(r.to_date).toLocaleDateString() : '',
        'New Value': r.new_value ?? '',
        'Days Remaining': daysUntil(r.to_date) ?? '',
      })),
    );
    toast({ title: 'Exported', description: `${exportRows.length} renewals saved to CSV.` });
  }, [filtered, selected, toast]);

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <>
      <EntityListShell
        title="Contract Renewals"
        subtitle="Track renewed contract periods, updated values, and upcoming renewal deadlines."
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search by contract ID…',
        }}
        filters={
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Renewal date — from
              </Label>
              <Input
                type="date"
                className="h-8 w-[140px] text-[13px]"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Renewal date — to
              </Label>
              <Input
                type="date"
                className="h-8 w-[140px] text-[13px]"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            {filtersActive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setFromDate('');
                  setToDate('');
                }}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            ) : null}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{selected.size} selected</Badge>
              <Button size="sm" variant="outline" onClick={handleExportCsv}>
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={runBulkRemind}
                disabled={bulkPending}
              >
                <Clock className="h-3.5 w-3.5" /> Remind
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeletePending(true)}
                disabled={bulkPending}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          ) : null
        }
      >
        <div ref={containerRef} className="space-y-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Total renewals"
            value={kpi.total.toLocaleString()}
            icon={<RefreshCcw className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="Due in 30 days"
            value={kpi.due30.toLocaleString()}
            icon={<Clock className="h-3.5 w-3.5" />}
            highlight="warn"
          />
          <KpiCard
            label="Due in 60 days"
            value={kpi.due60.toLocaleString()}
            icon={<Calendar className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="Expired"
            value={kpi.expiredCount.toLocaleString()}
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            highlight={kpi.expiredCount > 0 ? 'danger' : undefined}
          />
        </div>

        {/* Alerts for overdue or upcoming renewals */}
        {kpi.expiredCount > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Action Required: Overdue Renewals</AlertTitle>
            <AlertDescription>
              There {kpi.expiredCount === 1 ? 'is' : 'are'} {kpi.expiredCount} expired contract renewal{kpi.expiredCount === 1 ? '' : 's'} that require immediate attention.
            </AlertDescription>
          </Alert>
        )}
        
        {kpi.due30 > 0 && (
          <Alert variant="warning" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Upcoming Renewals</AlertTitle>
            <AlertDescription>
              There {kpi.due30 === 1 ? 'is' : 'are'} {kpi.due30} contract renewal{kpi.due30 === 1 ? '' : 's'} due within the next 30 days.
            </AlertDescription>
          </Alert>
        )}

        {/* Export */}
        <div className="flex items-center justify-end">
          <Button size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                  <Th className="w-10 pl-3">
                    <Checkbox
                      checked={allSelectedOnPage}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </Th>
                  <Th>Contract</Th>
                  <Th>From date</Th>
                  <Th>To date</Th>
                  <Th className="text-right">New value</Th>
                  <Th>Status</Th>
                  <Th className="w-[80px] text-right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {isLoading && rows.length === 0 ? (
                  [...Array(4)].map((_, i) => (
                    <Tr key={i} className="border-[var(--st-border)]">
                      <Td colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </Td>
                    </Tr>
                  ))
                ) : filtered.length === 0 ? (
                  <Tr>
                    <Td
                      colSpan={7}
                      className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                    >
                      {filtersActive
                        ? 'No renewals match the current filters.'
                        : 'No contract renewals recorded yet.'}
                    </Td>
                  </Tr>
                ) : (
                  filtered.map((r) => (
                    <Tr key={r._id} className="table-row-animate border-[var(--st-border)]">
                      <Td className="pl-3">
                        <Checkbox
                          checked={selected.has(r._id)}
                          onCheckedChange={() => toggleRow(r._id)}
                          aria-label={`Select renewal ${r._id}`}
                        />
                      </Td>
                      <Td>
                        <EntityRowLink
                          href={`/dashboard/crm/contracts/${r.contract_id}`}
                          label={r.contract_id}
                        />
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text-secondary)]">
                        {r.from_date ? new Date(r.from_date).toLocaleDateString() : '—'}
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text-secondary)]">
                        {r.to_date ? new Date(r.to_date).toLocaleDateString() : '—'}
                      </Td>
                      <Td className="text-right text-[13px] font-medium text-[var(--st-text)]">
                        {r.new_value != null ? r.new_value.toLocaleString() : '—'}
                      </Td>
                      <Td>
                        <DaysRemaining toDate={r.to_date} />
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              toast({ title: 'Sending reminder...' });
                              startBulkTransition(async () => {
                                const res = await sendExpirationReminder(r.contract_id);
                                if (res.success) toast({ title: 'Sent', description: res.message });
                                else toast({ title: 'Failed', variant: 'destructive' });
                              });
                            }}
                            aria-label="Send reminder"
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingId(r._id)}
                            aria-label="Delete renewal"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[var(--st-text)]" />
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

      {/* Single delete */}
      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="Delete this renewal?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={bulkDeletePending}
        onOpenChange={setBulkDeletePending}
        title={`Delete ${selected.size} renewal${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected contract renewals. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={runBulkDelete}
      />

      {bulkPending ? <span className="sr-only">Working…</span> : null}
    </>
  );
}
