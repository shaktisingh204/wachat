import Link from 'next/link';
import { FileSpreadsheet, History, Layers, Table2 } from 'lucide-react';

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
} from '@/components/sabcrm/20ui';
import { listSabsheetWorkbooks } from '@/app/actions/sabsheet.actions';
import { NewWorkbookButton } from './_components/new-workbook-button';

export const dynamic = 'force-dynamic';

export default async function SabsheetIndexPage() {
  const workbooks = await listSabsheetWorkbooks();

  const updatedThisWeek = workbooks.filter((wb) => {
    if (!wb.updatedAt) return false;
    const week = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - new Date(wb.updatedAt).getTime() < week;
  }).length;

  return (
    <div className="20ui mx-auto w-full max-w-6xl space-y-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabSheet</PageEyebrow>
          <PageTitle>Workbooks</PageTitle>
          <PageDescription>
            Collaborative spreadsheets with formulas, named ranges, comments, and
            version history.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <NewWorkbookButton />
        </PageActions>
      </PageHeader>

      {workbooks.length > 0 ? (
        <section
          aria-label="Workbook overview"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <StatCard
            label="Workbooks"
            value={workbooks.length}
            icon={Layers}
            accent="#1f9d55"
          />
          <StatCard
            label="Updated this week"
            value={updatedThisWeek}
            icon={History}
            accent="#3b7af5"
          />
          <StatCard
            label="Latest version"
            value={`v${Math.max(...workbooks.map((w) => w.version ?? 1))}`}
            icon={FileSpreadsheet}
            accent="#7c3aed"
          />
        </section>
      ) : null}

      {workbooks.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={Table2}
            title="No workbooks yet"
            description="Create your first SabSheet workbook to start building spreadsheets."
            action={<NewWorkbookButton />}
          />
        </Card>
      ) : (
        <section
          aria-label="Workbooks"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {workbooks.map((wb) => (
            <Card key={wb._id} variant="outlined" className="flex h-full flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="line-clamp-1 flex items-center gap-2">
                    <FileSpreadsheet
                      className="size-4 shrink-0 text-[var(--st-text-secondary)]"
                      aria-hidden="true"
                    />
                    {wb.title}
                  </CardTitle>
                  <Badge tone="neutral" kind="soft" className="tabular-nums">
                    v{wb.version}
                  </Badge>
                </div>
              </CardHeader>
              <CardBody className="flex flex-1 flex-col justify-between gap-4">
                <p className="text-xs text-[var(--st-text-secondary)]">
                  {wb.updatedAt
                    ? `Updated ${new Date(wb.updatedAt).toLocaleDateString()}`
                    : 'Not yet edited'}
                </p>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/sabsheet/${wb._id}`}>Open</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/sabsheet/${wb._id}/history`}>
                      <History className="size-4" aria-hidden="true" />
                      History
                    </Link>
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
