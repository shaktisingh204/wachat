'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  IndianRupee,
  Landmark,
  Link2,
  Repeat,
  ShoppingCart,
  Undo2,
  type LucideIcon,
} from 'lucide-react';

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import { formatSabpayAmount, type SabpayPayment } from '@/lib/sabpay/types';

import type { SabpayOverviewData } from '../actions';
import { PaymentStatusBadge } from './payment-status-badge';

/** 14-day succeeded-volume sparkline; draws itself in once on mount. */
function VolumeSpark({ series }: { series: SabpayOverviewData['stats']['series'] }) {
  const W = 600;
  const H = 140;
  const PAD = 6;
  const max = Math.max(...series.map((d) => d.volume), 1);
  const step = (W - PAD * 2) / Math.max(series.length - 1, 1);
  const points = series.map((d, i) => ({
    x: PAD + i * step,
    y: H - PAD - (d.volume / max) * (H - PAD * 2),
  }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `${line} L${points[points.length - 1].x},${H} L${points[0].x},${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Successful payment volume over the last 14 days"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <defs>
        <linearGradient id="sabpay-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--st-accent, #4f46e5)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--st-accent, #4f46e5)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="sabpay-spark__fill" d={area} fill="url(#sabpay-spark-grad)" />
      <path
        className="sabpay-spark__line"
        d={line}
        fill="none"
        stroke="var(--st-accent, #4f46e5)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
    </svg>
  );
}

interface QuickLink {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const QUICK_LINKS: QuickLink[] = [
  {
    href: '/sabpay/orders',
    label: 'Orders',
    description: 'Server-side orders and their payments',
    icon: ShoppingCart,
  },
  {
    href: '/sabpay/refunds',
    label: 'Refunds',
    description: 'Full and partial refunds',
    icon: Undo2,
  },
  {
    href: '/sabpay/payment-links',
    label: 'Payment Links',
    description: 'Shareable hosted checkout links',
    icon: Link2,
  },
  {
    href: '/sabpay/subscriptions',
    label: 'Subscriptions',
    description: 'Recurring billing on plans',
    icon: Repeat,
  },
  {
    href: '/sabpay/settlements',
    label: 'Settlements',
    description: 'Payouts to your bank account',
    icon: Landmark,
  },
];

function QuickLinkCard({ link }: { link: QuickLink }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      style={{ display: 'block', minWidth: 0, textDecoration: 'none', color: 'inherit' }}
    >
      <Card style={{ height: '100%' }}>
        <CardBody style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              flexShrink: 0,
              border: '1px solid var(--st-border)',
              background: 'var(--st-bg)',
              color: 'var(--st-accent, #4f46e5)',
            }}
          >
            <Icon size={16} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {link.label}
              <ArrowUpRight size={13} aria-hidden style={{ color: 'var(--st-text-muted)' }} />
            </span>
            <span
              style={{
                display: 'block',
                marginTop: 2,
                fontSize: 12.5,
                color: 'var(--st-text-muted)',
              }}
            >
              {link.description}
            </span>
          </span>
        </CardBody>
      </Card>
    </Link>
  );
}

function RecentRow({ payment }: { payment: SabpayPayment }) {
  return (
    <Tr>
      <Td>
        <Link
          href={`/sabpay/payments/${payment.id}`}
          style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}
        >
          {payment.id}
        </Link>
      </Td>
      <Td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {formatSabpayAmount(payment.amount, payment.currency)}
      </Td>
      <Td>
        <PaymentStatusBadge status={payment.status} />
      </Td>
      <Td>{payment.description}</Td>
      <Td>{new Date(payment.createdAt).toLocaleString()}</Td>
    </Tr>
  );
}

export function OverviewClient({ data }: { data: SabpayOverviewData }) {
  const { merchant, stats, recent } = data;

  return (
    <>
      <div className="sabpay-rise" style={{ ['--rise-i' as string]: 0 }}>
        <Badge tone={merchant.mode === 'live' ? 'success' : 'warning'}>
          {merchant.mode === 'live' ? 'Live mode' : 'Test mode'}
        </Badge>
      </div>

      <div
        className="sabpay-rise"
        style={{
          ['--rise-i' as string]: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--st-space-4, 16px)',
        }}
      >
        <StatCard
          label="Volume collected"
          value={formatSabpayAmount(stats.totalVolume)}
          icon={IndianRupee}
        />
        <StatCard
          label="Payments"
          value={stats.totalCount}
          icon={ArrowLeftRight}
          delta={
            stats.createdCount > 0
              ? { value: `${stats.createdCount} open`, tone: 'neutral' }
              : undefined
          }
        />
        <StatCard
          label="Success rate"
          value={`${stats.successRate}%`}
          icon={CheckCircle2}
          delta={
            stats.failedCount > 0
              ? { value: `${stats.failedCount} failed`, tone: 'down' }
              : undefined
          }
        />
      </div>

      <section
        className="sabpay-rise"
        aria-label="Explore SabPay"
        style={{
          ['--rise-i' as string]: 2,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--st-space-3, 12px)',
        }}
      >
        {QUICK_LINKS.map((link) => (
          <QuickLinkCard key={link.href} link={link} />
        ))}
      </section>

      <Card className="sabpay-rise" style={{ ['--rise-i' as string]: 3 }}>
        <CardHeader>
          <CardTitle>Last 14 days</CardTitle>
        </CardHeader>
        <CardBody>
          {stats.series.some((d) => d.volume > 0) ? (
            <VolumeSpark series={stats.series} />
          ) : (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              No successful payments yet. Create a payment from the API or the
              Payments page and the chart fills in here.
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="sabpay-rise" style={{ ['--rise-i' as string]: 4 }}>
        <CardHeader>
          <CardTitle>Recent payments</CardTitle>
          <Link href="/sabpay/payments" style={{ fontSize: 13, fontWeight: 550 }}>
            View all
          </Link>
        </CardHeader>
        <CardBody>
          {recent.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              Nothing here yet. Head to <Link href="/sabpay/developers">Developers</Link>{' '}
              to grab an API key and create your first payment.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Payment</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Description</Th>
                  <Th>Created</Th>
                </Tr>
              </THead>
              <TBody>
                {recent.map((p) => (
                  <RecentRow key={p.id} payment={p} />
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </>
  );
}
