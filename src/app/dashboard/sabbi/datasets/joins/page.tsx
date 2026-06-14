/**
 * Dataset joins - list + visual join builder.
 */
import Link from 'next/link';
import {
  ArrowRight,
  Columns3,
  Combine,
  Database,
  LayoutDashboard,
  Network,
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

  const datasetNames = new Map(datasets.map((d) => [d._id, d.name]));
  const joinTypeCount = new Set(joins.map((j) => j.type)).size;

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
          <PageTitle>Joins</PageTitle>
          <PageDescription>
            Visually combine two datasets on matching columns.
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
          label="Saved joins"
          value={joins.length}
          icon={Combine}
          accent="var(--st-accent)"
        />
        <StatCard
          label="Datasets available"
          value={datasets.length}
          icon={Database}
        />
        <StatCard label="Join types used" value={joinTypeCount} icon={Network} />
      </div>

      <JoinBuilder
        datasets={datasets.map((d) => ({ id: d._id, name: d.name }))}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Combine size={16} aria-hidden="true" />
            Saved joins
          </CardTitle>
        </CardHeader>
        <CardBody>
          {joins.length === 0 ? (
            <EmptyState
              icon={Combine}
              tone="info"
              title="No joins yet"
              description="Create a join above to combine rows from two datasets."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th align="left">Name</Th>
                  <Th align="left">Type</Th>
                  <Th align="left">Datasets</Th>
                  <Th align="right">Columns</Th>
                </Tr>
              </THead>
              <TBody>
                {joins.map((j) => (
                  <Tr key={j._id}>
                    <Td className="font-medium text-[var(--st-text)]">{j.name}</Td>
                    <Td>
                      <Badge tone="info">{j.type}</Badge>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 text-[var(--st-text-secondary)]">
                        {datasetNames.get(j.leftId) ?? j.leftId}
                        <ArrowRight
                          size={13}
                          className="text-[var(--st-text-tertiary)]"
                          aria-hidden="true"
                        />
                        {datasetNames.get(j.rightId) ?? j.rightId}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="inline-flex items-center gap-1.5 tabular-nums text-[var(--st-text-secondary)]">
                        <Columns3
                          size={13}
                          className="text-[var(--st-text-tertiary)]"
                          aria-hidden="true"
                        />
                        {j.onColumns?.length ?? 0}
                      </span>
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
