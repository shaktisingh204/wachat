'use client';

import { Button, Input, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import {
  ArrowRightCircle,
  CalendarRange,
  Download,
  Search,
  Trash2,
  X,
  } from 'lucide-react';

/**
 * Presentational bits for `<DeliveryListClient>` — KPI strip, filter
 * toolbar, active-filter chips, bulk-bar, CSV helpers. Split out to
 * keep the parent file under the 600-line per-file cap.
 */

import * as React from 'react';

import { EntityPicker } from '@/components/crm/entity-picker';

/* ─── Types ───────────────────────────────────────────────────────── */

export type DcStatus = 'Draft' | 'In Transit' | 'Delivered' | 'Returned';

export interface DcRow {
  _id: string;
  challanNumber: string;
  accountId: string;
  challanDate: string;
  status: DcStatus;
  reason?: string;
  vehicleNumber?: string;
  driverName?: string;
  mode?: string;
  warehouseId?: string;
  transporterId?: string;
  soRef?: string;
  createdAt?: string;
  batchCount?: number;
  serialsCount?: number;
}

export interface DcKpis {
  /** Legacy: count of `Draft` challans (still shown in the strip-legacy). */
  draft: number;
  inTransit: number;
  delivered: number;
  returned: number;
  /** Total challans (across all statuses). Headline KPI. */
  totalChallans: number;
  /** Count of challans delivered today (status=Delivered, date=today). */
  deliveredToday: number;
}

export interface DcFilters {
  query: string;
  status: string;
  clientId: string;
  transporterId: string;
  dateFrom: string;
  dateTo: string;
  warehouseId: string;
}

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
      ? 'border-amber-500/40'
      : tone === 'green'
        ? 'border-emerald-500/40'
        : tone === 'red'
          ? 'border-rose-500/40'
          : 'border-zoru-line';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition-colors ${ring} ${
        active
          ? 'bg-zoru-surface ring-1 ring-zoru-primary/40'
          : 'bg-zoru-surface-2 hover:bg-zoru-surface'
      }`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </span>
      <span className="text-[18px] font-semibold tabular-nums text-zoru-ink">
        {value}
      </span>
    </button>
  );
}

export function DcKpiStrip({
  kpis,
  currentStatus,
  onClick,
}: {
  kpis: DcKpis;
  currentStatus: string;
  onClick: (s: DcStatus) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <KpiCard
        label="Total challans"
        value={kpis.totalChallans}
        tone="neutral"
        active={false}
        onClick={() => onClick(currentStatus as DcStatus)}
      />
      <KpiCard label="In transit" value={kpis.inTransit} tone="amber" active={currentStatus === 'In Transit'} onClick={() => onClick('In Transit')} />
      <KpiCard label="Delivered today" value={kpis.deliveredToday} tone="green" active={currentStatus === 'Delivered'} onClick={() => onClick('Delivered')} />
      <KpiCard label="Returned" value={kpis.returned} tone="red" active={currentStatus === 'Returned'} onClick={() => onClick('Returned')} />
    </div>
  );
}

/* ─── Filters toolbar ────────────────────────────────────────────── */

const STATUS_OPTIONS: { value: '' | DcStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'In Transit', label: 'In transit' },
  { value: 'Delivered', label: 'Delivered' },
  { value: 'Returned', label: 'Returned' },
];

export function DcFiltersBar({
  filters,
  onQueryChange,
  onUpdate,
  onClear,
  hasActive,
}: {
  filters: DcFilters;
  onQueryChange: (v: string) => void;
  onUpdate: (updates: Record<string, string | undefined>) => void;
  onClear: () => void;
  hasActive: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-zoru-line p-3">
      <div className="relative max-w-sm flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
        <Input
          value={filters.query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by challan no, vehicle, driver…"
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
        <ZoruSelectTrigger className="h-9 w-[140px] text-[13px]">
          <ZoruSelectValue placeholder="Status" />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          {STATUS_OPTIONS.map((o) => (
            <ZoruSelectItem key={o.value || '__all'} value={o.value || '__all'}>
              {o.label}
            </ZoruSelectItem>
          ))}
        </ZoruSelectContent>
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
          entity="warehouse"
          value={filters.warehouseId || null}
          placeholder="Dispatch warehouse…"
          onChange={(next) => {
            const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
            onUpdate({ warehouseId: id || undefined, page: '1' });
          }}
        />
      </div>
      <details className="relative">
        <summary className="list-none">
          <Button variant="outline" size="sm" className="h-9 text-[12.5px]">
            <CalendarRange className="h-3.5 w-3.5" /> Date range
          </Button>
        </summary>
        <div className="absolute right-0 z-20 mt-2 grid w-[280px] gap-2 rounded-md border border-zoru-line bg-zoru-surface p-3 shadow-md">
          <label className="text-[11px] text-zoru-ink-muted">Challan date — from</label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onUpdate({ dateFrom: e.target.value || undefined, page: '1' })}
            className="h-8 text-[12.5px]"
          />
          <label className="text-[11px] text-zoru-ink-muted">Challan date — to</label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onUpdate({ dateTo: e.target.value || undefined, page: '1' })}
            className="h-8 text-[12.5px]"
          />
        </div>
      </details>
      {hasActive ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="ml-auto text-[12px] text-zoru-ink-muted"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      ) : null}
    </div>
  );
}

/* ─── Active filter chips ────────────────────────────────────────── */

export function DcActiveFilterChips({
  filters,
  onRemove,
}: {
  filters: DcFilters;
  onRemove: (key: string) => void;
}) {
  const chips = [
    filters.status ? { key: 'status', label: `Status: ${filters.status}` } : null,
    filters.clientId ? { key: 'clientId', label: 'Customer set' } : null,
    filters.transporterId ? { key: 'transporterId', label: 'Transporter set' } : null,
    filters.warehouseId ? { key: 'warehouseId', label: 'Warehouse set' } : null,
    filters.dateFrom ? { key: 'dateFrom', label: `From ${filters.dateFrom}` } : null,
    filters.dateTo ? { key: 'dateTo', label: `To ${filters.dateTo}` } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 border-b border-zoru-line bg-zoru-surface-2 px-3 py-2">
      {chips.map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-1 rounded-full border border-zoru-line bg-zoru-surface px-2 py-0.5 text-[11.5px] text-zoru-ink"
        >
          {f.label}
          <button
            type="button"
            onClick={() => onRemove(f.key)}
            className="text-zoru-ink-muted hover:text-zoru-ink"
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

export function DcBulkBar({
  count,
  onClear,
  onExport,
  onExportXlsx,
  onStatus,
  onConvertToInvoice,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onExport: () => void;
  onExportXlsx?: () => void;
  onStatus?: (s: DcStatus) => void;
  onConvertToInvoice: () => void;
  onDelete: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zoru-line bg-zoru-surface px-3 py-2 text-[12.5px]">
      <span className="font-medium text-zoru-ink">{count} selected</span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="h-3.5 w-3.5" /> Clear
      </Button>
      <span className="mx-1 h-4 w-px bg-zoru-line" />
      {onStatus ? (
        <Select onValueChange={(v) => onStatus(v as DcStatus)}>
          <ZoruSelectTrigger className="h-8 w-[160px] text-[12px]">
            <ZoruSelectValue placeholder="Change status…" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="Draft">Draft</ZoruSelectItem>
            <ZoruSelectItem value="In Transit">In Transit</ZoruSelectItem>
            <ZoruSelectItem value="Delivered">Delivered</ZoruSelectItem>
            <ZoruSelectItem value="Returned">Returned</ZoruSelectItem>
          </ZoruSelectContent>
        </Select>
      ) : null}
      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className="h-3.5 w-3.5" /> Export CSV
      </Button>
      {onExportXlsx ? (
        <Button variant="outline" size="sm" onClick={onExportXlsx}>
          <Download className="h-3.5 w-3.5" /> Export XLSX
        </Button>
      ) : null}
      <Button variant="outline" size="sm" onClick={onConvertToInvoice}>
        <ArrowRightCircle className="h-3.5 w-3.5" /> To invoice
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onDelete}
        className="text-zoru-danger-ink"
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

export function dcToCsv(rows: DcRow[]): string {
  const headers = [
    'Challan #',
    'Customer ID',
    'SO ref',
    'Date',
    'Status',
    'Vehicle #',
    'Driver',
    'Mode',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.challanNumber,
        r.accountId,
        r.soRef,
        r.challanDate,
        r.status,
        r.vehicleNumber,
        r.driverName,
        r.mode,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}
