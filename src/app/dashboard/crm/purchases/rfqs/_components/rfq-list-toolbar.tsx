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
  ClipboardList,
  Download,
  Plus,
  Search,
  Table as TableIcon,
  } from 'lucide-react';

/**
 * <RfqKpiStrip> + <RfqListToolbar> — KPI strip and top toolbar for the
 * canonical RFQs list. Extracted from `<RfqListClient>` to keep that
 * component under the 600-line cap. Purely presentational; the parent
 * owns all state.
 *
 * Each KPI tile is clickable — clicking re-filters the list to the
 * matching status. KPI tiles mirror §1D: Draft · Open · Closed ·
 * Awarded · Cancelled.
 */

import * as React from 'react';
import Link from 'next/link';

import type { RfqKpiSummary } from './types';

export type ViewMode = 'table';
export type Density = 'comfortable' | 'compact' | 'dense';
export type PresetKey =
  | 'all'
  | 'all-open'
  | 'my-drafts'
  | 'closing-week'
  | 'awarded-30d';

export const PRESET_OPTIONS: { key: PresetKey; label: string }[] = [
  { key: 'all', label: 'All RFQs (default)' },
  { key: 'all-open', label: 'All open' },
  { key: 'my-drafts', label: 'My drafts' },
  { key: 'closing-week', label: 'Closing this week' },
  { key: 'awarded-30d', label: 'Awarded in last 30 days' },
];

/* ─── KPI strip ─────────────────────────────────────────────────── */

interface KpiStripProps {
  kpi: RfqKpiSummary;
  onSegmentClick: (
    segment: 'draft' | 'open' | 'closed' | 'awarded' | 'cancelled',
  ) => void;
}

export function RfqKpiStrip({ kpi, onSegmentClick }: KpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('draft')}
        aria-label="Filter to draft RFQs"
      >
        <ZoruStatCard
          label="Draft"
          value={kpi.draft.toLocaleString()}
          period="status = draft"
          icon={<ClipboardList />}
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('open')}
        aria-label="Filter to open RFQs"
      >
        <ZoruStatCard
          label="Open"
          value={kpi.open.toLocaleString()}
          period="status = open"
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('closed')}
        aria-label="Filter to closed RFQs"
      >
        <ZoruStatCard
          label="Closed"
          value={kpi.closed.toLocaleString()}
          period="status = closed"
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('awarded')}
        aria-label="Filter to awarded RFQs"
      >
        <ZoruStatCard
          label="Awarded"
          value={kpi.awarded.toLocaleString()}
          period="status = awarded"
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('cancelled')}
        aria-label="Filter to cancelled RFQs"
      >
        <ZoruStatCard
          label="Cancelled"
          value={kpi.cancelled.toLocaleString()}
          period="status = cancelled"
          invertDelta
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

export function RfqListToolbar({
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
          placeholder="Search by title or terms…"
          className="h-9 pl-9 text-[13px]"
          aria-label="Search RFQs"
        />
      </div>

      <div className="flex items-center gap-1.5">
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
          <Link href="/dashboard/crm/purchases/rfqs/new">
            <Plus className="h-3.5 w-3.5" /> New RFQ
          </Link>
        </ZoruButton>
      </div>
    </div>
  );
}
