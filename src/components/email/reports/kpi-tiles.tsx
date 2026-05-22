'use client';

import {
  AlertCircle,
  CheckCircle2,
  MailMinus,
  MousePointerClick,
  Send,
  UserMinus,
} from 'lucide-react';
import { StatCard } from '@/components/zoruui';
import type { EmailMetricsTotals } from '@/lib/rust-client/email-reports';

interface KpiTilesProps {
  totals: EmailMetricsTotals;
}

function fmt(n: number | undefined): string {
  if (!n || Number.isNaN(n)) return '0';
  return n.toLocaleString();
}

function pct(rate: number | undefined): string | undefined {
  if (rate === undefined || rate === null || Number.isNaN(rate)) return undefined;
  return `${(rate * 100).toFixed(1)}% rate`;
}

export function KpiTiles({ totals }: KpiTilesProps) {
  const tiles = [
    {
      label: 'Sent',
      value: fmt(totals.sent),
      icon: <Send className="h-4 w-4" />,
      period: undefined,
    },
    {
      label: 'Delivered',
      value: fmt(totals.delivered),
      icon: <CheckCircle2 className="h-4 w-4" />,
      period: pct(totals.deliveryRate),
    },
    {
      label: 'Opened',
      value: fmt(totals.opened),
      icon: <MailMinus className="h-4 w-4" />,
      period: pct(totals.openRate),
    },
    {
      label: 'Clicked',
      value: fmt(totals.clicked),
      icon: <MousePointerClick className="h-4 w-4" />,
      period: pct(totals.clickRate),
    },
    {
      label: 'Bounced',
      value: fmt(totals.bounced),
      icon: <AlertCircle className="h-4 w-4" />,
      period: pct(totals.bounceRate),
      invertDelta: true,
    },
    {
      label: 'Unsubscribed',
      value: fmt(totals.unsubscribed),
      icon: <UserMinus className="h-4 w-4" />,
      period: pct(totals.unsubscribeRate),
      invertDelta: true,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <ZoruStatCard
          key={t.label}
          label={t.label}
          value={t.value}
          icon={t.icon}
          period={t.period}
          invertDelta={t.invertDelta}
        />
      ))}
    </div>
  );
}
