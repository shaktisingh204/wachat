'use client';

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard } from '@/components/sabcrm/20ui';
import {
  ClipboardList,
  Clock,
  Download,
  MailQuestion,
  Plus,
  Search,
  Table as TableIcon,
  Zap,
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
        onClick={() => onSegmentClick('open')}
        aria-label="Filter to active (open) RFQs"
      >
        <StatCard
          label="Total active"
          value={kpi.totalActive.toLocaleString()}
          period="status = open"
          icon={<Zap />}
        />
      </button>
      <StatCard
        label="Awaiting responses"
        value={kpi.awaitingResponses.toLocaleString()}
        period="open & not past deadline"
        icon={<MailQuestion />}
        invertDelta
      />
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
        onClick={() => onSegmentClick('closed')}
        aria-label="Filter to closed RFQs"
      >
        <StatCard
          label="Closed"
          value={kpi.closed.toLocaleString()}
          period="status = closed"
        />
      </button>
      <StatCard
        label="Avg response"
        value={
          kpi.avgResponseHours != null
            ? kpi.avgResponseHours < 48
              ? `${kpi.avgResponseHours.toFixed(1)} h`
              : `${(kpi.avgResponseHours / 24).toFixed(1)} d`
            : '—'
        }
        period="create → first move"
        icon={<Clock />}
      />
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
        onClick={() => onSegmentClick('draft')}
        aria-label="Filter to draft RFQs"
      >
        <StatCard
          label="Draft"
          value={kpi.draft.toLocaleString()}
          period="status = draft"
          icon={<ClipboardList />}
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
        onClick={() => onSegmentClick('open')}
        aria-label="Filter to open RFQs"
      >
        <StatCard
          label="Open"
          value={kpi.open.toLocaleString()}
          period="status = open"
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
        onClick={() => onSegmentClick('awarded')}
        aria-label="Filter to awarded RFQs"
      >
        <StatCard
          label="Awarded"
          value={kpi.awarded.toLocaleString()}
          period="status = awarded"
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
        onClick={() => onSegmentClick('cancelled')}
        aria-label="Filter to cancelled RFQs"
      >
        <StatCard
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] p-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by title or terms…"
          className="h-9 pl-9 text-[13px]"
          aria-label="Search RFQs"
        />
      </div>

      <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:pb-0">
        <Button
          variant={preset === 'all' ? 'default' : 'outline'}
          size="sm"
          className="rounded-full px-3 text-xs"
          onClick={() => onPresetChange('all')}
        >
          All
        </Button>
        <Button
          variant={preset === 'my-drafts' ? 'default' : 'outline'}
          size="sm"
          className="rounded-full px-3 text-xs"
          onClick={() => onPresetChange('my-drafts')}
        >
          My Drafts
        </Button>
        <Button
          variant={preset === 'all-open' ? 'default' : 'outline'}
          size="sm"
          className="rounded-full px-3 text-xs"
          onClick={() => onPresetChange('all-open')}
        >
          Open
        </Button>
        <Button
          variant={preset === 'closing-week' ? 'default' : 'outline'}
          size="sm"
          className="rounded-full px-3 text-xs"
          onClick={() => onPresetChange('closing-week')}
        >
          Closing Soon
        </Button>
        <Button
          variant={preset === 'awarded-30d' ? 'default' : 'outline'}
          size="sm"
          className="rounded-full px-3 text-xs"
          onClick={() => onPresetChange('awarded-30d')}
        >
          Awarded
        </Button>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
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
        </div>

        <Button variant="outline" size="sm" onClick={onExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>

        <Button size="sm" asChild>
          <Link href="/dashboard/crm/purchases/rfqs/new">
            <Plus className="h-3.5 w-3.5" /> New RFQ
          </Link>
        </Button>
      </div>
    </div>
  );
}
