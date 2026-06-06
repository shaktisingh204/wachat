/**
 * Workbook editor — chart builder + live preview.
 *
 * Server fetches the workbook, its datasets, and the chart list. The
 * client component (`WorkbookEditor`) wires the chart-builder pane.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/sabcrm/20ui/compat';
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
    <div className="zoruui flex flex-col gap-4 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
            <Link href="/dashboard/analytics-workspace" className="hover:underline">
              Workbooks
            </Link>
          </p>
          <h1 className="text-2xl font-semibold text-[var(--st-text)]">{workbook.name}</h1>
          {workbook.description && (
            <p className="text-sm text-[var(--st-text-secondary)]">{workbook.description}</p>
          )}
        </div>
        <Button asChild variant="ghost">
          <Link href="/dashboard/analytics-workspace/datasets">Manage datasets</Link>
        </Button>
      </header>

      <WorkbookEditor
        workbookId={id}
        datasets={datasets.map((d) => ({ id: d._id, name: d.name }))}
        initialCharts={charts}
      />
    </div>
  );
}
