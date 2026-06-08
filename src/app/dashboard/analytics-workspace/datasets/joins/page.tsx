/**
 * Dataset joins - list + visual join builder.
 */
import Link from 'next/link';
import { Combine } from 'lucide-react';

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
  PageEyebrow,
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
    <div className="20ui flex flex-col gap-6 p-6">
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
          <PageTitle>Joins</PageTitle>
          <PageDescription>
            Visually combine two datasets on matching columns.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link href="/dashboard/analytics-workspace">
            <Button variant="ghost">Workbooks</Button>
          </Link>
        </PageActions>
      </PageHeader>

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
        <CardBody>
          {joins.length === 0 ? (
            <EmptyState
              icon={Combine}
              title="No joins yet"
              description="Create a join above to combine rows from two datasets."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th align="left">Name</Th>
                  <Th align="left">Type</Th>
                  <Th align="left">Left</Th>
                  <Th align="left">Right</Th>
                  <Th align="right">Columns</Th>
                </Tr>
              </THead>
              <TBody>
                {joins.map((j) => (
                  <Tr key={j._id}>
                    <Td>{j.name}</Td>
                    <Td>
                      <Badge variant="outline">{j.type}</Badge>
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">{j.leftId}</Td>
                    <Td className="text-[var(--st-text-secondary)]">{j.rightId}</Td>
                    <Td align="right">{j.onColumns?.length ?? 0}</Td>
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
