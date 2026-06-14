import * as React from 'react';

import {
  Card,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import { renderIcon } from '@/components/sabcrm/20ui/_icon';
import type { IconProp } from '@/components/sabcrm/20ui/_icon';

/**
 * SabHRM page shell — a consistent header + padded content column for every
 * `/sabhrm/*` page (rendered inside the SabHomeShell `<main>`).
 */
export function SabHrmPageShell({
  title,
  description,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{title}</PageTitle>
          {description ? <PageDescription>{description}</PageDescription> : null}
        </PageHeaderHeading>
        {actions ? <PageActions>{actions}</PageActions> : null}
      </PageHeader>
      <div className="mt-6">{children}</div>
    </div>
  );
}

/** Compact KPI card used across the dashboard + per-surface headers. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: IconProp;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-[var(--st-status-ok,#16a34a)]'
      : tone === 'warning'
        ? 'text-[var(--st-status-warn,#d97706)]'
        : tone === 'danger'
          ? 'text-[var(--st-status-bad,#dc2626)]'
          : 'text-[var(--st-text)]';
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
          {label}
        </span>
        {icon ? (
          <span className="text-[var(--st-text-secondary)]">
            {renderIcon(icon, { className: 'h-4 w-4', 'aria-hidden': true })}
          </span>
        ) : null}
      </div>
      <span className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</span>
      {hint ? (
        <span className="text-xs text-[var(--st-text-secondary)]">{hint}</span>
      ) : null}
    </Card>
  );
}

/** Format a number as currency for the active workspace (best-effort). */
export function formatMoney(value: number | null | undefined, currency = 'INR'): string {
  if (value == null || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return String(value);
  }
}

/** Render a status pill class for any of the SabHRM status enums. */
export function statusTone(status: string): 'default' | 'positive' | 'warning' | 'danger' {
  switch (status) {
    case 'active':
    case 'approved':
    case 'paid':
    case 'completed':
    case 'present':
      return 'positive';
    case 'probation':
    case 'pending':
    case 'computed':
    case 'in_progress':
    case 'on_leave':
    case 'half_day':
    case 'late':
      return 'warning';
    case 'terminated':
    case 'rejected':
    case 'overdue':
    case 'absent':
      return 'danger';
    default:
      return 'default';
  }
}
