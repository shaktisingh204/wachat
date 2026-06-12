/**
 * SabCRM Finance — shared server-side report scaffolding, 20ui.
 *
 * The tranche-3 statement pages (trial balance, P&L, balance sheet,
 * cash flow, GST, e-way bills) are READ-ONLY: fully server-rendered
 * 20ui Cards + Tables with link-based period switchers — no client
 * bundle beyond the 20ui primitives themselves. This module keeps the
 * six pages thin and visually consistent.
 *
 * ONLY `@/components/sabcrm/20ui` barrel imports (repo rule).
 */

import * as React from 'react';
import Link from 'next/link';

import {
  Alert,
  Badge,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './finance-report.css';

/* ─── Formatting ──────────────────────────────────────────────── */

/** `1234567.5` → `₹12,34,567.50` (suite default currency). */
export function formatINR(amount: number): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `INR ${amount.toFixed(2)}`;
  }
}

/** `2026-06-12T…` → `12 Jun 2026` (deterministic, no TZ drift). */
export function formatReportDate(iso: string): string {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split('-');
  if (!y || !m || !d) return day || '—';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${Number(d)} ${months[Number(m) - 1] ?? m} ${y}`;
}

/**
 * Period-compare Δ%. `null` when the baseline is 0/absent (a Δ against
 * nothing is noise, not signal). Tones map onto 20ui `StatCard.delta`.
 */
export function deltaPct(
  current: number,
  previous: number | undefined,
): { value: string; tone: 'up' | 'down' | 'neutral' } | null {
  if (previous === undefined || !Number.isFinite(previous) || previous === 0) {
    return null;
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return {
    value: `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`,
    tone: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'neutral',
  };
}

/* ─── Period math (drill-down + as-of helpers) ────────────────── */

/** Inclusive `YYYY-MM-DD` bounds of one calendar month (`month1` 1-12). */
export function monthBounds(
  year: number,
  month1: number,
): { from: string; to: string } {
  const lastDay = new Date(Date.UTC(year, month1, 0)).getUTCDate();
  const mm = String(month1).padStart(2, '0');
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * The last `count` month-end day-keys before today (newest first) —
 * the as-of PeriodSwitcher on trial balance / balance sheet.
 */
export function recentMonthEnds(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  let y = now.getUTCFullYear();
  let m0 = now.getUTCMonth(); // `Date.UTC(y, m0, 0)` = last day of the PREVIOUS month
  for (let i = 0; i < count; i += 1) {
    out.push(new Date(Date.UTC(y, m0, 0)).toISOString().slice(0, 10));
    m0 -= 1;
    if (m0 < 0) {
      m0 = 11;
      y -= 1;
    }
  }
  return out;
}

/** Most recent PAST Indian FY end (`31 Mar`), as a `YYYY-MM-DD` key. */
export function lastFyEnd(): string {
  const now = new Date();
  const y =
    now.getUTCMonth() + 1 >= 4
      ? now.getUTCFullYear()
      : now.getUTCFullYear() - 1;
  return `${y}-03-31`;
}

/* ─── Drill-down link (server-safe) ───────────────────────────── */

/**
 * An aggregate cell that deep-links into the filtered source list
 * (the doc list pages parse the same `q/status/partyId/from/to`
 * searchParams into the kit's `initialFilters`). Zero client JS.
 */
export function DrillLink({
  href,
  title,
  children,
}: {
  href: string;
  title?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Link href={href} title={title} className="fin-drill">
      {children}
    </Link>
  );
}

/* ─── Shell ───────────────────────────────────────────────────── */

export interface ReportShellProps {
  title: string;
  description: string;
  /** Right-aligned header content (period switchers). */
  actions?: React.ReactNode;
  /** Non-null ⇒ the data fetch failed; body is replaced by the alert. */
  error?: string | null;
  /** The derivation note shown under the report body. */
  methodology?: string;
  children?: React.ReactNode;
}

export function ReportShell({
  title,
  description,
  actions,
  error,
  methodology,
  children,
}: ReportShellProps): React.JSX.Element {
  return (
    <div className="fin-report mx-auto w-full max-w-[1120px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{title}</PageTitle>
          <PageDescription>{description}</PageDescription>
        </PageHeaderHeading>
        {actions ? (
          <div
            className="flex shrink-0 flex-wrap items-center justify-end gap-2"
            data-print-hide
          >
            {actions}
          </div>
        ) : null}
      </PageHeader>

      {error ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load {title.toLowerCase()}: {error}
          </Alert>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">{children}</div>
      )}

      {!error && methodology ? (
        <p className="mt-6 text-xs text-[var(--ui20-color-text-muted,#6b7280)]">
          {methodology}
        </p>
      ) : null}
    </div>
  );
}

/* ─── Period switcher (link-based, server-safe) ───────────────── */

export interface PeriodLink {
  label: string;
  href: string;
  active?: boolean;
}

/** A row of pill links for switching the report period. */
export function PeriodSwitcher({
  links,
  label,
}: {
  links: PeriodLink[];
  label: string;
}): React.JSX.Element {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {links.map((l) =>
        l.active ? (
          <Badge key={l.href} tone="info">
            {l.label}
          </Badge>
        ) : (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full border border-[var(--ui20-color-border,#e5e7eb)] px-2.5 py-0.5 text-xs font-medium text-[var(--ui20-color-text-muted,#6b7280)] no-underline hover:text-[var(--ui20-color-text,#111827)]"
          >
            {l.label}
          </Link>
        ),
      )}
    </nav>
  );
}

/* ─── Empty body ──────────────────────────────────────────────── */

export function ReportEmpty({
  message,
}: {
  message: string;
}): React.JSX.Element {
  return (
    <Alert tone="info" role="status">
      {message}
    </Alert>
  );
}
