'use client';

import {
  AlertCircle,
  CheckCircle2,
  MailMinus,
  MousePointerClick,
  Send,
  UserMinus,
} from 'lucide-react';
import { StatCard } from '@/components/sabcrm/20ui/compat';
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
  // The Rust report endpoint may omit `totals` on a brand-new account. Guard
  // against undefined so a partial payload never crashes the page at render.
  const t = totals ?? ({} as Partial<EmailMetricsTotals>);
  const tiles = [
    {
      label: 'Sent',
      value: fmt(t.sent),
      icon: <Send className="h-4 w-4" />,
      period: undefined,
    },
    {
      label: 'Delivered',
      value: fmt(t.delivered),
      icon: <CheckCircle2 className="h-4 w-4" />,
      period: pct(t.deliveryRate),
    },
    {
      label: 'Opened',
      value: fmt(t.opened),
      icon: <MailMinus className="h-4 w-4" />,
      period: pct(t.openRate),
    },
    {
      label: 'Clicked',
      value: fmt(t.clicked),
      icon: <MousePointerClick className="h-4 w-4" />,
      period: pct(t.clickRate),
    },
    {
      label: 'Bounced',
      value: fmt(t.bounced),
      icon: <AlertCircle className="h-4 w-4" />,
      period: pct(t.bounceRate),
      invertDelta: true,
    },
    {
      label: 'Unsubscribed',
      value: fmt(t.unsubscribed),
      icon: <UserMinus className="h-4 w-4" />,
      period: pct(t.unsubscribeRate),
      invertDelta: true,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <StatCard
          key={tile.label}
          label={tile.label}
          value={tile.value}
          icon={tile.icon}
          period={tile.period}
          invertDelta={tile.invertDelta}
        />
      ))}
    </div>
  );
}
