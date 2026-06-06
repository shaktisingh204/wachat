/**
 * Workbook editor - chart builder + live preview.
 *
 * Server fetches the workbook, its datasets, and the chart list. The
 * client component (`WorkbookEditor`) wires the chart-builder pane.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Button,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import {
  getWorkbookAction,
  listChartsAction,
  listDatasetsAction,
} from '@/app/actions/analytics-bi.actions';

import { WorkbookEditor } from './workbook-editor';

export const dynamic = 'force-dynamic';

export default async function WorkbookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let workbook: Awaited<ReturnType<typeof getWorkbookAction>>;
  try {
    workbook = await getWorkbookAction(id);
  } catch {
    notFound();
  }

  const [chartsRes, datasetsRes] = await Promise.all([
    listChartsAction({ workbookId: id, limit: 200 }).catch(() => ({ items: [] })),
    listDatasetsAction({ limit: 500 }).catch(() => ({ items: [] })),
  ]);
  const charts = 'items' in chartsRes ? chartsRes.items : [];
  const datasets = 'items' in datasetsRes ? datasetsRes.items : [];

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link href="/dashboard/analytics-workspace" className="hover:underline">
              Workbooks
            </Link>
          </PageEyebrow>
          <PageTitle>{workbook.name}</PageTitle>
          {workbook.description && (
            <PageDescription>{workbook.description}</PageDescription>
          )}
        </PageHeaderHeading>
        <PageActions>
          <Link href="/dashboard/analytics-workspace/datasets">
            <Button variant="ghost">Manage datasets</Button>
          </Link>
        </PageActions>
      </PageHeader>

      <WorkbookEditor
        workbookId={id}
        datasets={datasets.map((d) => ({ id: d._id, name: d.name }))}
        initialCharts={charts}
      />
    </div>
  );
}
