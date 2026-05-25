'use client';

import {
  Button,
  Card,
  Checkbox,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter,
  useSearchParams,
  usePathname } from 'next/navigation';
import { Plus,
  Repeat } from 'lucide-react';

/**
 * <SubscriptionListClient> — canonical Subscriptions list view per
 * CRM_REBUILD_PLAN §1D.1.
 *
 * Composes <EntityListShell> internally (matches the canonical Invoices
 * list at `src/app/dashboard/crm/sales/invoices/_components/invoice-list-client.tsx`):
 *
 *   - KPI strip (Active · Trial · Past-due · Churned · MRR) — each card
 *     is a filter chip that pivots the list status
 *   - Filter row (client picker + EnumFilterField for status + frequency +
 *     renewal-mode dropdowns)
 *   - Dense table with row checkboxes
 *   - Bulk-action bar (pause / resume / cancel / export CSV / delete)
 *   - Hard-delete confirmation dialog
 *
 * Filter changes stay client-side and re-derive from the server-fetched
 * page rows; status-status filter does NOT push to URL today — the Rust
 * BFF `list` accepts a `status` param but only one at a time, and the
 * KPI strip already pivots on the in-memory window. A follow-up can hoist
 * the filter chain to URL state when it ships server-side pagination
 * for filtered windows.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import {
  cancelSubscription,
  deleteSubscriptionAction,
  pauseSubscription,
  resumeSubscription,
  type SubscriptionKpiSnapshot,
} from '@/app/actions/crm/subscriptions.actions';
import type { CrmSubscriptionDoc } from '@/lib/rust-client/crm-subscriptions';

import { SubscriptionKpiStrip, type SubscriptionKpiKey } from './subscription-kpi-strip';
import { SubscriptionFilters } from './subscription-filters';
import { SubscriptionBulkBar } from './subscription-bulk-bar';

const ALL = 'all';

interface SubscriptionListClientProps {
  subscriptions: CrmSubscriptionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  kpi: SubscriptionKpiSnapshot;
  error?: string;
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

function frequencyLabel(f: CrmSubscriptionDoc['frequency']): string {
  switch (f) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
    case 'yearly':
      return 'Yearly';
    case 'custom':
      return 'Custom';
    default:
      return String(f);
  }
}

function lineTotal(s: CrmSubscriptionDoc): {
  amount?: number;
  currency?: string;
} {
  const item = s.items?.[0];
  if (!item) return {};
  const qty = typeof item.qty === 'number' ? item.qty : 0;
  const rate = typeof item.rate === 'number' ? item.rate : 0;
  return { amount: qty * rate, currency: item.currency };
}

function displayLabel(s: CrmSubscriptionDoc): string {
  return `Subscription ${String(s._id).slice(-6)}`;
}

function toCsv(rows: CrmSubscriptionDoc[]): string {
  const head = [
    'id',
    'customerId',
    'frequency',
    'status',
    'startedAt',
    'nextBillingAt',
    'trialUntil',
    'currency',
    'amount',
    'createdAt',
  ];
  const body = rows.map((r) => {
    const { amount, currency } = lineTotal(r);
    return [
      String(r._id),
      r.customerId ?? '',
      r.frequency ?? '',
      r.status ?? '',
      r.startedAt ?? '',
      r.nextBillingAt ?? '',
      r.trialUntil ?? '',
      currency ?? '',
      typeof amount === 'number' ? amount : '',
      r.createdAt ?? r.audit?.createdAt ?? '',
    ]
      .map((cell) => {
        const v = String(cell ?? '');
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      })
      .join(',');
  });
  return [head.join(','), ...body].join('\n');
}

export function SubscriptionListClient({
  subscriptions: serverRows,
  page,
  limit,
  hasMore,
  initialQuery,
  kpi,
  error,
}: SubscriptionListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  /* Search */
  const [query, setQuery] = React.useState(initialQuery);

  /* Filters */
  const [statusFilter, setStatusFilter] = React.useState<string>(ALL);
  const [customerFilter, setCustomerFilter] = React.useState<string | null>(null);
  const [frequencyFilter, setFrequencyFilter] = React.useState<string>(ALL);
  const [renewalFilter, setRenewalFilter] = React.useState<string>(ALL);

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  /* Pending confirmation dialogs */
  const [pendingDelete, setPendingDelete] = React.useState<CrmSubscriptionDoc | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);
  const [pendingBulkCancel, setPendingBulkCancel] = React.useState(false);

  const [busy, startBusy] = React.useTransition();

  /* Debounce search → URL so the server component re-fetches with `q`. */
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (query.trim()) params.set('q', query.trim());
      else params.delete('q');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, sp, pathname, router]);

  /* KPI chip → status filter pivot. */
  const onKpiSelect = React.useCallback((key: SubscriptionKpiKey) => {
    if (key === null) {
      setStatusFilter(ALL);
      return;
    }
    if (key === 'churned') {
      // Synthetic preset — flip to a sentinel that the filter step
      // expands into cancelled|expired.
      setStatusFilter('__churned__');
      return;
    }
    setStatusFilter(key);
  }, []);

  const activeKpi: SubscriptionKpiKey = (() => {
    if (statusFilter === 'active') return 'active';
    if (statusFilter === 'trial') return 'trial';
    if (statusFilter === 'past_due') return 'past_due';
    if (statusFilter === '__churned__') return 'churned';
    return null;
  })();

  /* In-memory filter. */
  const filtered = React.useMemo(() => {
    return serverRows.filter((s) => {
      if (statusFilter !== ALL) {
        if (statusFilter === '__churned__') {
          if (s.status !== 'cancelled' && s.status !== 'expired') return false;
        } else if (s.status !== statusFilter) return false;
      }
      if (customerFilter && s.customerId !== customerFilter) return false;
      if (frequencyFilter !== ALL && s.frequency !== frequencyFilter) return false;
      if (renewalFilter !== ALL && s.renewalMode !== renewalFilter) return false;
      return true;
    });
  }, [serverRows, statusFilter, customerFilter, frequencyFilter, renewalFilter]);

  const filtersActive =
    statusFilter !== ALL ||
    Boolean(customerFilter) ||
    frequencyFilter !== ALL ||
    renewalFilter !== ALL;

  const clearFilters = React.useCallback(() => {
    setStatusFilter(ALL);
    setCustomerFilter(null);
    setFrequencyFilter(ALL);
    setRenewalFilter(ALL);
  }, []);

  /* Selection helpers. */
  const allIds = React.useMemo(() => filtered.map((s) => String(s._id)), [filtered]);
  const allSelectedOnPage =
    allIds.length > 0 && allIds.every((id) => selected.has(id));

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
      if (allIds.length === 0) return prev;
      const allSel = allIds.every((id) => prev.has(id));
      if (allSel) {
        const next = new Set(prev);
        for (const id of allIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of allIds) next.add(id);
      return next;
    });
  }, [allIds]);

  const clearSelection = React.useCallback(() => setSelected(new Set()), []);

  /* Single-row delete. */
  const confirmDelete = () => {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const label = displayLabel(pendingDelete);
    startBusy(async () => {
      const res = await deleteSubscriptionAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  /* Bulk actions — iterate; the Rust BFF lacks a bulk endpoint today. */
  const bulkApply = React.useCallback(
    async (fn: (id: string) => Promise<{ success: boolean; error?: string }>) => {
      let ok = 0;
      let fail = 0;
      for (const id of selected) {
        const res = await fn(id);
        if (res.success) ok += 1;
        else fail += 1;
      }
      return { ok, fail };
    },
    [selected],
  );

  const bulkPause = () =>
    startBusy(async () => {
      const { ok, fail } = await bulkApply(pauseSubscription);
      toast({
        title: `Paused ${ok}`,
        description: fail > 0 ? `${fail} failed.` : 'Selected subscriptions paused.',
        variant: fail > 0 ? 'destructive' : undefined,
      });
      clearSelection();
      router.refresh();
    });

  const bulkResume = () =>
    startBusy(async () => {
      const { ok, fail } = await bulkApply(resumeSubscription);
      toast({
        title: `Resumed ${ok}`,
        description: fail > 0 ? `${fail} failed.` : 'Selected subscriptions resumed.',
        variant: fail > 0 ? 'destructive' : undefined,
      });
      clearSelection();
      router.refresh();
    });

  const bulkCancel = () =>
    startBusy(async () => {
      const { ok, fail } = await bulkApply(cancelSubscription);
      toast({
        title: `Cancelled ${ok}`,
        description: fail > 0 ? `${fail} failed.` : 'Selected subscriptions cancelled.',
        variant: fail > 0 ? 'destructive' : undefined,
      });
      clearSelection();
      setPendingBulkCancel(false);
      router.refresh();
    });

  const bulkDelete = () =>
    startBusy(async () => {
      const { ok, fail } = await bulkApply(deleteSubscriptionAction);
      toast({
        title: `Deleted ${ok}`,
        description: fail > 0 ? `${fail} failed.` : 'All selected removed.',
        variant: fail > 0 ? 'destructive' : undefined,
      });
      clearSelection();
      setPendingBulkDelete(false);
      router.refresh();
    });

  const bulkExport = React.useCallback(() => {
    const rows = filtered.filter(
      (s) => selected.size === 0 || selected.has(String(s._id)),
    );
    if (rows.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'Filter or select rows first.',
      });
      return;
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Exported',
      description: `${rows.length} subscriptions saved to CSV.`,
    });
  }, [filtered, selected, toast]);

  return (
    <>
      <EntityListShell
        title="Subscriptions & Recurring"
        subtitle="Manage recurring billing plans, renewals, and dunning workflows."
        search={{
          value: query,
          onChange: setQuery,
          placeholder: 'Search subscriptions…',
        }}
        primaryAction={
          <Button asChild>
            <Link href="/dashboard/crm/sales/subscriptions/new">
              <Plus className="h-4 w-4" /> New subscription
            </Link>
          </Button>
        }
        bulkBar={
          selected.size > 0 ? (
            <SubscriptionBulkBar
              count={selected.size}
              onClear={clearSelection}
              onExportCsv={bulkExport}
              onPause={bulkPause}
              onResume={bulkResume}
              onCancel={() => setPendingBulkCancel(true)}
              onDelete={() => setPendingBulkDelete(true)}
            />
          ) : null
        }
        empty={
          filtered.length === 0 && !filtersActive && !query ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <Repeat className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">
                No subscriptions yet
              </h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Create a recurring billing agreement to start collecting MRR.
              </p>
              <Button asChild>
                <Link href="/dashboard/crm/sales/subscriptions/new">
                  <Plus className="h-4 w-4" /> New subscription
                </Link>
              </Button>
            </div>
          ) : null
        }
        pagination={
          <PaginationBar page={page} limit={limit} hasMore={hasMore} />
        }
      >
        <div className="flex flex-col gap-5">
          {/* KPI strip */}
          <SubscriptionKpiStrip
            kpi={kpi}
            active={activeKpi}
            onSelect={onKpiSelect}
          />

          {error ? (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
              {error}
            </div>
          ) : null}

          <Card className="overflow-hidden p-0">
            <SubscriptionFilters
              filtersActive={filtersActive}
              onClearAll={clearFilters}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              customerFilter={customerFilter}
              onCustomerFilter={setCustomerFilter}
              frequencyFilter={frequencyFilter}
              onFrequencyFilter={setFrequencyFilter}
              renewalFilter={renewalFilter}
              onRenewalFilter={setRenewalFilter}
            />

            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead className="w-[36px]">
                    <Checkbox
                      checked={allSelectedOnPage}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </ZoruTableHead>
                  <ZoruTableHead>Customer</ZoruTableHead>
                  <ZoruTableHead>Plan / item</ZoruTableHead>
                  <ZoruTableHead>Cadence</ZoruTableHead>
                  <ZoruTableHead className="text-right">Amount</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead>Next billing</ZoruTableHead>
                  <ZoruTableHead>Started</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {filtered.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={8}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      {filtersActive || query
                        ? 'No subscriptions match these filters.'
                        : 'No subscriptions yet — click "New subscription" to add one.'}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  filtered.map((sub) => {
                    const id = String(sub._id);
                    const { amount, currency } = lineTotal(sub);
                    const firstItemId = sub.items?.[0]?.itemId;
                    const isSelected = selected.has(id);
                    return (
                      <ZoruTableRow
                        key={id}
                        data-state={isSelected ? 'selected' : undefined}
                      >
                        <ZoruTableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(id)}
                            aria-label={`Select ${displayLabel(sub)}`}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell>
                          {sub.customerId ? (
                            <EntityPickerChip
                              entity="client"
                              id={sub.customerId}
                            />
                          ) : (
                            <span className="text-[12.5px] text-zoru-ink-muted">
                              —
                            </span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <EntityRowLink
                            href={`/dashboard/crm/sales/subscriptions/${id}`}
                            label={
                              firstItemId ? (
                                <EntityPickerChip
                                  entity="item"
                                  id={firstItemId}
                                />
                              ) : (
                                displayLabel(sub)
                              )
                            }
                            subtitle={frequencyLabel(sub.frequency)}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                          {frequencyLabel(sub.frequency)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink">
                          {fmtMoney(amount, currency)}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill
                            label={sub.status.replace(/_/g, ' ')}
                            tone={statusToTone(sub.status)}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                          {fmtDate(sub.nextBillingAt)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                          {fmtDate(
                            sub.startedAt ||
                              sub.createdAt ||
                              sub.audit?.createdAt,
                          )}
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })
                )}
              </ZoruTableBody>
            </Table>
          </Card>
        </div>
      </EntityListShell>

      {/* Single-row delete */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete subscription?"
        description={
          pendingDelete
            ? `This permanently removes ${displayLabel(pendingDelete)} from the database. The action cannot be undone.`
            : 'This permanently removes the subscription. The action cannot be undone.'
        }
        requireTyped="DELETE"
        confirmLabel="Delete permanently"
        onConfirm={async () => confirmDelete()}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={pendingBulkDelete}
        onOpenChange={setPendingBulkDelete}
        title={`Delete ${selected.size} subscription${
          selected.size === 1 ? '' : 's'
        }?`}
        description="This permanently removes the selected subscriptions. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => bulkDelete()}
      />

      {/* Bulk cancel */}
      <ConfirmDialog
        open={pendingBulkCancel}
        onOpenChange={setPendingBulkCancel}
        title={`Cancel ${selected.size} subscription${
          selected.size === 1 ? '' : 's'
        }?`}
        description="Cancelled subscriptions stop renewing. They remain in the database but no further invoices will be generated."
        confirmLabel="Cancel subscriptions"
        confirmTone="primary"
        onConfirm={async () => bulkCancel()}
      />

      {busy ? <span className="sr-only">Working…</span> : null}
    </>
  );
}
