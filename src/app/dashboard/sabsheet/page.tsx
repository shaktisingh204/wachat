import Link from 'next/link';

import { Button } from '@/components/sabcrm/20ui';
import { Card } from '@/components/sabcrm/20ui';
import { EmptyState } from '@/components/sabcrm/20ui';
import { listSabsheetWorkbooks } from '@/app/actions/sabsheet.actions';
import { NewWorkbookButton } from './_components/new-workbook-button';

export const dynamic = 'force-dynamic';

export default async function SabsheetIndexPage() {
  const workbooks = await listSabsheetWorkbooks();

  return (
    <div className="zoruui mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SabSheet</h1>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Collaborative spreadsheets — workbooks, sheets, formulas, pivots.
          </p>
        </div>
        <NewWorkbookButton />
      </header>

      {workbooks.length === 0 ? (
        <EmptyState
          title="No workbooks yet"
          description="Create your first SabSheet workbook to get started."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workbooks.map((wb) => (
            <Card key={wb._id} className="p-4">
              <Link href={`/dashboard/sabsheet/${wb._id}`} className="block space-y-2">
                <div className="text-base font-medium">{wb.title}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  v{wb.version}
                  {wb.updatedAt ? ` · updated ${new Date(wb.updatedAt).toLocaleDateString()}` : ''}
                </div>
              </Link>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/sabsheet/${wb._id}`}>Open</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
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
