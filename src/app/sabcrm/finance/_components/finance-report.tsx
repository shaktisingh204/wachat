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
    <div className="mx-auto w-full max-w-[1120px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{title}</PageTitle>
          <PageDescription>{description}</PageDescription>
        </PageHeaderHeading>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
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
