import * as React from 'react';
import { ClayButton } from '@/components/clay';

/**
 * ReportToolbar — a URL-driven date range filter used by Worksuite
 * report pages. Renders a simple `<form method="get">` so the page
 * can remain a server component.
 */
export function ReportToolbar({
  from,
  to,
  extra,
}: {
  from?: string;
  to?: string;
  extra?: React.ReactNode;
}) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-2 rounded-clay-md border border-clay-border bg-clay-surface px-3 py-2"
    >
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-clay-ink-muted">
          From
        </span>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="h-9 rounded-clay-md border border-clay-border bg-clay-surface px-2 text-[13px] text-clay-ink"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-clay-ink-muted">
          To
        </span>
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="h-9 rounded-clay-md border border-clay-border bg-clay-surface px-2 text-[13px] text-clay-ink"
        />
      </label>
      {extra}
      <ClayButton type="submit" variant="obsidian" size="sm">
        Apply
      </ClayButton>
    </form>
  );
}

/**
 * StatCard — a compact summary card used at the top of report pages.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'green' | 'red' | 'amber' | 'blue';
}) {
  const toneClass: Record<NonNullable<typeof tone>, string> = {
    default: 'text-clay-ink',
    green: 'text-clay-green',
    red: 'text-clay-red',
    amber: 'text-clay-amber',
    blue: 'text-clay-blue',
  };
  return (
    <div className="rounded-clay-lg border border-clay-border bg-clay-surface p-4 shadow-clay-card">
      <div className="text-[11.5px] uppercase tracking-wide text-clay-ink-muted">
        {label}
      </div>
      <div
        className={`mt-1 text-[22px] font-semibold leading-tight ${toneClass[tone]}`}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[12px] text-clay-ink-muted">{hint}</div>
      ) : null}
    </div>
  );
}

/** BarRow — a simple horizontal bar for tables of categorical data. */
export function BarRow({
  label,
  value,
  max,
  rightLabel,
  tone = 'rose',
}: {
  label: string;
  value: number;
  max: number;
  rightLabel?: string;
  tone?: 'rose' | 'obsidian' | 'green' | 'amber' | 'red' | 'blue';
}) {
  const pct = max > 0 ? Math.max(1, Math.round((value / max) * 100)) : 0;
  const toneBg: Record<string, string> = {
    rose: 'bg-clay-rose',
    obsidian: 'bg-clay-obsidian',
    green: 'bg-clay-green',
    amber: 'bg-clay-amber',
    red: 'bg-clay-red',
    blue: 'bg-clay-blue',
  };
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="truncate text-clay-ink">{label}</span>
        <span className="font-medium text-clay-ink">
          {rightLabel ?? value}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-clay-surface-2">
        <div
          className={`h-full rounded-full ${toneBg[tone] || toneBg.rose}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Format currency using INR by default. */
export function fmtMoney(n: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n || 0);
  } catch {
    return `${currency} ${Math.round(n || 0).toLocaleString('en-IN')}`;
  }
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
}

export function fmtMinutes(m: number): string {
  if (!m) return '—';
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return mm ? `${h}h ${mm}m` : `${h}h`;
}
