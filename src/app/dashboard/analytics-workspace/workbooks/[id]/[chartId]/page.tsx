/**
 * Drilldown view — single-chart deep dive. Reads the chart's
 * `drilldownJson` to layer extra filters on top of the saved query.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/zoruui';
import { getChartAction, runChartAction } from '@/app/actions/analytics-bi.actions';

import { ChartPreview } from '../chart-preview';
import { DrilldownRunner } from './drilldown-runner';

export const dynamic = 'force-dynamic';

export default async function DrilldownPage({
  params,
}: {
  params: Promise<{ id: string; chartId: string }>;
}) {
  const { id, chartId } = await params;

  let chart: Awaited<ReturnType<typeof getChartAction>>;
  try {
    chart = await getChartAction(chartId);
  } catch {
    notFound();
  }

  let initialRun = await runChartAction(chartId).catch(() => ({
    rows: [] as Record<string, unknown>[],
    columns: [],
    mode: 'unsupported' as const,
  }));

  return (
    <div className="zoruui flex flex-col gap-4 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-zoru-ink-muted">
            <Link
              href={`/dashboard/analytics-workspace/workbooks/${id}`}
              className="hover:underline"
            >
              Workbook
            </Link>
          </p>
          <h1 className="text-2xl font-semibold text-zoru-ink">{chart.name}</h1>
          <Badge variant="outline">{chart.type}</Badge>
        </div>
        <Button asChild variant="ghost">
          <Link href={`/dashboard/analytics-workspace/workbooks/${id}`}>Back to workbook</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Drilldown</CardTitle>
          <CardDescription>
            Add ad-hoc filters and re-run the chart. Filters here layer on
            top of the chart's saved filter list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DrilldownRunner
            chartId={chartId}
            chartType={chart.type}
            initialRun={initialRun}
          />
        </CardContent>
      </Card>

      {initialRun.rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Baseline result</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartPreview
              chartType={chart.type}
              rows={initialRun.rows}
              columns={initialRun.columns}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
