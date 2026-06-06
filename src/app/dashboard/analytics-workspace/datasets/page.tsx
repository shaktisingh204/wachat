/**
 * Datasets list. Connect-source / upload-CSV entry point.
 */
import Link from 'next/link';
import { Database } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
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

export default async function DatasetsPage() {
  let items: Awaited<ReturnType<typeof listDatasetsAction>>['items'] = [];
  try {
    const res = await listDatasetsAction({ limit: 200 });
    items = res.items;
  } catch {
    items = [];
  }

  return (
    <div className="ui20 flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Datasets</PageTitle>
          <PageDescription>
            Bring tabular data from SabFiles, system collections, or a REST URL.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link href="/dashboard/analytics-workspace/datasets/joins">
            <Button variant="ghost">Joins</Button>
          </Link>
          <Link href="/dashboard/analytics-workspace">
            <Button variant="ghost">Workbooks</Button>
          </Link>
        </PageActions>
      </PageHeader>

      <NewDatasetPanel />

      <Card>
        <CardHeader>
          <CardTitle>Your datasets</CardTitle>
          <CardDescription>
            Click any dataset to preview rows and refresh its schema.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {items.length === 0 ? (
            <EmptyState
              icon={Database}
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
                        href={`/dashboard/analytics-workspace/datasets/${d._id}`}
                        className="text-[var(--st-text)] hover:underline"
                      >
                        {d.name}
                      </Link>
                    </Td>
                    <Td>
                      <Badge variant="outline">{d.source}</Badge>
                    </Td>
                    <Td align="right">{d.rowCount ?? '-'}</Td>
                    <Td className="text-[var(--st-text-secondary)]">{d.lastRefreshAt ?? '-'}</Td>
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
