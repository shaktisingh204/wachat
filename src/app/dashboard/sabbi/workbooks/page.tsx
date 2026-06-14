/**
 * Analytics Workspace - root page.
 *
 * Lists workbooks. "New workbook" creates an empty workbook and routes
 * the user into the editor. Distinct from `/dashboard/sabbi/dashboards`
 * (module-scoped) and `/dashboard/sabbi/analytics` (CRM analytics).
 */
import Link from 'next/link';
import {
  BarChart3,
  CalendarClock,
  Database,
  LayoutDashboard,
  Library,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  StatCard,
} from '@/components/sabcrm/20ui';
import { listWorkbooksAction } from '@/app/actions/analytics-bi.actions';

import { NewWorkbookButton } from './_components/new-workbook-button';

export const dynamic = 'force-dynamic';

export default async function AnalyticsWorkspacePage() {
  let workbooks: Awaited<ReturnType<typeof listWorkbooksAction>>['items'] = [];
  try {
    const res = await listWorkbooksAction({ limit: 100 });
    workbooks = res.items;
  } catch {
    workbooks = [];
  }

  const totalCharts = workbooks.reduce(
    (acc, wb) => acc + (wb.chartsJson?.length ?? 0),
    0,
  );
  const datasetsInUse = new Set(
    workbooks.flatMap((wb) => wb.datasetIds ?? []),
  ).size;

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI</PageEyebrow>
          <PageTitle>Workbooks</PageTitle>
          <PageDescription>
            Build workbooks, charts, and scheduled reports across any data source.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/sabbi/datasets">
              <Database size={16} aria-hidden="true" />
              Datasets
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/sabbi/schedules">
              <CalendarClock size={16} aria-hidden="true" />
              Schedules
            </Link>
          </Button>
          <NewWorkbookButton />
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-3">
        <StatCard
          label="Workbooks"
          value={workbooks.length}
          icon={LayoutDashboard}
          accent="var(--st-accent)"
        />
        <StatCard label="Charts" value={totalCharts} icon={BarChart3} />
        <StatCard label="Datasets in use" value={datasetsInUse} icon={Database} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Library size={16} aria-hidden="true" />
            Your workbooks
          </CardTitle>
        </CardHeader>
        <CardBody>
          {workbooks.length === 0 ? (
            <EmptyState
              icon={LayoutDashboard}
              tone="info"
              title="No workbooks yet"
              description="Workbooks group datasets and charts into a single, shareable analysis. Start by creating one."
              action={<NewWorkbookButton />}
            />
          ) : (
            <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-2 lg:grid-cols-3">
              {workbooks.map((wb) => {
                const chartCount = wb.chartsJson?.length ?? 0;
                const datasetCount = wb.datasetIds?.length ?? 0;
                return (
                  <Link
                    key={wb._id}
                    href={`/dashboard/sabbi/workbooks/${wb._id}`}
                    className="block"
                  >
                    <Card variant="interactive" className="h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <LayoutDashboard
                            size={16}
                            className="text-[var(--st-accent)]"
                            aria-hidden="true"
                          />
                          {wb.name}
                        </CardTitle>
                      </CardHeader>
                      <CardBody className="flex flex-col gap-3">
                        {wb.description ? (
                          <p className="text-sm text-[var(--st-text-secondary)] line-clamp-2">
                            {wb.description}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">
                            <BarChart3 size={12} aria-hidden="true" />
                            {chartCount} {chartCount === 1 ? 'chart' : 'charts'}
                          </Badge>
                          <Badge tone="neutral">
                            <Database size={12} aria-hidden="true" />
                            {datasetCount}{' '}
                            {datasetCount === 1 ? 'dataset' : 'datasets'}
                          </Badge>
                        </div>
                        <p className="mt-auto text-xs text-[var(--st-text-tertiary)]">
                          Updated {wb.updatedAt ?? wb.createdAt ?? 'never'}
                        </p>
                      </CardBody>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
