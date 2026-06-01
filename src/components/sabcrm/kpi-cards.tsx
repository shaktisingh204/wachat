'use client';

/**
 * SabCRM — KPI stat-card row.
 *
 * A row of ZoruUI StatCards displaying the four CRM dashboard KPI buckets:
 *
 *   1. **Record counts** — A scrollable horizontal row of stat cards, one per
 *      object (standard + custom), showing the total record count. Each card
 *      includes an icon from the object metadata.
 *
 *   2. **Pipeline value** — Open opportunity count + sum of `amount` fields
 *      across all non-closed-won opportunities. Rendered as a single card with
 *      the formatted pipeline value.
 *
 *   3. **Task KPIs** — Two sub-cards: "Due Today" and "Overdue" task counts.
 *      The "Overdue" card inverts delta colors (red = increase in late tasks).
 *
 *   4. **New this week** — Record count created since Monday 00:00 UTC in the
 *      current week. Shows the date range reference.
 *
 * All cards are ZoruUI StatCard components under the inherited `.zoruui` scope,
 * using black-and-white ZoruUI color tokens (--zoru-*) for consistency.
 *
 * The component accepts a `CrmDashboardKpis` payload (from the
 * `getKpisAction` server action) and renders it statically with no state or
 * re-fetches. Ideal for embedding in a server component parent that fetches
 * the data.
 */

import * as React from 'react';
import { StatCard, ScrollArea, cn } from '@/components/zoruui';
import {
  CrmDashboardKpis,
  ObjectRecordCount,
} from '@/app/actions/sabcrm.actions';

// ─────────────────────────────────────────────────────────────────────────────
// Icon mapping for object types (fallback when icon is a string name)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map object icon names (lucide icon names as strings) to React components.
 * This is a minimal set covering the standard objects. Custom objects may have
 * icon names that don't map here; in those cases we render the string as a
 * placeholder or skip the icon.
 *
 * The icon name comes from the ObjectMetadata.icon field (a lucide icon name
 * string like "building", "users", "briefcase", etc.).
 */
const ICON_MAP: Record<string, React.ReactNode> = {
  // Standard CRM objects (from schema.ts)
  building: <Building />,
  users: <Users />,
  briefcase: <Briefcase />,
  note: <Note />,
  checklist: <CheckCircle />,
  activity: <Activity />,
};

// Minimal lucide-compatible icon stubs (9x9 SVG squares for consistency with ZoruUI)
function Building() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );
}

function Users() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM15 20H9m6 0h6v-2a6 6 0 00-9-5.497M9 20H3v-2a6 6 0 019-5.497"
      />
    </svg>
  );
}

function Briefcase() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 13.255A23.931 23.931 0 0112 15c-3.728 0-7.196-.54-10.404-1.576M3 13h2.966C3.75 16.091 4.843 18.897 6.3 21M3 13h18m-5-4h6m-6 0a3 3 0 11-6 0 3 3 0 016 0zM3.348 9h15.353c.369-.368.853-.865 1.265-1.436a2 2 0 00-3.4-2.247A13.989 13.989 0 0012 5c-3.769 0-7.229.854-10.487 2.372a2 2 0 00-3.4 2.247c.412.571.896 1.068 1.265 1.436z"
      />
    </svg>
  );
}

function Note() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function Activity() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

function getIconForObject(iconName: string): React.ReactNode {
  return ICON_MAP[iconName] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a number as a currency string (no decimal places, compact notation).
 *
 * Examples: 1000000 → "1.0M", 50000 → "50.0K", 1234 → "1.2K"
 */
function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1) + 'M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(1) + 'K';
  }
  return value.toLocaleString();
}

/**
 * Parse an ISO date string and extract the date range label (e.g., "May 27 – Jun 2").
 * Used to display the week range for the "New this week" KPI.
 */
function getWeekRangeLabel(weekStartIso: string): string {
  try {
    const weekStart = new Date(weekStartIso);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

    const startMonth = weekStart.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const endMonth = weekEnd.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    return `${startMonth} – ${endMonth}`;
  } catch {
    return 'This week';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component props and interface
// ─────────────────────────────────────────────────────────────────────────────

export interface KpiCardsProps {
  /** The four KPI buckets from the dashboard (from `getKpisAction`). */
  kpis: CrmDashboardKpis;
  /** Optional CSS class to apply to the root container. */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponent: record count card row (scrollable)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders a horizontal scrollable row of stat cards, one per object.
 * Each card shows the record count with the object's icon.
 */
function RecordCountCards({
  recordCounts,
}: {
  recordCounts: ObjectRecordCount[];
}): React.ReactElement {
  if (recordCounts.length === 0) {
    return (
      <div className="rounded-[var(--zoru-radius-md)] border border-zoru-border bg-zoru-surface-1 px-4 py-8 text-center text-sm text-zoru-ink-muted">
        No objects found
      </div>
    );
  }

  // If 3 or fewer objects, render in a grid (no scroll needed)
  if (recordCounts.length <= 3) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {recordCounts.map((objRecord) => (
          <RecordCountCard key={objRecord.slug} record={objRecord} />
        ))}
      </div>
    );
  }

  // If 4+, render in a scrollable container
  return (
    <ScrollArea>
      <div className="flex gap-3 pb-3">
        {recordCounts.map((objRecord) => (
          <div key={objRecord.slug} className="flex-shrink-0" style={{ width: '280px' }}>
            <RecordCountCard record={objRecord} />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/**
 * Individual record count stat card.
 */
function RecordCountCard({
  record,
}: {
  record: ObjectRecordCount;
}): React.ReactElement {
  return (
    <StatCard
      label={record.labelPlural}
      value={record.count.toLocaleString()}
      icon={getIconForObject(record.icon)}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KPI cards row for the SabCRM dashboard.
 *
 * Renders four rows of stat cards:
 *   1. Record counts (scrollable if 4+)
 *   2. Pipeline value
 *   3. Task KPIs (Due Today / Overdue)
 *   4. New this week
 *
 * Fully static — no state, no refetches. Ideal for server-component parents.
 */
export function KpiCards({
  kpis,
  className,
}: KpiCardsProps): React.ReactElement {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Record counts per object */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-zoru-ink">Records</h3>
        <RecordCountCards recordCounts={kpis.recordCounts} />
      </div>

      {/* Pipeline value + task KPIs in a 2-column grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Open opportunities + pipeline value */}
        <StatCard
          label="Pipeline Value"
          value={`$${formatCurrency(kpis.opportunities.pipelineValue)}`}
          icon={<Briefcase />}
        />

        {/* Task KPIs: "Due Today" and "Overdue" in a sub-grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            label="Due Today"
            value={kpis.tasks.dueToday}
            icon={<CheckCircle />}
          />
          <StatCard
            label="Overdue"
            value={kpis.tasks.overdue}
            invertDelta
            icon={<Activity />}
          />
        </div>
      </div>

      {/* New records this week */}
      <StatCard
        label="New This Week"
        value={kpis.newThisWeek.count}
        period={getWeekRangeLabel(kpis.newThisWeek.weekStart)}
        icon={<Note />}
      />
    </div>
  );
}
