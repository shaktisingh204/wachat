'use client';

/**
 * CRM Contract Renewals — interactive renewal queue.
 *
 * Surfaces every active contract whose `expiryDate` is within the next 90
 * days, sorted by soonest expiry first.
 *
 * Features: KPI strip, urgency-bucket filters, ZoruCheckbox bulk selection,
 * Send Renewal Notice + Mark Renewed bulk actions, CSV/XLSX export.
 *
 * RBAC: crm_contract (view / edit).
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  FileSignature,
  Bell,
  CheckCircle,
  Download,
} from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCheckbox,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruInput,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import {
  listContracts,
  sendRenewalNotices,
  bulkMarkRenewed,
} from '@/app/actions/crm-contracts.actions';

/* ─── Constants ──────────────────────────────────────────────────── */

const CONTRACTS_BASE = '/dashboard/crm/sales/contracts';
const RENEWAL_WINDOW_DAYS = 90;

/* ─── Types ──────────────────────────────────────────────────────── */

interface RenewalRow {
  _id: string;
  title?: string;
  partyB?: string;
  counterparty?: string;
  partyName?: string;
  contractType?: string;
  status?: string;
  effectiveDate?: string;
  expiryDate?: string;
  autoRenew?: boolean;
  value?: number;
  currency?: string;
}

type UrgencyBucket = 'all' | '0-30' | '31-60' | '61-90';

/* ─── Pure helpers ───────────────────────────────────────────────── */

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function daysBetween(now: Date, then: Date): number {
  const ms = then.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function urgencyTone(daysLeft: number): StatusTone {
  if (daysLeft <= 14) return 'red';
  if (daysLeft <= 30) return 'amber';
  return 'blue';
}

function urgencyLabel(daysLeft: number): string {
  if (daysLeft < 0) return `${Math.abs(daysLeft)}d overdue`;
  if (daysLeft === 0) return 'expires today';
  return `${daysLeft}d left`;
}

function urgencyBucket(daysLeft: number): UrgencyBucket {
  if (daysLeft <= 30) return '0-30';
  if (daysLeft <= 60) return '31-60';
  return '61-90';
}

/* ─── KPI strip ──────────────────────────────────────────────────── */

interface KpiStripProps {
  rows: RenewalRow[];
  loading: boolean;
}

function KpiStrip({ rows, loading }: KpiStripProps) {
  const now = React.useMemo(() => new Date(), []);

  const stats = React.useMemo(() => {
    let due30 = 0;
    let due60 = 0;
    let autoOn = 0;
    for (const r of rows) {
      if (!r.expiryDate) continue;
      const d = new Date(r.expiryDate);
      if (Number.isNaN(d.getTime())) continue;
      const days = daysBetween(now, d);
      if (days <= 30) due30 += 1;
      if (days <= 60) due60 += 1;
      if (r.autoRenew) autoOn += 1;
    }
    return { total: rows.length, due30, due60, autoOn };
  }, [rows, now]);

  const tiles = [
    { label: 'Pending renewals', value: stats.total },
    { label: 'Due in 30 days', value: stats.due30 },
    { label: 'Due in 60 days', value: stats.due60 },
    { label: 'Auto-renewal on', value: stats.autoOn },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <ZoruCard key={t.label}>
          <ZoruCardHeader className="pb-1 pt-4">
            <ZoruCardTitle className="text-[12px] font-medium text-zoru-ink-muted">
              {t.label}
            </ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="pb-4">
            {loading ? (
              <div className="h-6 w-12 animate-pulse rounded bg-zoru-surface-2" />
            ) : (
              <p className="text-xl font-semibold text-zoru-ink">{t.value}</p>
            )}
          </ZoruCardContent>
        </ZoruCard>
      ))}
    </div>
  );
}

/* ─── Bulk bar ───────────────────────────────────────────────────── */

interface BulkBarProps {
  selectedIds: string[];
  onNotice: () => void;
  onRenew: () => void;
  onCsvExport: () => void;
  onXlsxExport: () => void;
  busy: boolean;
}

function BulkBar({
  selectedIds,
  onNotice,
  onRenew,
  onCsvExport,
  onXlsxExport,
  busy,
}: BulkBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-zoru-ink">
        {selectedIds.length} selected
      </span>
      <ZoruButton
        variant="outline"
        size="sm"
        onClick={onNotice}
        disabled={busy}
      >
        <Bell className="mr-1.5 h-3.5 w-3.5" />
        Send Renewal Notice
      </ZoruButton>
      <ZoruButton
        variant="outline"
        size="sm"
        onClick={onRenew}
        disabled={busy}
      >
        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
        Mark Renewed
      </ZoruButton>
      <ZoruButton
        variant="ghost"
        size="sm"
        onClick={onCsvExport}
        disabled={busy}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        CSV
      </ZoruButton>
      <ZoruButton
        variant="ghost"
        size="sm"
        onClick={onXlsxExport}
        disabled={busy}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        XLSX
      </ZoruButton>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */

export default function ContractRenewalsPage() {
  const nowRef = React.useRef(new Date());
  const now = nowRef.current;

  const [rows, setRows] = React.useState<RenewalRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Filters
  const [search, setSearch] = React.useState('');
  const [bucketFilter, setBucketFilter] = React.useState<UrgencyBucket>('all');
  const [autoRenewFilter, setAutoRenewFilter] = React.useState<'all' | 'yes' | 'no'>('all');

  // Selection
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  /* Load on mount — reuse listContracts with the expiring90 window */
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      // Fetch up to 200 contracts expiring in the next 90 days.
      // listContracts uses 'expiring30' for 30-day window; we need the
      // full 90-day window so we query with status 'active' and filter
      // client-side for the horizon.
      const result = await listContracts(1, 200, undefined, 'active');

      if (cancelled) return;

      if (result.error) {
        setLoadError(result.error);
        setLoading(false);
        return;
      }

      const horizon = new Date(
        now.getTime() + RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );

      const renewalRows = (result.contracts as Record<string, unknown>[])
        .filter((c) => {
          if (!c.expiryDate) return false;
          const d = new Date(c.expiryDate as string);
          if (Number.isNaN(d.getTime())) return false;
          return d >= now && d <= horizon;
        })
        .sort((a, b) => {
          const da = new Date(a.expiryDate as string).getTime();
          const db = new Date(b.expiryDate as string).getTime();
          return da - db;
        })
        .map((c) => ({
          _id: String(c._id),
          title: c.title as string | undefined,
          partyB: c.partyB as string | undefined,
          counterparty: c.counterparty as string | undefined,
          partyName: c.partyName as string | undefined,
          contractType: c.contractType as string | undefined,
          status: c.status as string | undefined,
          effectiveDate: c.effectiveDate
            ? String(c.effectiveDate)
            : undefined,
          expiryDate: c.expiryDate ? String(c.expiryDate) : undefined,
          autoRenew: Boolean(c.autoRenew),
          value: typeof c.value === 'number' ? c.value : undefined,
          currency: c.currency as string | undefined,
        }));

      setRows(renewalRows);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [now]);

  /* Filtered rows */
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const title = (r.title ?? '').toLowerCase();
        const party =
          (r.partyB ?? r.counterparty ?? r.partyName ?? '').toLowerCase();
        if (!title.includes(q) && !party.includes(q)) return false;
      }
      if (bucketFilter !== 'all' && r.expiryDate) {
        const d = new Date(r.expiryDate);
        if (!Number.isNaN(d.getTime())) {
          const days = daysBetween(now, d);
          if (urgencyBucket(days) !== bucketFilter) return false;
        }
      }
      if (autoRenewFilter === 'yes' && !r.autoRenew) return false;
      if (autoRenewFilter === 'no' && r.autoRenew) return false;
      return true;
    });
  }, [rows, search, bucketFilter, autoRenewFilter, now]);

  /* Selection helpers */
  const allVisibleIds = filtered.map((r) => r._id);
  const allChecked =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selected.has(id));
  const someChecked =
    !allChecked && allVisibleIds.some((id) => selected.has(id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        allVisibleIds.forEach((id) => next.delete(id));
      } else {
        allVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = [...selected];

  /* Bulk send notice */
  async function handleNotice() {
    if (!selectedIds.length) return;
    setBusy(true);
    await sendRenewalNotices(selectedIds);
    setSelected(new Set());
    setBusy(false);
  }

  /* Bulk mark renewed */
  async function handleRenew() {
    if (!selectedIds.length) return;
    setBusy(true);
    await bulkMarkRenewed(selectedIds);
    setRows((prev) => prev.filter((r) => !selected.has(r._id)));
    setSelected(new Set());
    setBusy(false);
  }

  /* Export helpers */
  function exportRows() {
    const target = selectedIds.length > 0
      ? filtered.filter((r) => selected.has(r._id))
      : filtered;
    return target.map((r) => {
      const days = r.expiryDate
        ? daysBetween(now, new Date(r.expiryDate))
        : 0;
      return {
        title: r.title ?? '',
        counterparty: r.partyB ?? r.counterparty ?? r.partyName ?? '',
        contractType: r.contractType ?? '',
        expiryDate: fmtDate(r.expiryDate),
        daysLeft: days,
        autoRenew: r.autoRenew ? 'Yes' : 'No',
        value: r.value ?? '',
        currency: r.currency ?? '',
      };
    });
  }

  function handleCsvExport() {
    const headers = [
      'title',
      'counterparty',
      'contractType',
      'expiryDate',
      'daysLeft',
      'autoRenew',
      'value',
      'currency',
    ];
    downloadCsv(`renewals-${dateStamp()}.csv`, headers, exportRows());
  }

  async function handleXlsxExport() {
    const headers = [
      'title',
      'counterparty',
      'contractType',
      'expiryDate',
      'daysLeft',
      'autoRenew',
      'value',
      'currency',
    ];
    await downloadXlsx(
      `renewals-${dateStamp()}.xlsx`,
      headers,
      exportRows(),
      'Renewals',
    );
  }

  return (
    <EntityListShell
      title="Contract renewals"
      subtitle={`Active contracts expiring within ${RENEWAL_WINDOW_DAYS} days — soonest first.`}
      primaryAction={
        <ZoruButton variant="outline" asChild>
          <Link href={CONTRACTS_BASE}>
            <FileSignature className="mr-2 h-4 w-4" />
            All contracts
          </Link>
        </ZoruButton>
      }
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <ZoruInput
            type="search"
            placeholder="Search by title or client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <ZoruSelect
            value={bucketFilter}
            onValueChange={(v) => setBucketFilter(v as UrgencyBucket)}
          >
            <ZoruSelectTrigger className="w-44">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All urgency</ZoruSelectItem>
              <ZoruSelectItem value="0-30">0 – 30 days</ZoruSelectItem>
              <ZoruSelectItem value="31-60">31 – 60 days</ZoruSelectItem>
              <ZoruSelectItem value="61-90">61 – 90 days</ZoruSelectItem>
            </ZoruSelectContent>
          </ZoruSelect>
          <ZoruSelect
            value={autoRenewFilter}
            onValueChange={(v) =>
              setAutoRenewFilter(v as 'all' | 'yes' | 'no')
            }
          >
            <ZoruSelectTrigger className="w-40">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">Auto-renew: all</ZoruSelectItem>
              <ZoruSelectItem value="yes">Auto-renew: on</ZoruSelectItem>
              <ZoruSelectItem value="no">Auto-renew: off</ZoruSelectItem>
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
      }
      bulkBar={
        selectedIds.length > 0 ? (
          <BulkBar
            selectedIds={selectedIds}
            onNotice={() => void handleNotice()}
            onRenew={() => void handleRenew()}
            onCsvExport={handleCsvExport}
            onXlsxExport={() => void handleXlsxExport()}
            busy={busy}
          />
        ) : null
      }
    >
      {/* KPI strip */}
      <KpiStrip rows={rows} loading={loading} />

      {/* Renewal table */}
      <ZoruCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <div>
            <p className="text-[15px] font-medium text-zoru-ink">
              Renewal queue
            </p>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              Click a contract title to open and renew, extend or archive.
            </p>
          </div>
          <div className="flex gap-2">
            <ZoruButton
              variant="ghost"
              size="sm"
              onClick={handleCsvExport}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              CSV
            </ZoruButton>
            <ZoruButton
              variant="ghost"
              size="sm"
              onClick={() => void handleXlsxExport()}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              XLSX
            </ZoruButton>
          </div>
        </div>

        <div className="overflow-x-auto rounded-b-lg border-t border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-10">
                  <ZoruCheckbox
                    checked={
                      allChecked || (someChecked ? 'indeterminate' : false)
                    }
                    onCheckedChange={toggleAll}
                    aria-label="Select all visible"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  Title
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  Counterparty
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  Type
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  Expiry
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  Days left
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">
                  Auto-renew
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted text-right">
                  Open
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Loading renewals…
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-red-500"
                  >
                    {loadError}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : filtered.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    {rows.length === 0
                      ? `Nothing expiring in the next ${RENEWAL_WINDOW_DAYS} days.`
                      : 'No contracts match your filters.'}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((c) => {
                  const expiry = c.expiryDate
                    ? new Date(c.expiryDate)
                    : null;
                  const daysLeft =
                    expiry && !Number.isNaN(expiry.getTime())
                      ? daysBetween(now, expiry)
                      : 0;
                  const counterparty =
                    c.partyB ?? c.counterparty ?? c.partyName ?? '—';
                  return (
                    <ZoruTableRow
                      key={c._id}
                      className="border-zoru-line"
                    >
                      <ZoruTableCell>
                        <ZoruCheckbox
                          checked={selected.has(c._id)}
                          onCheckedChange={() => toggleOne(c._id)}
                          aria-label={`Select ${c.title ?? c._id}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        <EntityRowLink
                          href={`${CONTRACTS_BASE}/${c._id}`}
                          label={c.title ?? 'Untitled contract'}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {counterparty}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {c.contractType ?? '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {fmtDate(c.expiryDate)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill
                          label={urgencyLabel(daysLeft)}
                          tone={urgencyTone(daysLeft)}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {c.autoRenew ? (
                          <ZoruBadge variant="success">On</ZoruBadge>
                        ) : (
                          <ZoruBadge variant="ghost">Off</ZoruBadge>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link href={`${CONTRACTS_BASE}/${c._id}`}>
                            Open
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
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
      </ZoruCard>
    </EntityListShell>
  );
}
