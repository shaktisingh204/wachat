/**
 * Analytics Workspace - root page.
 *
 * Lists workbooks. "New workbook" creates an empty workbook and routes
 * the user into the editor. Distinct from `/dashboard/sabbi/dashboards`
 * (module-scoped) and `/dashboard/sabbi/analytics` (CRM analytics).
 */
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Analytics workspace</PageTitle>
          <PageDescription>
            Build workbooks, charts, and scheduled reports across any data source.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link href="/dashboard/analytics-workspace/datasets">
            <Button variant="ghost">Datasets</Button>
          </Link>
          <Link href="/dashboard/analytics-workspace/schedules">
            <Button variant="ghost">Schedules</Button>
          </Link>
          <NewWorkbookButton />
        </PageActions>
      </PageHeader>

      {workbooks.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="No workbooks yet"
          description="Workbooks group datasets and charts into a single, shareable analysis. Start by creating one."
          action={<NewWorkbookButton />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workbooks.map((wb) => (
            <Link
              key={wb._id}
              href={`/dashboard/analytics-workspace/workbooks/${wb._id}`}
              className="block"
            >
              <Card variant="interactive" className="h-full">
                <CardHeader>
                  <CardTitle>{wb.name}</CardTitle>
                  <CardDescription>
                    {wb.description ??
                      `${wb.chartsJson?.length ?? 0} charts, ${
                        wb.datasetIds?.length ?? 0
                      } datasets`}
                  </CardDescription>
                </CardHeader>
                <CardBody>
                  <p className="text-xs text-[var(--st-text-secondary)]">
                    Updated {wb.updatedAt ?? wb.createdAt ?? 'never'}
                  </p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
