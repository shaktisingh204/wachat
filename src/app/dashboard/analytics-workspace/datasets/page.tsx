/**
 * Datasets list — connect-source / upload-CSV entry point.
 */
import Link from 'next/link';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TBody, THead } from '@/components/sabcrm/20ui/compat';
import { listDatasetsAction } from '@/app/actions/analytics-bi.actions';

import { NewDatasetPanel } from './_components/new-dataset-panel';

export const dynamic = 'force-dynamic';

export default async function DatasetsPage() {
  let items: Awaited<ReturnType<typeof listDatasetsAction>>['items'] = [];
  try {
    const res = await listDatasetsAction({ limit: 200 });
    items = res.items;
  } catch {
    items = [];
  }

  return (
    <div className="zoruui flex flex-col gap-6 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--st-text)]">Datasets</h1>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Bring tabular data from SabFiles, system collections, or a REST URL.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/dashboard/analytics-workspace/datasets/joins">Joins</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard/analytics-workspace">Workbooks</Link>
          </Button>
        </div>
      </header>

      <NewDatasetPanel />

      <Card>
        <CardHeader>
          <CardTitle>Your datasets</CardTitle>
          <CardDescription>
            Click any dataset to preview rows and refresh its schema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-[var(--st-text-secondary)]">No datasets yet.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-left">Source</th>
                  <th className="text-right">Rows</th>
                  <th className="text-left">Last refresh</th>
                </tr>
              </THead>
              <TBody>
                {items.map((d) => (
                  <tr key={d._id} className="border-t border-[var(--st-border)]">
                    <td className="py-2">
                      <Link
                        href={`/dashboard/analytics-workspace/datasets/${d._id}`}
                        className="text-[var(--st-text)] hover:underline"
                      >
                        {d.name}
                      </Link>
                    </td>
                    <td className="py-2">
                      <Badge variant="outline">{d.source}</Badge>
                    </td>
                    <td className="py-2 text-right">{d.rowCount ?? '—'}</td>
                    <td className="py-2 text-[var(--st-text-secondary)]">{d.lastRefreshAt ?? '—'}</td>
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
