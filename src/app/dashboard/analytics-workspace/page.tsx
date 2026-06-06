/**
 * Analytics Workspace — root page.
 *
 * Lists workbooks. "New workbook" creates an empty workbook and routes
 * the user into the editor. Distinct from `/dashboard/sabbi/dashboards`
 * (module-scoped) and `/dashboard/sabbi/analytics` (CRM analytics).
 */
import Link from 'next/link';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
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
    <div className="zoruui flex flex-col gap-6 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--st-text)]">Analytics workspace</h1>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Build workbooks, charts, and scheduled reports across any data source.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/dashboard/analytics-workspace/datasets">Datasets</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard/analytics-workspace/schedules">Schedules</Link>
          </Button>
          <NewWorkbookButton />
        </div>
      </header>

      {workbooks.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No workbooks yet</CardTitle>
            <CardDescription>
              Workbooks group datasets and charts into a single, shareable
              analysis. Start by creating one.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workbooks.map((wb) => (
            <Link
              key={wb._id}
              href={`/dashboard/analytics-workspace/workbooks/${wb._id}`}
              className="block"
            >
              <Card className="h-full transition-shadow hover:shadow-[var(--st-shadow-sm)]">
                <CardHeader>
                  <CardTitle>{wb.name}</CardTitle>
                  <CardDescription>
                    {wb.description ?? `${wb.chartsJson?.length ?? 0} charts · ${
                      wb.datasetIds?.length ?? 0
                    } datasets`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-[var(--st-text-secondary)]">
                    Updated {wb.updatedAt ?? wb.createdAt ?? '—'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
