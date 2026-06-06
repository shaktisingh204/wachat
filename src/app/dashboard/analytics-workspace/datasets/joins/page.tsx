/**
 * Dataset joins — list + visual join builder.
 */
import Link from 'next/link';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TBody, THead } from '@/components/sabcrm/20ui/compat';
import {
  listDatasetsAction,
  listJoinsAction,
} from '@/app/actions/analytics-bi.actions';

import { JoinBuilder } from './join-builder';

export const dynamic = 'force-dynamic';

export default async function JoinsPage() {
  const [joinsRes, datasetsRes] = await Promise.all([
    listJoinsAction({ limit: 200 }).catch(() => ({ items: [] })),
    listDatasetsAction({ limit: 500 }).catch(() => ({ items: [] })),
  ]);
  const joins = 'items' in joinsRes ? joinsRes.items : [];
  const datasets = 'items' in datasetsRes ? datasetsRes.items : [];

  return (
    <div className="zoruui flex flex-col gap-6 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
            <Link href="/dashboard/analytics-workspace/datasets" className="hover:underline">
              Datasets
            </Link>
          </p>
          <h1 className="text-2xl font-semibold text-[var(--st-text)]">Joins</h1>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Visually combine two datasets on matching columns.
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/dashboard/analytics-workspace">Workbooks</Link>
        </Button>
      </header>

      <JoinBuilder
        datasets={datasets.map((d) => ({ id: d._id, name: d.name }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Saved joins</CardTitle>
          <CardDescription>
            Use these when building charts to query rows from two sources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {joins.length === 0 ? (
            <p className="text-sm text-[var(--st-text-secondary)]">No joins yet.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Left</th>
                  <th className="text-left">Right</th>
                  <th className="text-right">Columns</th>
                </tr>
              </THead>
              <TBody>
                {joins.map((j) => (
                  <tr key={j._id} className="border-t border-[var(--st-border)]">
                    <td className="py-2">{j.name}</td>
                    <td className="py-2">
                      <Badge variant="outline">{j.type}</Badge>
                    </td>
                    <td className="py-2 text-[var(--st-text-secondary)]">{j.leftId}</td>
                    <td className="py-2 text-[var(--st-text-secondary)]">{j.rightId}</td>
                    <td className="py-2 text-right">{j.onColumns?.length ?? 0}</td>
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
