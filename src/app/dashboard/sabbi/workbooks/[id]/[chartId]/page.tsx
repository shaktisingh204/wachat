/**
 * Drilldown view - single-chart deep dive. Reads the chart's
 * `drilldownJson` to layer extra filters on top of the saved query.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft, BarChart3, Filter } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
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

  const initialRun = await runChartAction(chartId).catch(() => ({
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
              href={`/dashboard/sabbi/workbooks/${id}`}
              className="hover:underline"
            >
              Workbook
            </Link>
          </PageEyebrow>
          <PageTitle>{chart.name}</PageTitle>
          <div className="mt-1">
            <Badge tone="neutral">
              <BarChart3 size={12} aria-hidden="true" />
              {chart.type}
            </Badge>
          </div>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost" asChild>
            <Link href={`/dashboard/sabbi/workbooks/${id}`}>
              <ArrowLeft size={16} aria-hidden="true" />
              Back to workbook
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter size={16} aria-hidden="true" />
            Drilldown
          </CardTitle>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Add ad-hoc filters and re-run the chart. Filters here layer on top of
            the chart's saved filter list.
          </p>
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
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={16} aria-hidden="true" />
              Baseline result
            </CardTitle>
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
