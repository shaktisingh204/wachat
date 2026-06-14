/**
 * Charts list — every saved chart across the project's workbooks.
 *
 * Real data via `listChartsAction` (Rust `sabbi-charts`). Each row links into
 * the chart's workbook editor / drilldown runner. Charts are authored inside a
 * workbook (`/dashboard/sabbi/workbooks/[id]`); this is the cross-workbook
 * index of them.
 */
import Link from 'next/link';
import {
  BarChart3,
  Gauge,
  LayoutDashboard,
  LineChart,
  Map as MapIcon,
  PieChart,
  Table2,
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
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import {
  listChartsAction,
  listWorkbooksAction,
} from '@/app/actions/analytics-bi.actions';

export const dynamic = 'force-dynamic';

function chartIcon(type: string) {
  switch (type) {
    case 'line':
      return <LineChart size={13} aria-hidden="true" />;
    case 'pie':
      return <PieChart size={13} aria-hidden="true" />;
    case 'kpi':
      return <Gauge size={13} aria-hidden="true" />;
    case 'table':
      return <Table2 size={13} aria-hidden="true" />;
    case 'map':
    case 'heatmap':
      return <MapIcon size={13} aria-hidden="true" />;
    default:
      return <BarChart3 size={13} aria-hidden="true" />;
  }
}

export default async function ChartsPage() {
  let charts: Awaited<ReturnType<typeof listChartsAction>>['items'] = [];
  let workbooks: Awaited<ReturnType<typeof listWorkbooksAction>>['items'] = [];
  try {
    const [c, w] = await Promise.all([
      listChartsAction({ limit: 200 }),
      listWorkbooksAction({ limit: 200 }),
    ]);
    charts = c.items;
    workbooks = w.items;
  } catch {
    charts = [];
    workbooks = [];
  }

  const workbookName = new Map(workbooks.map((w) => [w._id, w.name]));
  const typeCount = new Set(charts.map((c) => c.type)).size;

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI</PageEyebrow>
          <PageTitle>Charts</PageTitle>
          <PageDescription>
            Every visualisation across your workbooks. Charts are built inside a
            workbook and run on the SabBI query engine.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/sabbi/workbooks">
              <LayoutDashboard size={16} aria-hidden="true" />
              Workbooks
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
        <StatCard label="Chart types" value={typeCount} icon={PieChart} />
        <StatCard label="Workbooks" value={workbooks.length} icon={LayoutDashboard} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 size={16} aria-hidden="true" />
            Saved charts
          </CardTitle>
        </CardHeader>
        <CardBody>
          {charts.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              tone="info"
              title="No charts yet"
              description="Open a workbook and add a chart to start visualising your datasets."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th align="left">Name</Th>
                  <Th align="left">Type</Th>
                  <Th align="left">Workbook</Th>
                  <Th align="left">Status</Th>
                </Tr>
              </THead>
              <TBody>
                {charts.map((c) => (
                  <Tr key={c._id}>
                    <Td>
                      <Link
                        href={`/dashboard/sabbi/workbooks/${c.workbookId}/${c._id}`}
                        className="font-medium text-[var(--st-text)] hover:underline"
                      >
                        {c.name}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone="neutral">
                        {chartIcon(c.type)}
                        <span className="capitalize">{c.type}</span>
                      </Badge>
                    </Td>
                    <Td>
                      <Link
                        href={`/dashboard/sabbi/workbooks/${c.workbookId}`}
                        className="text-[var(--st-text-secondary)] hover:underline"
                      >
                        {workbookName.get(c.workbookId) ?? 'Workbook'}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={c.status === 'active' ? 'success' : 'neutral'}>
                        {c.status}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
