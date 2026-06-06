/**
 * Dataset detail - preview rows, schema, row count, refresh action.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Database } from 'lucide-react';

import {
  Badge,
  Card,
  CardBody,
  CardDescription,
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
    <div className="ui20 flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link
              href="/dashboard/analytics-workspace/datasets"
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
          <Badge variant="outline">{dataset.source}</Badge>
          <RefreshButton id={id} />
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Rows" value={preview.rowCount ?? dataset.rowCount ?? 0} />
        <StatCard label="Last refresh" value={dataset.lastRefreshAt ?? '-'} />
        <StatCard label="Columns" value={columns.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            First 50 rows. CSV / REST sources require the dataset to be
            materialised into a system collection before previewing.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {preview.rows.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No preview rows available"
              description="This dataset has no preview rows yet. Refresh or materialise the source to populate it."
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
