import { notFound } from 'next/navigation';
import { History } from 'lucide-react';

import {
  Card,
  CardBody,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';
import {
  getSabsheetWorkbook,
  listSabsheetVersions,
} from '@/app/actions/sabsheet.actions';
import { RestoreButton } from './_restore-button';
import { BackToEditorButton } from './_back-button';

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
    <div className="20ui mx-auto w-full max-w-3xl space-y-4 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{workbook.title} history</PageTitle>
          <PageDescription>
            Saved snapshots of this workbook. Restore replays a version into the
            live workbook.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <BackToEditorButton workbookId={workbookId} />
        </PageActions>
      </PageHeader>

      {versions.length === 0 ? (
        <Card padding="none">
          <CardBody>
            <EmptyState
              icon={History}
              title="No versions yet"
              description='Use "Save version" in the editor to create a snapshot.'
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v._id}>
              <Card padding="sm" className="flex items-center justify-between gap-4 text-sm">
                <div>
                  <div className="font-medium text-[var(--st-text)]">v{v.version}</div>
                  <div className="text-xs text-[var(--st-text-secondary)]">
                    {new Date(v.savedAt).toLocaleString()}
                    {v.comment ? `, ${v.comment}` : ''}
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
