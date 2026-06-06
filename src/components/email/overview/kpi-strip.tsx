'use client';

import { Activity, MousePointerClick, Send, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';

export interface EmailKpiStripProps {
  sent: number;
  openRate?: number;
  clickRate?: number;
  revenue?: number;
  deltas?: {
    sent?: string;
    openRate?: string;
    clickRate?: string;
    revenue?: string;
  };
}

interface KpiTile {
  label: string;
  value: string;
  delta?: string;
  icon: LucideIcon;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatPercent(n?: number): string {
  if (n == null) return '—';
  return `${n.toFixed(1)}%`;
}

function formatCurrency(n?: number): string {
  if (n == null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function EmailKpiStrip({
  sent,
  openRate,
  clickRate,
  revenue,
  deltas,
}: EmailKpiStripProps) {
  const tiles: KpiTile[] = [
    { label: 'Emails sent',  value: formatNumber(sent),         delta: deltas?.sent,      icon: Send },
    { label: 'Open rate',    value: formatPercent(openRate),    delta: deltas?.openRate,  icon: Activity },
    { label: 'Click rate',   value: formatPercent(clickRate),   delta: deltas?.clickRate, icon: MousePointerClick },
    { label: 'Revenue',      value: formatCurrency(revenue),    delta: deltas?.revenue,   icon: TrendingUp },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map((t) => (
        <Card key={t.label} className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-[var(--st-text-secondary)]">{t.label}</CardTitle>
            <t.icon className="h-4 w-4 text-[var(--st-text-secondary)]" />
          </CardHeader>
          <CardBody>
            <div className="text-2xl text-[var(--st-text)] font-semibold">{t.value}</div>
            {t.delta ? (
              <p className="text-xs text-[var(--st-text-secondary)]">{t.delta}</p>
            ) : null}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
