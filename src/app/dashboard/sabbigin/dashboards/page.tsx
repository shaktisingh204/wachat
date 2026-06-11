import Link from 'next/link';
import {
  Activity,
  CalendarPlus,
  CircleDollarSign,
  Handshake,
  Trophy,
  UserPlus,
} from 'lucide-react';

import {
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  StatCard,
} from '@/components/sabcrm/20ui';

import { formatCurrency } from '@/components/sabbigin/lib/format';
import { loadDashboardData } from './_data';
import { DashboardCharts } from './_components/dashboard-charts';

export const dynamic = 'force-dynamic';

export default async function SabbiginDashboardsPage() {
  const data = await loadDashboardData();
  const { kpis, currency } = data;

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBigin</PageEyebrow>
          <PageTitle>Dashboards</PageTitle>
          <PageDescription>
            Live analytics across your pipeline, deals, and activity — computed
            from your CRM data.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link
            href="/dashboard/sabbigin/deals"
            className="u-btn u-btn--primary u-btn--sm"
          >
            <Handshake size={13} aria-hidden="true" />
            <span className="u-btn__label">Go to deals</span>
          </Link>
        </PageActions>
      </PageHeader>

      {!data.hasAnyData ? (
        <EmptyState
          icon={Activity}
          title="Your dashboard fills in as you work"
          description="Add contacts, create deals, and log activities — KPIs, a pipeline funnel, monthly trends, and pipeline distribution will appear here automatically."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/dashboard/sabbigin/contacts/new"
                className="u-btn u-btn--primary u-btn--sm"
              >
                <span className="u-btn__label">Add a contact</span>
              </Link>
              <Link
                href="/dashboard/sabbigin/deals/new"
                className="u-btn u-btn--outline u-btn--sm"
              >
                <span className="u-btn__label">Create a deal</span>
              </Link>
            </div>
          }
        />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Link href="/dashboard/sabbigin/deals?view=board" className="block">
              <StatCard
                label="Open deals"
                value={kpis.openDeals}
                icon={Handshake}
                accent="#1f9d55"
              />
            </Link>
            <Link href="/dashboard/sabbigin/deals?view=board" className="block">
              <StatCard
                label="Open value"
                value={formatCurrency(kpis.openValue, currency)}
                icon={CircleDollarSign}
                accent="#3b7af5"
              />
            </Link>
            <Link href="/dashboard/sabbigin/deals?view=list" className="block">
              <StatCard
                label="Won this month"
                value={formatCurrency(kpis.wonThisMonthValue, currency)}
                icon={Trophy}
                accent="#f59e0b"
              />
            </Link>
            <Link href="/dashboard/sabbigin/contacts" className="block">
              <StatCard
                label="Contacts this month"
                value={kpis.contactsThisMonth}
                icon={UserPlus}
                accent="#0891b2"
              />
            </Link>
            <Link href="/dashboard/sabbigin/activities" className="block">
              <StatCard
                label="Activities done"
                value={kpis.activitiesCompleted}
                icon={CalendarPlus}
                accent="#7c3aed"
              />
            </Link>
          </div>

          {/* Charts */}
          <DashboardCharts
            stages={data.stages}
            months={data.months}
            pipelines={data.pipelines}
            currency={currency}
          />
        </>
      )}
    </div>
  );
}
