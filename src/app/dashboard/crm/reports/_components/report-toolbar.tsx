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
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card px-3 py-2"
    >
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          From
        </span>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          To
        </span>
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
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
    default: 'text-foreground',
    green: 'text-emerald-500',
    red: 'text-destructive',
    amber: 'text-amber-500',
    blue: 'text-sky-500',
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="text-[11.5px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-[22px] font-semibold leading-tight ${toneClass[tone]}`}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[12px] text-muted-foreground">{hint}</div>
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
    rose: 'bg-primary',
    obsidian: 'bg-foreground',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-destructive',
    blue: 'bg-sky-500',
  };
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="truncate text-foreground">{label}</span>
        <span className="font-medium text-foreground">
          {rightLabel ?? value}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
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
