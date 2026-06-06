import { Button } from '@/components/sabcrm/20ui/compat';
import * as React from 'react';

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
      className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
    >
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
          From
        </span>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
          To
        </span>
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="h-9 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 text-[13px] text-[var(--st-text)]"
        />
      </label>
      {extra}
      <Button type="submit" size="sm">
        Apply
      </Button>
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
    default: 'text-[var(--st-text)]',
    green: 'text-[var(--st-text)]',
    red: 'text-[var(--st-text)]',
    amber: 'text-[var(--st-text)]',
    blue: 'text-[var(--st-text)]',
  };
  return (
    <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 shadow-sm">
      <div className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div
        className={`mt-1 text-[22px] font-semibold leading-tight ${toneClass[tone]}`}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[12px] text-[var(--st-text-secondary)]">{hint}</div>
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
    rose: 'bg-[var(--st-text)]',
    obsidian: 'bg-[var(--st-text)]',
    green: 'bg-[var(--st-text)]',
    amber: 'bg-[var(--st-text)]',
    red: 'bg-[var(--st-text)]',
    blue: 'bg-[var(--st-text)]',
  };
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="truncate text-[var(--st-text)]">{label}</span>
        <span className="font-medium text-[var(--st-text)]">
          {rightLabel ?? value}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--st-bg-muted)]">
        <div
          className={`h-full rounded-full ${toneBg[tone] || toneBg.rose}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Format currency using INR by default. */
import { fmtINR } from '@/lib/utils';

export function fmtMoney(n: number, currency = 'INR'): string {
  return fmtINR(n, currency);
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
}

export function fmtPct(n: number, digits = 1): string {
  if (!isFinite(n)) return '—';
  return `${n >= 0 ? '' : ''}${n.toFixed(digits)}%`;
}

export function fmtDays(n: number): string {
  if (!isFinite(n) || n <= 0) return '—';
  return `${Math.round(n)} days`;
}

export function fmtMinutes(m: number): string {
  if (!m) return '—';
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return mm ? `${h}h ${mm}m` : `${h}h`;
}
