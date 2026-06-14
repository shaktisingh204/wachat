/**
 * Workbook editor - chart builder + live preview.
 *
 * Server fetches the workbook, its datasets, and the chart list. The
 * client component (`WorkbookEditor`) wires the chart-builder pane.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarChart3, Database, Layers, Settings2 } from 'lucide-react';

import {
  Button,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  StatCard,
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

  const chartTypeCount = new Set(charts.map((c) => c.type)).size;

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link href="/dashboard/sabbi/workbooks" className="hover:underline">
              Workbooks
            </Link>
          </PageEyebrow>
          <PageTitle>{workbook.name}</PageTitle>
          {workbook.description && (
            <PageDescription>{workbook.description}</PageDescription>
          )}
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/sabbi/datasets">
              <Settings2 size={16} aria-hidden="true" />
              Manage datasets
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-3">
        <StatCard
          label="Charts"
          value={charts.length}
          icon={BarChart3}
          accent="var(--st-accent)"
        />
        <StatCard
          label="Datasets available"
          value={datasets.length}
          icon={Database}
        />
        <StatCard label="Chart types" value={chartTypeCount} icon={Layers} />
      </div>

      <WorkbookEditor
        workbookId={id}
        datasets={datasets.map((d) => ({ id: d._id, name: d.name }))}
        initialCharts={charts}
      />
    </div>
  );
}
