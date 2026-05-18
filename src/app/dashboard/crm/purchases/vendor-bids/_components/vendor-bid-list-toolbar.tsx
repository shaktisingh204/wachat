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
  Gavel,
  Plus,
  Search,
  Table as TableIcon,
  } from 'lucide-react';

/**
 * <VendorBidKpiStrip> + <VendorBidListToolbar> — KPI strip and top
 * toolbar for the canonical Vendor Bids list. Extracted from
 * `<VendorBidListClient>` to keep that component under the 600-line
 * cap.
 *
 * Each KPI tile is clickable — clicking re-filters the list to the
 * matching status. KPI tiles mirror §1D: Draft · Submitted ·
 * Shortlisted · Awarded · Rejected.
 */

import * as React from 'react';
import Link from 'next/link';

import type { VendorBidKpiSummary } from './types';

export type ViewMode = 'table';
export type Density = 'comfortable' | 'compact' | 'dense';

/* ─── KPI strip ─────────────────────────────────────────────────── */

interface KpiStripProps {
  kpi: VendorBidKpiSummary;
  onSegmentClick: (
    segment: 'draft' | 'submitted' | 'shortlisted' | 'awarded' | 'rejected',
  ) => void;
}

export function VendorBidKpiStrip({ kpi, onSegmentClick }: KpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('draft')}
        aria-label="Filter to draft vendor bids"
      >
        <ZoruStatCard
          label="Draft"
          value={kpi.draft.toLocaleString()}
          period="status = draft"
          icon={<Gavel />}
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('submitted')}
        aria-label="Filter to submitted vendor bids"
      >
        <ZoruStatCard
          label="Submitted"
          value={kpi.submitted.toLocaleString()}
          period="status = submitted"
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('shortlisted')}
        aria-label="Filter to shortlisted vendor bids"
      >
        <ZoruStatCard
          label="Shortlisted"
          value={kpi.shortlisted.toLocaleString()}
          period="status = shortlisted"
        />
      </button>
      <button
        type="button"
        className="text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
        onClick={() => onSegmentClick('awarded')}
        aria-label="Filter to awarded vendor bids"
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
        onClick={() => onSegmentClick('rejected')}
        aria-label="Filter to rejected vendor bids"
      >
        <ZoruStatCard
          label="Rejected"
          value={kpi.rejected.toLocaleString()}
          period="status = rejected"
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
  onExportCsv: () => void;
}

export function VendorBidListToolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  density,
  onDensityChange,
  onExportCsv,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
        <ZoruInput
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by vendor name or terms…"
          className="h-9 pl-9 text-[13px]"
          aria-label="Search vendor bids"
        />
      </div>

      <div className="flex items-center gap-1.5">
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
          <Link href="/dashboard/crm/purchases/vendor-bids/new">
            <Plus className="h-3.5 w-3.5" /> New vendor bid
          </Link>
        </ZoruButton>
      </div>
    </div>
  );
}
