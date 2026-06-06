import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/sabcrm/20ui';
import { Card } from '@/components/sabcrm/20ui';
import {
  getSabsheetWorkbook,
  listSabsheetVersions,
} from '@/app/actions/sabsheet.actions';
import { RestoreButton } from './_restore-button';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ workbookId: string }>;
}

export default async function SabsheetHistoryPage({ params }: PageProps) {
  const { workbookId } = await params;
  const workbook = await getSabsheetWorkbook(workbookId);
  if (!workbook) notFound();
  const versions = await listSabsheetVersions(workbookId);

  return (
    <div className="zoruui mx-auto w-full max-w-3xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{workbook.title} — history</h1>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Saved snapshots of this workbook. Restore replays a version into the live
            workbook.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/sabsheet/${workbookId}`}>Back to editor</Link>
        </Button>
      </header>

      {versions.length === 0 ? (
        <Card className="p-6 text-sm text-[var(--st-text-secondary)]">
          No versions yet. Use “Save version” in the editor to create one.
        </Card>
      ) : (
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v._id}>
              <Card className="flex items-center justify-between gap-4 p-3 text-sm">
                <div>
                  <div className="font-medium">v{v.version}</div>
                  <div className="text-xs text-[var(--st-text-secondary)]">
                    {new Date(v.savedAt).toLocaleString()}
                    {v.comment ? ` — ${v.comment}` : ''}
                  </div>
                </div>
                <RestoreButton versionId={v._id} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
