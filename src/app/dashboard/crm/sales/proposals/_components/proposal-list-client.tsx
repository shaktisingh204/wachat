'use client';

/**
 * <ProposalListClient> — §1D list view for CRM proposals.
 *
 * Composes <EntityListShell> with:
 *   - KPI strip (Draft · Sent · Accepted · Closed · Total value)
 *   - Status filter + search
 *   - Dense ZoruTable with row checkboxes
 *   - Bulk delete with ConfirmDialog
 *   - CSV export
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { FileText, LayoutTemplate, Plus, Trash2, X } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { deleteProposal } from '@/app/actions/worksuite/proposals.actions';
import type { WsProposal, WsProposalStatus } from '@/lib/worksuite/proposals-types';
import { WS_PROPOSAL_STATUSES } from '@/lib/worksuite/proposals-types';

/* ─── Types ────────────────────────────────────────────────────────── */

type ProposalRow = WsProposal & { _id: string };

const STATUS_TONE: Record<WsProposalStatus, StatusTone> = {
  draft: 'neutral',
  sent: 'amber',
  accepted: 'green',
  declined: 'red',
  expired: 'red',
};

export interface ProposalKpi {
  draft: number;
  sent: number;
  accepted: number;
  closed: number;
  totalValue: number;
}

export interface ProposalListClientProps {
  proposals: ProposalRow[];
  initialQuery: string;
  kpi: ProposalKpi;
}

/* ─── KPI strip ────────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: string | number;
  active: boolean;
  onClick: () => void;
  tone?: 'green' | 'amber' | 'red' | 'neutral';
}

function KpiCard({ label, value, active, onClick, tone = 'neutral' }: KpiCardProps) {
  const toneClass =
    tone === 'green'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : tone === 'amber'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
        : tone === 'red'
          ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
          : 'border-zoru-line bg-zoru-surface-2 text-zoru-ink-muted';

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-col gap-0.5 rounded-[var(--zoru-radius)] border px-4 py-3 text-left transition-all',
        toneClass,
        active ? 'ring-2 ring-zoru-brand ring-offset-1' : 'hover:opacity-80',
      ].join(' ')}
    >
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-[11.5px]">{label}</span>
    </button>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

function fmtCurrency(value: number, currency?: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch {
    return `${currency || ''} ${(value || 0).toFixed(0)}`;
  }
}

function toCsv(rows: ProposalRow[]): string {
  const head = [
    'id',
    'proposal_number',
    'title',
    'status',
    'issue_date',
    'valid_until',
    'subtotal',
    'tax',
    'discount',
    'total',
    'currency',
  ];
  const body = rows.map((r) =>
    [
      r._id,
      r.proposal_number,
      r.title,
      r.status,
      r.issue_date ? new Date(r.issue_date as string).toLocaleDateString('en-IN') : '',
      r.valid_until ? new Date(r.valid_until as string).toLocaleDateString('en-IN') : '',
      r.subtotal,
      r.tax,
      r.discount,
      r.total,
      r.currency || 'INR',
    ]
      .map((cell) => {
        const v = String(cell ?? '');
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      })
      .join(','),
  );
  return [head.join(','), ...body].join('\n');
}

const ALL = 'all';

/* ─── Component ──────────────────────────────────────────────────────── */

export function ProposalListClient({
  proposals: serverRows,
  initialQuery,
  kpi,
}: ProposalListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  /* Search */
  const [query, setQuery] = React.useState(initialQuery);

  /* Filters */
  const [statusFilter, setStatusFilter] = React.useState<string>(ALL);

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  /* Dialogs */
  const [pendingDelete, setPendingDelete] = React.useState<ProposalRow | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);

  const [busy, startBusy] = React.useTransition();

  /* Debounce search → URL */
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (query.trim()) params.set('q', query.trim());
      else params.delete('q');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, sp, pathname, router]);

  /* In-memory filter */
  const filtered = React.useMemo(() => {
    if (statusFilter === ALL) return serverRows;
    return serverRows.filter((p) => p.status === statusFilter);
  }, [serverRows, statusFilter]);

  const filtersActive = statusFilter !== ALL;

  /* Selection helpers */
  const allIds = React.useMemo(() => filtered.map((p) => String(p._id)), [filtered]);
  const allSelectedOnPage = allIds.length > 0 && allIds.every((id) => selected.has(id));

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

  /* Single delete */
  const confirmSingleDelete = () => {
    if (!pendingDelete) return;
    const id = String(pendingDelete._id);
    const label = pendingDelete.title || pendingDelete.proposal_number;
    startBusy(async () => {
      const res = await deleteProposal(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `"${label}" removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  /* Bulk delete */
  const bulkDelete = () =>
    startBusy(async () => {
      let ok = 0;
      let fail = 0;
      for (const id of selected) {
        const res = await deleteProposal(id);
        if (res.success) ok += 1;
        else fail += 1;
      }
      toast({
        title: `Deleted ${ok}`,
        description: fail > 0 ? `${fail} failed.` : 'All selected proposals removed.',
        variant: fail > 0 ? 'destructive' : undefined,
      });
      clearSelection();
      setPendingBulkDelete(false);
      router.refresh();
    });

  /* CSV export */
  const bulkExport = React.useCallback(() => {
    const rows = filtered.filter(
      (p) => selected.size === 0 || selected.has(String(p._id)),
    );
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proposals-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${rows.length} proposals saved to CSV.` });
  }, [filtered, selected, toast]);

  /* Status filter labels */
  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    accepted: 'Accepted',
    declined: 'Declined',
    expired: 'Expired',
  };

  const kpiCards = [
    { key: 'draft', label: 'Draft', value: kpi.draft, tone: 'neutral' as const },
    { key: 'sent', label: 'Sent', value: kpi.sent, tone: 'amber' as const },
    { key: 'accepted', label: 'Accepted', value: kpi.accepted, tone: 'green' as const },
    { key: 'closed', label: 'Declined / Expired', value: kpi.closed, tone: 'red' as const },
  ];

  return (
    <>
      <EntityListShell
        title="Proposals"
        subtitle="Create, send, and track sales proposals with e-signature."
        search={{
          value: query,
          onChange: setQuery,
          placeholder: 'Search proposals…',
        }}
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/sales/proposals/templates">
                <LayoutTemplate className="h-4 w-4" /> Templates
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href="/dashboard/crm/sales/proposals/new">
                <Plus className="h-4 w-4" /> New proposal
              </Link>
            </ZoruButton>
          </div>
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            {[ALL, ...WS_PROPOSAL_STATUSES].map((s) => (
              <ZoruButton
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                onClick={() => setStatusFilter(s)}
                className="h-7 text-[12px]"
              >
                {s === ALL ? 'All' : statusLabels[s] ?? s}
              </ZoruButton>
            ))}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] text-zoru-ink">
                {selected.size} selected
              </span>
              <ZoruButton size="sm" variant="ghost" onClick={bulkExport}>
                Export CSV
              </ZoruButton>
              <ZoruButton
                size="sm"
                variant="destructive"
                onClick={() => setPendingBulkDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </ZoruButton>
              <ZoruButton size="sm" variant="ghost" onClick={clearSelection}>
                <X className="h-3.5 w-3.5" /> Clear selection
              </ZoruButton>
            </div>
          ) : null
        }
        empty={
          filtered.length === 0 && !filtersActive && !query ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <FileText className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">No proposals yet</h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Create a proposal to start sending to customers.
              </p>
              <ZoruButton asChild>
                <Link href="/dashboard/crm/sales/proposals/new">
                  <Plus className="h-4 w-4" /> New proposal
                </Link>
              </ZoruButton>
            </div>
          ) : null
        }
      >
        <div className="flex flex-col gap-5">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpiCards.map((card) => (
              <KpiCard
                key={card.key}
                label={card.label}
                value={card.value}
                tone={card.tone}
                active={statusFilter === card.key}
                onClick={() =>
                  setStatusFilter((prev) =>
                    prev === card.key ? ALL : card.key,
                  )
                }
              />
            ))}
            <div className="flex flex-col gap-0.5 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 px-4 py-3">
              <span className="text-xl font-semibold tabular-nums text-zoru-ink">
                {fmtCurrency(
                  kpi.totalValue,
                  serverRows[0]?.currency,
                )}
              </span>
              <span className="text-[11.5px] text-zoru-ink-muted">Total value</span>
            </div>
          </div>

          <ZoruCard className="overflow-hidden p-0">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead className="w-[36px]">
                    <ZoruCheckbox
                      checked={allSelectedOnPage}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </ZoruTableHead>
                  <ZoruTableHead>Number</ZoruTableHead>
                  <ZoruTableHead>Title</ZoruTableHead>
                  <ZoruTableHead>Issued</ZoruTableHead>
                  <ZoruTableHead>Valid until</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead className="text-right">Total</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {filtered.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={7}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      {filtersActive || query
                        ? 'No proposals match these filters.'
                        : 'No proposals yet — click "New proposal" to add one.'}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  filtered.map((p) => {
                    const id = String(p._id);
                    const isSelected = selected.has(id);
                    return (
                      <ZoruTableRow
                        key={id}
                        data-state={isSelected ? 'selected' : undefined}
                      >
                        <ZoruTableCell>
                          <ZoruCheckbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(id)}
                            aria-label={`Select ${p.proposal_number}`}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <EntityRowLink
                            href={`/dashboard/crm/sales/proposals/${id}`}
                            label={p.proposal_number}
                            subtitle={p.title || undefined}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                          {p.title || '—'}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                          {fmtDate(p.issue_date)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                          {fmtDate(p.valid_until)}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill
                            label={p.status}
                            tone={STATUS_TONE[p.status] ?? 'neutral'}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink">
                          {fmtCurrency(p.total || 0, p.currency)}
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })
                )}
              </ZoruTableBody>
            </ZoruTable>
          </ZoruCard>
        </div>
      </EntityListShell>

      {/* Single-row delete */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete proposal?"
        description={
          pendingDelete
            ? `This permanently removes "${pendingDelete.title || pendingDelete.proposal_number}". This action cannot be undone.`
            : 'This permanently removes the proposal. This action cannot be undone.'
        }
        requireTyped="DELETE"
        confirmLabel="Delete permanently"
        onConfirm={async () => confirmSingleDelete()}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={pendingBulkDelete}
        onOpenChange={setPendingBulkDelete}
        title={`Delete ${selected.size} proposal${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected proposals and their line items. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => bulkDelete()}
      />

      {busy ? <span className="sr-only">Working…</span> : null}
    </>
  );
}
