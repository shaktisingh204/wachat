/**
 * SabBigin — New deal.
 *
 * Server page: loads the user's pipelines (for the pipeline + stage
 * pickers) and honours `?pipeline=` / `?stage=` so a "New deal" launched
 * from a board column lands pre-targeted. The form itself is a client
 * component that submits through `createSabbiginDeal` and redirects to the
 * fresh deal's detail page.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Card,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { Workflow } from 'lucide-react';

import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';

import { DealForm, type DealFormPipeline } from './_components/deal-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ pipeline?: string; stage?: string }>;
}

export default async function SabbiginNewDealPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const rawPipelines = await getCrmPipelines();
  const pipelines: DealFormPipeline[] = rawPipelines.map((p) => ({
    id: String(p.id),
    name: p.name,
    stages: (p.stages ?? []).map((s) => ({
      id: String(s.id),
      name: s.name,
      probability: typeof s.chance === 'number' ? s.chance : null,
    })),
  }));

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBigin · Deals</PageEyebrow>
          <PageTitle>New deal</PageTitle>
          <PageDescription>
            Capture the essentials. You can fill in the rest from the deal
            detail once it&apos;s created.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link href="/dashboard/sabbigin/deals" className="u-btn u-btn--ghost u-btn--sm">
            <ArrowLeft size={13} aria-hidden="true" />
            <span className="u-btn__label">Back</span>
          </Link>
        </PageActions>
      </PageHeader>

      {pipelines.length === 0 ? (
        <Card padding="none" className="flex min-h-[260px] items-center justify-center">
          <EmptyState
            icon={Workflow}
            title="Create a pipeline first"
            description="Deals live inside a pipeline. Set one up, then come back to add deals."
            action={
              <Link
                href="/dashboard/sabbigin/pipelines/new"
                className="u-btn u-btn--primary u-btn--sm"
              >
                <span className="u-btn__label">New pipeline</span>
              </Link>
            }
          />
        </Card>
      ) : (
        <DealForm
          pipelines={pipelines}
          initialPipelineId={sp.pipeline ?? null}
          initialStage={sp.stage ?? null}
        />
      )}
    </div>
  );
}
