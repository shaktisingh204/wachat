/**
 * Datasets list. Connect-source / upload-CSV entry point.
 */
import Link from 'next/link';
import {
  Combine,
  Database,
  FileSpreadsheet,
  Globe,
  LayoutDashboard,
  Rows3,
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
import { listDatasetsAction } from '@/app/actions/analytics-bi.actions';

import { NewDatasetPanel } from './_components/new-dataset-panel';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = {
  csv_upload: 'CSV',
  mongo_collection: 'Collection',
  rest_api: 'REST',
};

function sourceIcon(source: string) {
  switch (source) {
    case 'csv_upload':
      return <FileSpreadsheet size={13} aria-hidden="true" />;
    case 'rest_api':
      return <Globe size={13} aria-hidden="true" />;
    default:
      return <Database size={13} aria-hidden="true" />;
  }
}

export default async function DatasetsPage() {
  let items: Awaited<ReturnType<typeof listDatasetsAction>>['items'] = [];
  try {
    const res = await listDatasetsAction({ limit: 200 });
    items = res.items;
  } catch {
    items = [];
  }

  const totalRows = items.reduce((acc, d) => acc + (d.rowCount ?? 0), 0);
  const sourceCount = new Set(items.map((d) => d.source)).size;

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI</PageEyebrow>
          <PageTitle>Datasets</PageTitle>
          <PageDescription>
            Bring tabular data from SabFiles, system collections, or a REST URL.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/sabbi/datasets/joins">
              <Combine size={16} aria-hidden="true" />
              Joins
            </Link>
          </Button>
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
          label="Datasets"
          value={items.length}
          icon={Database}
          accent="var(--st-accent)"
        />
        <StatCard
          label="Total rows"
          value={totalRows.toLocaleString()}
          icon={Rows3}
        />
        <StatCard label="Source types" value={sourceCount} icon={Table2} />
      </div>

      <NewDatasetPanel />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database size={16} aria-hidden="true" />
            Your datasets
          </CardTitle>
        </CardHeader>
        <CardBody>
          {items.length === 0 ? (
            <EmptyState
              icon={Database}
              tone="info"
              title="No datasets yet"
              description="Connect a CSV, system collection, or REST endpoint above to get started."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th align="left">Name</Th>
                  <Th align="left">Source</Th>
                  <Th align="right">Rows</Th>
                  <Th align="left">Last refresh</Th>
                </Tr>
              </THead>
              <TBody>
                {items.map((d) => (
                  <Tr key={d._id}>
                    <Td>
                      <Link
                        href={`/dashboard/sabbi/datasets/${d._id}`}
                        className="font-medium text-[var(--st-text)] hover:underline"
                      >
                        {d.name}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone="neutral">
                        {sourceIcon(d.source)}
                        {SOURCE_LABEL[d.source] ?? d.source}
                      </Badge>
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {d.rowCount != null ? d.rowCount.toLocaleString() : '-'}
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">
                      {d.lastRefreshAt ?? '-'}
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
