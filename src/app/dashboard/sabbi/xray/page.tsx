/**
 * X-ray — pick a model to auto-generate a full dashboard from its semantic
 * types (one breakdown per dimension + a KPI per measure), savable as a board.
 */
import Link from 'next/link';
import { ArrowRight, ScanSearch } from 'lucide-react';

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';
import { listModelsAction } from '@/app/actions/sabbi-models.actions';

export const dynamic = 'force-dynamic';

export default async function XrayIndexPage() {
  let models: Awaited<ReturnType<typeof listModelsAction>>['items'] = [];
  try {
    models = (await listModelsAction({ limit: 200 })).items;
  } catch {
    models = [];
  }

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI</PageEyebrow>
          <PageTitle>X-ray</PageTitle>
          <PageDescription>
            Instantly generate a full dashboard from any model — no query
            building. Save the ones you like as a board.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {models.length === 0 ? (
        <EmptyState
          icon={ScanSearch}
          tone="info"
          title="No models to X-ray"
          description="Connect a module or create a model first."
        />
      ) : (
        <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => (
            <Link key={m._id} href={`/dashboard/sabbi/xray/${m._id}`}>
              <Card className="h-full transition-colors hover:border-[var(--st-accent)]">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <ScanSearch size={16} aria-hidden="true" />
                      {m.name}
                    </span>
                    <ArrowRight size={16} aria-hidden="true" className="text-[var(--st-text-secondary)]" />
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="flex gap-2">
                    <Badge tone="neutral">{m.measures?.length ?? 0} measures</Badge>
                    <Badge tone="neutral">{m.dimensions?.length ?? 0} dims</Badge>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
