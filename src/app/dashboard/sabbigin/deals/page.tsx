/**
 * SabBigin deals module — Board / List / Sheet over one pipeline at a time.
 * Replaces the old single `/pipeline` board and the full-CRM `DealKanban`
 * island with native SabBigin components.
 */

import Link from 'next/link';
import { Handshake, Plus, Wallet, Workflow, Percent } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  StatCard,
  Card,
  EmptyState,
} from '@/components/sabcrm/20ui';

import { DealBoard } from '@/components/sabbigin/deals/deal-board';
import { DealList } from '@/components/sabbigin/deals/deal-list';
import { DealsToolbar } from '@/components/sabbigin/deals/deals-toolbar';
import { SheetGrid } from '@/components/sabbigin/views/sheet-grid';
import { formatCurrency } from '@/components/sabbigin/lib/format';
import type { SabView } from '@/components/sabbigin/lib/types';

import { loadDealsModule } from './_data';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ view?: string; pipeline?: string }>;
}

export default async function SabbiginDealsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const view = (['board', 'list', 'sheet'].includes(sp.view ?? '')
    ? sp.view
    : 'board') as SabView;

  const data = await loadDealsModule({ pipelineParam: sp.pipeline });

  const openValue = data.deals.reduce((s, d) => s + (d.amount ?? 0), 0);
  const weighted = data.deals.reduce(
    (s, d) => s + (d.amount ?? 0) * ((d.probability ?? 0) / 100),
    0,
  );

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBigin · Deals</PageEyebrow>
          <PageTitle>{data.activePipelineName}</PageTitle>
          <PageDescription>
            Drag deals across stages. Gated stages prompt for required details
            and route approvals automatically.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link
            href="/dashboard/sabbigin/deals/new"
            className="u-btn u-btn--primary u-btn--sm"
          >
            <Plus size={13} aria-hidden="true" />
            <span className="u-btn__label">New deal</span>
          </Link>
        </PageActions>
      </PageHeader>

      {data.pipelines.length === 0 ? (
        <Card padding="none" className="flex min-h-[320px] items-center justify-center">
          <EmptyState
            icon={Workflow}
            title="Create your first pipeline"
            description="A pipeline defines the stages your deals move through. Set one up to start tracking deals."
            action={
              <Link
                href="/dashboard/sabbigin/pipelines/new"
                className="u-btn u-btn--primary u-btn--sm"
              >
                <Plus size={13} aria-hidden="true" />
                <span className="u-btn__label">New pipeline</span>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:max-w-2xl">
            <StatCard label="Deals" value={data.deals.length} icon={Handshake} accent="#3b7af5" />
            <StatCard label="Open value" value={formatCurrency(openValue, data.currency)} icon={Wallet} accent="#1f9d55" />
            <StatCard label="Weighted" value={formatCurrency(weighted, data.currency)} icon={Percent} accent="#a855f7" />
            <StatCard label="Stages" value={data.stages.length} icon={Workflow} accent="#f59e0b" />
          </div>

          <DealsToolbar
            pipelines={data.pipelines}
            activePipelineId={data.activePipelineId}
            view={view}
          />

          {data.deals.length === 0 ? (
            <Card padding="none" className="flex min-h-[260px] items-center justify-center">
              <EmptyState
                icon={Handshake}
                title="No deals in this pipeline yet"
                description="Add a deal or import your existing pipeline to get started."
                action={
                  <Link
                    href="/dashboard/sabbigin/deals/new"
                    className="u-btn u-btn--primary u-btn--sm"
                  >
                    <Plus size={13} aria-hidden="true" />
                    <span className="u-btn__label">New deal</span>
                  </Link>
                }
              />
            </Card>
          ) : view === 'board' ? (
            <DealBoard stages={data.stages} deals={data.deals} currency={data.currency} />
          ) : view === 'sheet' ? (
            <SheetGrid deals={data.deals} stages={data.stages} currency={data.currency} />
          ) : (
            <DealList deals={data.deals} stages={data.stages} currency={data.currency} />
          )}
        </>
      )}
    </div>
  );
}
