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
  Download,
  FileText,
  Plus,
  Search,
  Table as TableIcon,
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

export type ViewMode = 'table';
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
  onSegmentClick: (segment: 'open' | 'accepted' | 'rejected' | 'expired' | 'converted') => void;
}

export function QuotationKpiStrip({ kpi, onSegmentClick }: KpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('open')}
        aria-label="Filter to open quotations"
      >
        <ZoruStatCard
          label="Total open"
          value={kpi.totalOpen.toLocaleString()}
          period="draft + sent"
          icon={<FileText />}
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('accepted')}
        aria-label="Filter to accepted quotations"
      >
        <ZoruStatCard
          label="Accepted"
          value={kpi.accepted.toLocaleString()}
          period="status = accepted"
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('rejected')}
        aria-label="Filter to rejected quotations"
      >
        <ZoruStatCard
          label="Rejected"
          value={kpi.rejected.toLocaleString()}
          period="status = rejected"
          invertDelta
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('expired')}
        aria-label="Filter to expired quotations"
      >
        <ZoruStatCard
          label="Expired"
          value={kpi.expired.toLocaleString()}
          period="past valid-until"
          invertDelta
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('converted')}
        aria-label="Filter to converted quotations"
      >
        <ZoruStatCard
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
        <ZoruInput
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by number or customer…"
          className="h-9 pl-9 text-[13px]"
          aria-label="Search quotations"
        />
      </div>

      <div className="flex items-center gap-1.5">
        {/* Presets */}
        <ZoruSelect value={preset} onValueChange={(v) => onPresetChange(v as PresetKey)}>
          <ZoruSelectTrigger className="h-9 w-[200px]" aria-label="Saved view">
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

        {/* View switcher (table only for now — kept for parity with Deals). */}
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
        </div>

        <ZoruButton variant="outline" size="sm" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export
        </ZoruButton>

        <ZoruButton size="sm" asChild>
          <Link href="/dashboard/crm/sales/quotations/new">
            <Plus className="h-3.5 w-3.5" /> New quotation
          </Link>
        </ZoruButton>
      </div>
    </div>
  );
}
