'use client';

import {
  Badge,
  Button,
  Card,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
} from '@/components/zoruui';
import {
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { Users,
  Trophy,
  DollarSign,
  Handshake,
  Plus,
  Pin } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { getCrmDashboardStats } from '@/app/actions/crm.actions';
import { getPinnedQuickList } from '@/app/actions/worksuite/dashboard.actions';
import {
  getMyWidgets,
  type WidgetKey,
  type WidgetPref,
} from '@/app/actions/dashboard-widgets.actions';
import type { WsPinnedItem } from '@/lib/worksuite/dashboard-types';
import { useT } from '@/lib/i18n/client';

import {
  RecentDealsCard,
  UpcomingTasksCard,
  PipelineBreakdownCard,
  RecentContactsCard,
  InvoiceSummaryCard,
} from './crm-dashboard-components';
import { WidgetConfigDrawer } from './widget-config-drawer';
import { RenderWidget } from './widget-registry';
import { PinnedItemsWidget } from './pinned-items-widget';

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
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] text-zoru-ink-muted">{title}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneBg[tone]}`}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
      </div>
      <p className="mt-3 text-[26px] leading-none text-zoru-ink">{value}</p>
    </Card>
  );
}

type PinnedRow = WsPinnedItem & { _id: string };

function PinnedQuickCard({ items }: { items: PinnedRow[] }) {
  const { t } = useT();
  if (!items || items.length === 0) return null;
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2">
            <Pin className="h-4 w-4 text-zoru-ink" strokeWidth={1.75} />
          </div>
          <h2 className="text-[15px] text-zoru-ink">{t('crm.dashboard.pinned.title')}</h2>
          <Badge variant="ghost">{items.length}</Badge>
        </div>
        <Link href="/dashboard/crm/pinned">
          <Button variant="outline" size="sm">{t('crm.dashboard.pinned.viewAll')}</Button>
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <li
            key={it._id}
            className="flex items-center gap-2 rounded-lg border border-zoru-line bg-zoru-bg p-2"
          >
            <Badge variant="ghost">{it.resource_type}</Badge>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-zoru-ink">
              {it.title || `${it.resource_type} ${String(it.resource_id).slice(-6)}`}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function CrmDashboardClient({
  initialStats,
  initialPinned,
}: {
  initialStats: any;
  initialPinned: PinnedRow[];
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const [stats, setStats] = useState<any>(initialStats);
  const [isLoading, setIsLoading] = useState(false);
  const [pinned, setPinned] = useState<PinnedRow[]>(initialPinned);
  const [widgetPrefs, setWidgetPrefs] = useState<WidgetPref[]>([]);
  const [widgetReloadKey, setWidgetReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getMyWidgets('overview')
      .then((prefs) => {
        if (cancelled) return;
        setWidgetPrefs(prefs);
      })
      .catch(() => {
        if (cancelled) return;
        setWidgetPrefs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [widgetReloadKey]);

  const enabledWidgets: WidgetPref[] = widgetPrefs
    .filter((w) => w.enabled)
    .sort((a, b) => a.position - b.position);
  const enabledKeys = new Set<WidgetKey>(enabledWidgets.map((w) => w.widgetKey));

  if (isLoading || !stats) {
    return (
      <div className="flex w-full flex-col gap-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 w-full rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const currency = stats.currency || 'USD';

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>{t('crm.dashboard.title')}</ZoruPageTitle>
            <ZoruPageDescription>
              {t('crm.dashboard.subtitle')}
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <div className="flex flex-wrap items-center gap-2">
          <WidgetConfigDrawer
            dashboardType="overview"
            onConfigChange={() => setWidgetReloadKey((k) => k + 1)}
          />
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/crm/contacts')}
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            {t('crm.dashboard.action.newContact')}
          </Button>
          <Button onClick={() => router.push('/dashboard/crm/deals')}>
            <Handshake className="h-4 w-4" strokeWidth={1.75} />
            {t('crm.dashboard.action.newDeal')}
          </Button>
        </div>
      </div>

      {/* Pinned items widget — full manager + drag-reorder. */}
      <PinnedItemsWidget />

      {/* Legacy pinned quick-list (only renders when user has pinned items). */}
      <PinnedQuickCard items={pinned} />

      {/* Key stats (always shown — these are the high-level KPI tiles). */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('crm.dashboard.stat.totalContacts')}
          value={stats.counts?.contacts?.toLocaleString() ?? 0}
          icon={Users}
          tone="blue"
        />
        <StatCard
          title={t('crm.dashboard.stat.totalDeals')}
          value={stats.counts?.deals?.toLocaleString() ?? 0}
          icon={Handshake}
          tone="rose"
        />
        <StatCard
          title={t('crm.dashboard.stat.dealsWon')}
          value={stats.counts?.dealsWon?.toLocaleString() ?? 0}
          icon={Trophy}
          tone="green"
        />
        <StatCard
          title={t('crm.dashboard.stat.pipelineRevenue')}
          value={new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
          }).format(stats.counts?.pipelineValue ?? 0)}
          icon={DollarSign}
          tone="amber"
        />
      </div>

      {/* Pipeline + invoices (visibility honors widget preferences). */}
      <div className="grid gap-4 lg:grid-cols-3">
        <PipelineBreakdownCard stages={stats.pipelineStages} currency={currency} />
        <InvoiceSummaryCard stats={stats.invoiceStats} currency={currency} />
      </div>

      {/* Recent activity (kept always-on — these are essential rails). */}
      <div className="grid gap-4 lg:grid-cols-4">
        {enabledKeys.has('won-deals') ? (
          <RecentDealsCard deals={stats.recentDeals} currency={currency} />
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-2">
          {enabledKeys.has('today-tasks') ? (
            <UpcomingTasksCard tasks={stats.upcomingTasks} />
          ) : null}
          {enabledKeys.has('new-leads') ? (
            <RecentContactsCard contacts={stats.recentContacts} />
          ) : null}
        </div>
      </div>

      {/* Registry-driven widget grid — conditional on user prefs. */}
      {enabledWidgets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {enabledWidgets.map((w) => (
            <RenderWidget
              key={w.widgetKey}
              widgetKey={w.widgetKey}
              label={w.label}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
