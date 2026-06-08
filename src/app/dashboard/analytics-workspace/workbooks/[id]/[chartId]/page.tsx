/**
 * Drilldown view - single-chart deep dive. Reads the chart's
 * `drilldownJson` to layer extra filters on top of the saved query.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageActions,
} from '@/components/sabcrm/20ui';
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
    <div className="20ui flex flex-col gap-4 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link
              href={`/dashboard/analytics-workspace/workbooks/${id}`}
              className="hover:underline"
            >
              Workbook
            </Link>
          </PageEyebrow>
          <PageTitle>{chart.name}</PageTitle>
          <div className="mt-1">
            <Badge variant="outline">{chart.type}</Badge>
          </div>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost">
            <Link href={`/dashboard/analytics-workspace/workbooks/${id}`}>
              Back to workbook
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Drilldown</CardTitle>
          <CardDescription>
            Add ad-hoc filters and re-run the chart. Filters here layer on
            top of the chart's saved filter list.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <DrilldownRunner
            chartId={chartId}
            chartType={chart.type}
            initialRun={initialRun}
          />
        </CardBody>
      </Card>

      {initialRun.rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Baseline result</CardTitle>
          </CardHeader>
          <CardBody>
            <ChartPreview
              chartType={chart.type}
              rows={initialRun.rows}
              columns={initialRun.columns}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
