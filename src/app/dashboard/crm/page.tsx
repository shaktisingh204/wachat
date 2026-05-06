'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Trophy, DollarSign, Handshake, Plus, Pin } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { getCrmDashboardStats } from '@/app/actions/crm.actions';
import { getPinnedQuickList } from '@/app/actions/worksuite/dashboard.actions';
import type { WsPinnedItem } from '@/lib/worksuite/dashboard-types';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
} from '@/components/zoruui';
import {
  RecentDealsCard,
  UpcomingTasksCard,
  PipelineBreakdownCard,
  RecentContactsCard,
  InvoiceSummaryCard,
} from './_components/crm-dashboard-components';

function StatCard({
  title,
  value,
  icon: Icon,
  tone = 'rose',
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  tone?: 'rose' | 'green' | 'amber' | 'blue';
}) {
  const toneBg: Record<string, string> = {
    rose: 'bg-zoru-surface-2 text-zoru-ink',
    green: 'bg-zoru-success/10 text-zoru-success-ink',
    amber: 'bg-zoru-warning/15 text-zoru-warning-ink',
    blue: 'bg-zoru-surface-2 text-zoru-ink',
  };

  return (
    <ZoruCard className="p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] text-zoru-ink-muted">{title}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneBg[tone]}`}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
      </div>
      <p className="mt-3 text-[26px] leading-none text-zoru-ink">{value}</p>
    </ZoruCard>
  );
}

type PinnedRow = WsPinnedItem & { _id: string };

function PinnedQuickCard({ items }: { items: PinnedRow[] }) {
  if (!items || items.length === 0) return null;
  return (
    <ZoruCard className="p-6">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2">
            <Pin className="h-4 w-4 text-zoru-ink" strokeWidth={1.75} />
          </div>
          <h2 className="text-[15px] text-zoru-ink">Pinned</h2>
          <ZoruBadge variant="ghost">{items.length}</ZoruBadge>
        </div>
        <Link href="/dashboard/crm/pinned">
          <ZoruButton variant="outline" size="sm">View all</ZoruButton>
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <li
            key={it._id}
            className="flex items-center gap-2 rounded-lg border border-zoru-line bg-zoru-bg p-2"
          >
            <ZoruBadge variant="ghost">{it.resource_type}</ZoruBadge>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-zoru-ink">
              {it.title || `${it.resource_type} ${String(it.resource_id).slice(-6)}`}
            </span>
          </li>
        ))}
      </ul>
    </ZoruCard>
  );
}

export default function CrmDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pinned, setPinned] = useState<PinnedRow[]>([]);

  useEffect(() => {
    setIsLoading(true);
    getCrmDashboardStats().then((data) => {
      setStats(data);
      setIsLoading(false);
    });
    getPinnedQuickList(6)
      .then((rows) => setPinned((rows || []) as PinnedRow[]))
      .catch(() => setPinned([]));
  }, []);

  if (isLoading || !stats) {
    return (
      <div className="flex w-full flex-col gap-6">
        <div>
          <ZoruSkeleton className="h-8 w-64" />
          <ZoruSkeleton className="mt-2 h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ZoruSkeleton className="h-28 w-full rounded-xl" />
          <ZoruSkeleton className="h-28 w-full rounded-xl" />
          <ZoruSkeleton className="h-28 w-full rounded-xl" />
          <ZoruSkeleton className="h-28 w-full rounded-xl" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <ZoruSkeleton className="h-64 w-full rounded-xl lg:col-span-2" />
          <ZoruSkeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const currency = stats.currency || 'USD';

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ZoruPageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>CRM Dashboard</ZoruPageTitle>
            <ZoruPageDescription>
              An overview of your customer relationships, leads, and deals.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>
        <div className="flex flex-wrap items-center gap-2">
          <ZoruButton
            variant="outline"
            onClick={() => router.push('/dashboard/crm/contacts')}
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New Contact
          </ZoruButton>
          <ZoruButton onClick={() => router.push('/dashboard/crm/deals')}>
            <Handshake className="h-4 w-4" strokeWidth={1.75} />
            New Deal
          </ZoruButton>
        </div>
      </div>

      {/* Pinned quick-list (only renders when user has pinned items) */}
      <PinnedQuickCard items={pinned} />

      {/* Key stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Contacts"
          value={stats.counts?.contacts?.toLocaleString() ?? 0}
          icon={Users}
          tone="blue"
        />
        <StatCard
          title="Total Deals"
          value={stats.counts?.deals?.toLocaleString() ?? 0}
          icon={Handshake}
          tone="rose"
        />
        <StatCard
          title="Deals Won"
          value={stats.counts?.dealsWon?.toLocaleString() ?? 0}
          icon={Trophy}
          tone="green"
        />
        <StatCard
          title="Pipeline Revenue"
          value={new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
          }).format(stats.counts?.pipelineValue ?? 0)}
          icon={DollarSign}
          tone="amber"
        />
      </div>

      {/* Pipeline + invoices */}
      <div className="grid gap-4 lg:grid-cols-3">
        <PipelineBreakdownCard stages={stats.pipelineStages} currency={currency} />
        <InvoiceSummaryCard stats={stats.invoiceStats} currency={currency} />
      </div>

      {/* Recent activity */}
      <div className="grid gap-4 lg:grid-cols-4">
        <RecentDealsCard deals={stats.recentDeals} currency={currency} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-2">
          <UpcomingTasksCard tasks={stats.upcomingTasks} />
          <RecentContactsCard contacts={stats.recentContacts} />
        </div>
      </div>
    </div>
  );
}
