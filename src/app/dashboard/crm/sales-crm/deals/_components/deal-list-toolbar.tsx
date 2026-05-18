'use client';

import {
  ZoruButton,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
} from '@/components/zoruui';
import {
  CalendarRange,
  Columns3,
  Copy,
  Download,
  Plus,
  Search,
  Table as TableIcon,
  Trophy,
  } from 'lucide-react';

/**
 * <DealListToolbar> — KPI strip + top toolbar for the deals list.
 *
 * Extracted from <DealListClient> to keep the parent under the 600-line
 * cap. Pure presentational; the parent owns all state.
 */

import * as React from 'react';
import Link from 'next/link';

import type { DealKpiSummary } from './types';

export type ViewMode = 'table' | 'kanban' | 'calendar';
export type Density = 'comfortable' | 'compact' | 'dense';
export type PresetKey = 'all' | 'my-open' | 'closing-week' | 'at-risk' | 'won';

export const PRESET_OPTIONS: { key: PresetKey; label: string }[] = [
  { key: 'all', label: 'All deals (default)' },
  { key: 'my-open', label: 'My open deals' },
  { key: 'closing-week', label: 'Closing this week' },
  { key: 'at-risk', label: 'At-risk' },
  { key: 'won', label: 'Won' },
];

interface KpiStripProps {
  kpi: DealKpiSummary;
  defaultCurrency: string;
  winRate: number | null;
  onWinRateClick: () => void;
}

function fmtMoney(value?: number | null, currency = 'INR'): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function DealKpiStrip({ kpi, defaultCurrency, winRate, onWinRateClick }: KpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <ZoruStatCard
        label="Open deals"
        value={kpi.openCount.toLocaleString()}
        period="currently active"
        icon={<Trophy />}
      />
      <ZoruStatCard
        label="Open pipeline"
        value={fmtMoney(kpi.openValue, defaultCurrency)}
        period="sum of open"
      />
      <ZoruStatCard
        label="Won this month"
        value={fmtMoney(kpi.wonThisMonth, defaultCurrency)}
        period="closed-won"
      />
      <ZoruStatCard
        label="Lost this month"
        value={fmtMoney(kpi.lostThisMonth, defaultCurrency)}
        period="closed-lost"
        invertDelta
      />
      <button
        type="button"
        onClick={onWinRateClick}
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        aria-label="Filter to won deals"
      >
        <ZoruStatCard
          label="Win rate"
          value={winRate != null ? `${winRate}%` : '—'}
          period="won / (won + lost)"
        />
      </button>
      <ZoruStatCard
        label="Avg cycle"
        value={kpi.avgCycleDays > 0 ? `${kpi.avgCycleDays.toFixed(1)} d` : '—'}
        period="created → close"
      />
    </div>
  );
}

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

export function DealListToolbar({
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
        <ZoruInput
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search title or client…"
          className="h-9 pl-9 text-[13px]"
          aria-label="Search deals"
        />
      </div>

      <div className="flex items-center gap-1.5">
        {/* Presets */}
        <ZoruSelect value={preset} onValueChange={(v) => onPresetChange(v as PresetKey)}>
          <ZoruSelectTrigger className="h-9 w-[180px]">
            <ZoruSelectValue placeholder="Saved view" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {PRESET_OPTIONS.map((p) => (
              <ZoruSelectItem key={p.key} value={p.key}>
                {p.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </ZoruSelect>

        {/* Density */}
        <ZoruSelect value={density} onValueChange={(v) => onDensityChange(v as Density)}>
          <ZoruSelectTrigger className="h-9 w-[140px]" aria-label="Row density">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="comfortable">Comfortable</ZoruSelectItem>
            <ZoruSelectItem value="compact">Compact</ZoruSelectItem>
            <ZoruSelectItem value="dense">Dense</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>

        {/* View switcher */}
        <div className="flex items-center rounded border border-zoru-line bg-zoru-surface p-0.5">
          <ZoruButton
            type="button"
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('table')}
            aria-pressed={view === 'table'}
            aria-label="Table view"
          >
            <TableIcon className="h-3.5 w-3.5" />
          </ZoruButton>
          <ZoruButton
            type="button"
            variant={view === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('kanban')}
            aria-pressed={view === 'kanban'}
            aria-label="Kanban view"
          >
            <Columns3 className="h-3.5 w-3.5" />
          </ZoruButton>
          <ZoruButton
            type="button"
            variant={view === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('calendar')}
            aria-pressed={view === 'calendar'}
            aria-label="Calendar view"
          >
            <CalendarRange className="h-3.5 w-3.5" />
          </ZoruButton>
        </div>

        <ZoruButton variant="outline" size="sm" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export
        </ZoruButton>

        <ZoruButton variant="outline" size="sm" asChild>
          <Link href="/dashboard/crm/sales-crm/deals/duplicates">
            <Copy className="h-3.5 w-3.5" /> Find duplicates
          </Link>
        </ZoruButton>

        <ZoruButton size="sm" asChild>
          <Link href="/dashboard/crm/sales-crm/deals/new">
            <Plus className="h-3.5 w-3.5" /> New deal
          </Link>
        </ZoruButton>
      </div>
    </div>
  );
}
