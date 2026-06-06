'use client';

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
import {
  CalendarRange,
  Download,
  Search,
  Trash2,
  Truck,
  X,
  } from 'lucide-react';

/**
 * Pure presentational bits used by `<SalesOrdersListClient>`. Split
 * out to keep the parent file under the 600-line per-file cap.
 *
 *   - <SoKpiStrip>      — 5-card KPI strip
 *   - <SoPresetBar>     — saved-preset chips + clear button
 *   - <SoFiltersBar>    — search input + status + customer + agent +
 *                         date-range popovers
 *   - <SoBulkBar>       — sticky bulk-actions banner
 *   - csv helpers       — `csvCell`, `toCsv` for export
 */

import * as React from 'react';

import { EntityPicker } from '@/components/crm/entity-picker';
import type {
  CrmSalesOrderDoc,
  CrmSalesOrderStatus,
} from '@/lib/rust-client/crm-sales-orders';

/* ─── KPI strip ──────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  tone: 'amber' | 'green' | 'neutral' | 'red';
}

function KpiCard({ label, value, active, onClick, tone }: KpiCardProps) {
  const ring =
    tone === 'amber'
      ? 'border-[var(--st-border)]/40'
      : tone === 'green'
        ? 'border-[var(--st-border)]/40'
        : tone === 'red'
          ? 'border-[var(--st-border)]/40'
          : 'border-[var(--st-border)]';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition-colors ${ring} ${
        active
          ? 'bg-[var(--st-bg-secondary)] ring-1 ring-[var(--st-text)]/40'
          : 'bg-[var(--st-bg-muted)] hover:bg-[var(--st-bg-secondary)]'
      }`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </span>
      <span className="text-[18px] font-semibold tabular-nums text-[var(--st-text)]">
        {value}
      </span>
    </button>
  );
}

export interface SoKpis {
  open: number;
  partial: number;
  fulfilled: number;
  closed: number;
  cancelled: number;
}

/** Headline KPIs shown above the status-bucket strip — matches the
 * §1D.list-deep spec: total orders / pending / fulfilled-this-month /
 * total order value. */
export interface SoHeadlineKpis {
  totalOrders: number;
  pending: number;
  fulfilledThisMonth: number;
  totalOrderValue: number;
  currency: string;
}

function fmtMoneyShort(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      notation: value >= 100_000 ? 'compact' : 'standard',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

interface HeadlineKpiCardProps {
  label: string;
  value: string;
  tone: 'neutral' | 'amber' | 'green' | 'red';
}

function HeadlineKpiCard({ label, value, tone }: HeadlineKpiCardProps) {
  const ring =
    tone === 'amber'
      ? 'border-[var(--st-border)]/40'
      : tone === 'green'
        ? 'border-[var(--st-border)]/40'
        : tone === 'red'
          ? 'border-[var(--st-border)]/40'
          : 'border-[var(--st-border)]';
  return (
    <div
      className={`flex flex-1 flex-col gap-1 rounded-md border bg-[var(--st-bg-muted)] px-3 py-2.5 ${ring}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </span>
      <span className="text-[18px] font-semibold tabular-nums text-[var(--st-text)]">
        {value}
      </span>
    </div>
  );
}

export function SoHeadlineKpiStrip({ kpis }: { kpis: SoHeadlineKpis }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <HeadlineKpiCard
        label="Total orders"
        value={kpis.totalOrders.toLocaleString()}
        tone="neutral"
      />
      <HeadlineKpiCard
        label="Pending"
        value={kpis.pending.toLocaleString()}
        tone="amber"
      />
      <HeadlineKpiCard
        label="Fulfilled this month"
        value={kpis.fulfilledThisMonth.toLocaleString()}
        tone="green"
      />
      <HeadlineKpiCard
        label="Total order value"
        value={fmtMoneyShort(kpis.totalOrderValue, kpis.currency)}
        tone="neutral"
      />
    </div>
  );
}

export function SoKpiStrip({
  kpis,
  currentStatus,
  onClick,
}: {
  kpis: SoKpis;
  currentStatus: string;
  onClick: (status: CrmSalesOrderStatus) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <KpiCard label="Open" value={kpis.open} tone="amber" active={currentStatus === 'open'} onClick={() => onClick('open')} />
      <KpiCard label="Partial" value={kpis.partial} tone="amber" active={currentStatus === 'partial'} onClick={() => onClick('partial')} />
      <KpiCard label="Fulfilled" value={kpis.fulfilled} tone="green" active={currentStatus === 'fulfilled'} onClick={() => onClick('fulfilled')} />
      <KpiCard label="Closed" value={kpis.closed} tone="neutral" active={currentStatus === 'closed'} onClick={() => onClick('closed')} />
      <KpiCard label="Cancelled" value={kpis.cancelled} tone="red" active={currentStatus === 'cancelled'} onClick={() => onClick('cancelled')} />
    </div>
  );
}

/* ─── Presets ────────────────────────────────────────────────────── */

export interface SoPreset {
  id: string;
  label: string;
  params: Record<string, string>;
}

export function thirtyDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export const SO_PRESETS: SoPreset[] = [
  { id: 'all-open', label: 'All open', params: { status: 'open' } },
  { id: 'partial', label: 'Partial', params: { status: 'partial' } },
  { id: 'fulfilled', label: 'Fulfilled', params: { status: 'fulfilled' } },
  { id: 'cancelled-30d', label: 'Cancelled · 30d', params: { status: 'cancelled', dateFrom: thirtyDaysAgoIso() } },
];

export function SoPresetBar({
  onPreset,
  hasActive,
  onClear,
}: {
  onPreset: (p: SoPreset) => void;
  hasActive: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        Presets:
      </span>
      {SO_PRESETS.map((p) => (
        <Button
          key={p.id}
          variant="outline"
          size="sm"
          onClick={() => onPreset(p)}
          className="text-[12px]"
        >
          {p.label}
        </Button>
      ))}
      {hasActive ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="ml-auto text-[12px] text-[var(--st-text-secondary)]"
        >
          <X className="h-3.5 w-3.5" /> Clear filters
        </Button>
      ) : null}
    </div>
  );
}

/* ─── Filters toolbar ────────────────────────────────────────────── */

const STATUS_OPTIONS: { value: '' | CrmSalesOrderStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'partial', label: 'Partial' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export interface SoFilters {
  query: string;
  status: string;
  clientId: string;
  agentId: string;
  dateFrom: string;
  dateTo: string;
  shipFrom: string;
  shipTo: string;
}

export function SoFiltersBar({
  filters,
  onQueryChange,
  onUpdate,
}: {
  filters: SoFilters;
  onQueryChange: (v: string) => void;
  onUpdate: (updates: Record<string, string | undefined>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--st-border)] p-3">
      <div className="relative max-w-sm flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
        <Input
          value={filters.query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by SO #, PO #, customer notes…"
          className="h-9 pl-9 text-[13px]"
        />
      </div>
      {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
      <Select
        value={filters.status || '__all'}
        onValueChange={(v) =>
          onUpdate({ status: v === '__all' ? undefined : v, page: '1' })
        }
      >
        <SelectTrigger className="h-9 w-[140px] text-[13px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value || '__all'} value={o.value || '__all'}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="w-[200px]">
        <EntityPicker
          entity="client"
          value={filters.clientId || null}
          placeholder="Customer…"
          onChange={(next) => {
            const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
            onUpdate({ clientId: id || undefined, page: '1' });
          }}
        />
      </div>
      <div className="w-[200px]">
        <EntityPicker
          entity="user"
          value={filters.agentId || null}
          placeholder="Sales agent…"
          onChange={(next) => {
            const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
            onUpdate({ agentId: id || undefined, page: '1' });
          }}
        />
      </div>
      <details className="relative">
        <summary className="list-none">
          <Button variant="outline" size="sm" className="h-9 text-[12.5px]">
            <CalendarRange className="h-3.5 w-3.5" /> Date range
          </Button>
        </summary>
        <div className="absolute right-0 z-20 mt-2 grid w-[280px] gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 shadow-md">
          <label className="text-[11px] text-[var(--st-text-secondary)]">Order date — from</label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onUpdate({ dateFrom: e.target.value || undefined, page: '1' })}
            className="h-8 text-[12.5px]"
          />
          <label className="text-[11px] text-[var(--st-text-secondary)]">Order date — to</label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onUpdate({ dateTo: e.target.value || undefined, page: '1' })}
            className="h-8 text-[12.5px]"
          />
          <label className="text-[11px] text-[var(--st-text-secondary)]">Expected shipment — from</label>
          <Input
            type="date"
            value={filters.shipFrom}
            onChange={(e) => onUpdate({ shipFrom: e.target.value || undefined, page: '1' })}
            className="h-8 text-[12.5px]"
          />
          <label className="text-[11px] text-[var(--st-text-secondary)]">Expected shipment — to</label>
          <Input
            type="date"
            value={filters.shipTo}
            onChange={(e) => onUpdate({ shipTo: e.target.value || undefined, page: '1' })}
            className="h-8 text-[12.5px]"
          />
        </div>
      </details>
    </div>
  );
}

/* ─── Active filter chips ────────────────────────────────────────── */

export function SoActiveFilterChips({
  filters,
  onRemove,
}: {
  filters: SoFilters;
  onRemove: (key: string) => void;
}) {
  const chips = [
    filters.status ? { key: 'status', label: `Status: ${filters.status}` } : null,
    filters.clientId ? { key: 'clientId', label: 'Customer set' } : null,
    filters.agentId ? { key: 'agentId', label: 'Agent set' } : null,
    filters.dateFrom ? { key: 'dateFrom', label: `From ${filters.dateFrom}` } : null,
    filters.dateTo ? { key: 'dateTo', label: `To ${filters.dateTo}` } : null,
    filters.shipFrom ? { key: 'shipFrom', label: `Ship ≥ ${filters.shipFrom}` } : null,
    filters.shipTo ? { key: 'shipTo', label: `Ship ≤ ${filters.shipTo}` } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2">
      {chips.map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-0.5 text-[11.5px] text-[var(--st-text)]"
        >
          {f.label}
          <button
            type="button"
            onClick={() => onRemove(f.key)}
            className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
            aria-label={`Clear ${f.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

/* ─── Bulk bar ───────────────────────────────────────────────────── */

const STATUS_TRANSITIONS: CrmSalesOrderStatus[] = [
  'open',
  'partial',
  'fulfilled',
  'closed',
  'cancelled',
];

export function SoBulkBar({
  count,
  onClear,
  onStatus,
  onExport,
  onExportXlsx,
  onConvertToDc,
  onArchive,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onStatus: (s: CrmSalesOrderStatus) => void;
  onExport: () => void;
  onExportXlsx?: () => void;
  onConvertToDc: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[12.5px]">
      <span className="font-medium text-[var(--st-text)]">{count} selected</span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="h-3.5 w-3.5" /> Clear
      </Button>
      <span className="mx-1 h-4 w-px bg-[var(--st-border)]" />
      <Select onValueChange={(v) => onStatus(v as CrmSalesOrderStatus)}>
        <SelectTrigger className="h-8 w-[150px] text-[12px]">
          <SelectValue placeholder="Change status…" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_TRANSITIONS.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className="h-3.5 w-3.5" /> Export CSV
      </Button>
      {onExportXlsx ? (
        <Button variant="outline" size="sm" onClick={onExportXlsx}>
          <Download className="h-3.5 w-3.5" /> Export XLSX
        </Button>
      ) : null}
      <Button variant="outline" size="sm" onClick={onConvertToDc}>
        <Truck className="h-3.5 w-3.5" /> To delivery challan
      </Button>
      <Button variant="outline" size="sm" onClick={onArchive}>
        Archive
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onDelete}
        className="text-[var(--st-danger)]"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>
    </div>
  );
}

/* ─── CSV helpers ────────────────────────────────────────────────── */

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function soToCsv(rows: CrmSalesOrderDoc[]): string {
  const headers = [
    'SO no',
    'Date',
    'Expected shipment',
    'Customer ID',
    'PO no',
    'Quotation ref',
    'Status',
    'Currency',
    'Total',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.soNo,
        r.date,
        r.expectedShipmentDate,
        r.clientId,
        r.poNo,
        r.quotationRef,
        r.status,
        r.currency,
        r.totals?.total,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}
