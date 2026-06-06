'use client';

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard } from '@/components/sabcrm/20ui';
import {
  Download,
  FileText,
  Plus,
  Search,
  Table as TableIcon,
  LayoutDashboard,
  } from 'lucide-react';

/**
 * <QuotationKpiStrip> + <QuotationListToolbar> — KPI strip and top
 * toolbar for the canonical quotations list. Extracted from
 * `<QuotationListClient>` to keep that component under the 600-line
 * cap. Purely presentational; the parent owns all state.
 *
 * Each KPI tile is clickable — clicking re-filters the list to the
 * matching status / segment.
 */

import * as React from 'react';
import Link from 'next/link';

import type { QuotationKpiSummary } from './types';

export type ViewMode = 'table' | 'kanban';
export type Density = 'comfortable' | 'compact' | 'dense';
export type PresetKey = 'all' | 'my-open' | 'accepted-30d' | 'expiring-week' | 'draft';

export const PRESET_OPTIONS: { key: PresetKey; label: string }[] = [
  { key: 'all', label: 'All quotations (default)' },
  { key: 'my-open', label: 'My open quotations' },
  { key: 'accepted-30d', label: 'Accepted in last 30 days' },
  { key: 'expiring-week', label: 'Expiring this week' },
  { key: 'draft', label: 'Drafts' },
];

/* ─── KPI strip ─────────────────────────────────────────────────── */

interface KpiStripProps {
  kpi: QuotationKpiSummary;
  onSegmentClick: (
    segment: 'open' | 'accepted' | 'rejected' | 'expired' | 'converted' | 'draft',
  ) => void;
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

export function QuotationKpiStrip({ kpi, onSegmentClick }: KpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total this month"
        value={kpi.totalThisMonth.toLocaleString()}
        period="quotations dated this month"
        icon={<FileText />}
      />
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
        onClick={() => onSegmentClick('draft')}
        aria-label="Filter to draft quotations"
      >
        <StatCard
          label="Drafts"
          value={kpi.draft.toLocaleString()}
          period="status = draft"
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
        onClick={() => onSegmentClick('accepted')}
        aria-label="Filter to accepted quotations"
      >
        <StatCard
          label="Accepted"
          value={kpi.accepted.toLocaleString()}
          period="status = accepted"
        />
      </button>
      <StatCard
        label="Total quoted value"
        value={fmtMoneyShort(kpi.totalQuotedValue, kpi.currency)}
        period="sum across loaded window"
      />
    </div>
  );
}

// Legacy 5-tile strip preserved for parity with deals — exposed but no
// longer rendered by the canonical list. Kept for downstream callers
// that still expect the granular status breakdown.
export function QuotationKpiStripLegacy({ kpi, onSegmentClick }: KpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
        onClick={() => onSegmentClick('open')}
        aria-label="Filter to open quotations"
      >
        <StatCard
          label="Total open"
          value={kpi.totalOpen.toLocaleString()}
          period="draft + sent"
          icon={<FileText />}
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
        onClick={() => onSegmentClick('accepted')}
        aria-label="Filter to accepted quotations"
      >
        <StatCard
          label="Accepted"
          value={kpi.accepted.toLocaleString()}
          period="status = accepted"
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
        onClick={() => onSegmentClick('rejected')}
        aria-label="Filter to rejected quotations"
      >
        <StatCard
          label="Rejected"
          value={kpi.rejected.toLocaleString()}
          period="status = rejected"
          invertDelta
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
        onClick={() => onSegmentClick('expired')}
        aria-label="Filter to expired quotations"
      >
        <StatCard
          label="Expired"
          value={kpi.expired.toLocaleString()}
          period="past valid-until"
          invertDelta
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
        onClick={() => onSegmentClick('converted')}
        aria-label="Filter to converted quotations"
      >
        <StatCard
          label="Conversion rate"
          value={kpi.conversionRatePct != null ? `${kpi.conversionRatePct}%` : '—'}
          period="(accepted + converted) / total"
        />
      </button>
    </div>
  );
}

/* ─── Toolbar ──────────────────────────────────────────────────── */

interface ToolbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  density: Density;
  onDensityChange: (next: Density) => void;
  preset: PresetKey;
  onPresetChange: (next: PresetKey) => void;
  onExportCsv: () => void;
}

export function QuotationListToolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  density,
  onDensityChange,
  preset,
  onPresetChange,
  onExportCsv,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] p-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by number or customer…"
          className="h-9 pl-9 text-[13px]"
          aria-label="Search quotations"
        />
      </div>

      <div className="flex items-center gap-1.5">
        {/* Presets */}
        <Select value={preset} onValueChange={(v) => onPresetChange(v as PresetKey)}>
          <SelectTrigger className="h-9 w-[200px]" aria-label="Saved view">
            <SelectValue placeholder="Saved view" />
          </SelectTrigger>
          <SelectContent>
            {PRESET_OPTIONS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Density */}
        <Select value={density} onValueChange={(v) => onDensityChange(v as Density)}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="Row density">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comfortable">Comfortable</SelectItem>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="dense">Dense</SelectItem>
          </SelectContent>
        </Select>

        {/* View switcher */}
        <div className="flex items-center rounded border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-0.5">
          <Button
            type="button"
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('table')}
            aria-pressed={view === 'table'}
            aria-label="Table view"
          >
            <TableIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={view === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('kanban')}
            aria-pressed={view === 'kanban'}
            aria-label="Kanban view"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>

        <Button size="sm" asChild>
          <Link href="/dashboard/crm/sales/quotations/new">
            <Plus className="h-3.5 w-3.5" /> New quotation
          </Link>
        </Button>
      </div>
    </div>
  );
}
