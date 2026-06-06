import Link from 'next/link';

import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import { listSabsheetWorkbooks } from '@/app/actions/sabsheet.actions';
import { NewWorkbookButton } from './_components/new-workbook-button';

export const dynamic = 'force-dynamic';

export default async function SabsheetIndexPage() {
  const workbooks = await listSabsheetWorkbooks();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>SabSheet</PageTitle>
          <PageDescription>
            Collaborative spreadsheets. Workbooks, sheets, formulas, pivots.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <NewWorkbookButton />
        </PageActions>
      </PageHeader>

      {workbooks.length === 0 ? (
        <EmptyState
          title="No workbooks yet"
          description="Create your first SabSheet workbook to get started."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workbooks.map((wb) => (
            <Card key={wb._id} padding="md">
              <Link href={`/dashboard/sabsheet/${wb._id}`} className="block space-y-2">
                <div className="text-base font-medium text-[var(--st-text)]">{wb.title}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  v{wb.version}
                  {wb.updatedAt ? ` , updated ${new Date(wb.updatedAt).toLocaleDateString()}` : ''}
                </div>
              </Link>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm">
                  <Link href={`/dashboard/sabsheet/${wb._id}`}>Open</Link>
                </Button>
                <Button variant="ghost" size="sm">
                  <Link href={`/dashboard/sabsheet/${wb._id}/history`}>History</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
