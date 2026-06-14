/**
 * Dataset detail - preview rows, schema, row count, refresh action.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Columns3,
  Database,
  FileSpreadsheet,
  Globe,
  RefreshCcw,
  Rows3,
  TableProperties,
} from 'lucide-react';

import {
  Badge,
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
  getDatasetAction,
  previewDatasetAction,
} from '@/app/actions/analytics-bi.actions';

import { RefreshButton } from './refresh-button';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = {
  csv_upload: 'CSV upload',
  mongo_collection: 'System collection',
  rest_api: 'REST endpoint',
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

export default async function DatasetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let dataset: Awaited<ReturnType<typeof getDatasetAction>>;
  try {
    dataset = await getDatasetAction(id);
  } catch {
    notFound();
  }

  let preview: Awaited<ReturnType<typeof previewDatasetAction>> = {
    rows: [],
    rowCount: dataset.rowCount ?? 0,
    columns: [],
  };
  try {
    preview = await previewDatasetAction(id);
  } catch {
    // Preview is best-effort.
  }

  const columns =
    preview.columns.length > 0
      ? preview.columns
      : preview.rows[0]
        ? Object.keys(preview.rows[0])
        : [];

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link
              href="/dashboard/sabbi/datasets"
              className="hover:underline"
            >
              Datasets
            </Link>
          </PageEyebrow>
          <PageTitle>{dataset.name}</PageTitle>
          {dataset.description ? (
            <PageDescription>{dataset.description}</PageDescription>
          ) : null}
        </PageHeaderHeading>
        <PageActions>
          <Badge tone="neutral">
            {sourceIcon(dataset.source)}
            {SOURCE_LABEL[dataset.source] ?? dataset.source}
          </Badge>
          <RefreshButton id={id} />
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] md:grid-cols-3">
        <StatCard
          label="Rows"
          value={(preview.rowCount ?? dataset.rowCount ?? 0).toLocaleString()}
          icon={Rows3}
          accent="var(--st-accent)"
        />
        <StatCard label="Columns" value={columns.length} icon={Columns3} />
        <StatCard
          label="Last refresh"
          value={dataset.lastRefreshAt ?? 'Never'}
          icon={RefreshCcw}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableProperties size={16} aria-hidden="true" />
            Preview
          </CardTitle>
          <p className="text-sm text-[var(--st-text-secondary)]">
            First 50 rows. CSV / REST sources require the dataset to be
            materialised into a system collection before previewing.
          </p>
        </CardHeader>
        <CardBody>
          {preview.rows.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No preview rows available"
              description="This dataset has no preview rows yet. Refresh or materialise the source to populate it."
              action={<RefreshButton id={id} />}
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  {columns.map((c) => (
                    <Th key={c} align="left">
                      {c}
                    </Th>
                  ))}
                </Tr>
              </THead>
              <TBody>
                {preview.rows.map((row, i) => (
                  <Tr key={i}>
                    {columns.map((c) => (
                      <Td key={c}>
                        {String((row as Record<string, unknown>)[c] ?? '')}
                      </Td>
                    ))}
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
