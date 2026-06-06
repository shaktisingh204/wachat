/**
 * Dataset detail — preview rows, schema, row count, refresh action.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TBody, THead } from '@/components/sabcrm/20ui/compat';
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
    <div className="zoruui flex flex-col gap-6 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
            <Link href="/dashboard/analytics-workspace/datasets" className="hover:underline">
              Datasets
            </Link>
          </p>
          <h1 className="text-2xl font-semibold text-[var(--st-text)]">{dataset.name}</h1>
          {dataset.description && (
            <p className="text-sm text-[var(--st-text-secondary)]">{dataset.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{dataset.source}</Badge>
          <RefreshButton id={id} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Rows</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-[var(--st-text)]">
              {preview.rowCount ?? dataset.rowCount ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Last refresh</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--st-text-secondary)]">
              {dataset.lastRefreshAt ?? '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Columns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-[var(--st-text)]">{columns.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            First 50 rows. CSV / REST sources require the dataset to be
            materialised into a system collection before previewing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preview.rows.length === 0 ? (
            <p className="text-sm text-[var(--st-text-secondary)]">No preview rows available.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="text-left">
                      {c}
                    </th>
                  ))}
                </tr>
              </THead>
              <TBody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-t border-[var(--st-border)]">
                    {columns.map((c) => (
                      <td key={c} className="py-1.5 text-sm">
                        {String((row as Record<string, unknown>)[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
