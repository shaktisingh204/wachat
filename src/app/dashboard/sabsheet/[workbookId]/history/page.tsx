import { notFound } from 'next/navigation';
import { History } from 'lucide-react';

import {
  Badge,
  Card,
  EmptyState,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
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
    <div className="20ui mx-auto w-full max-w-3xl space-y-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>{workbook.title}</PageEyebrow>
          <PageTitle>Version history</PageTitle>
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
        <Card variant="outlined">
          <EmptyState
            icon={History}
            title="No versions yet"
            description='Use "Save version" in the editor to create a snapshot.'
          />
        </Card>
      ) : (
        <Card variant="outlined" padding="none">
          <Table>
            <THead>
              <Tr>
                <Th>Version</Th>
                <Th>Saved</Th>
                <Th>Comment</Th>
                <Th align="right">Action</Th>
              </Tr>
            </THead>
            <TBody>
              {versions.map((v) => (
                <Tr key={v._id}>
                  <Td>
                    <Badge tone="neutral" kind="soft" className="tabular-nums">
                      v{v.version}
                    </Badge>
                  </Td>
                  <Td className="tabular-nums text-[var(--st-text-secondary)]">
                    {new Date(v.savedAt).toLocaleString()}
                  </Td>
                  <Td className="text-[var(--st-text)]">
                    {v.comment || (
                      <span className="text-[var(--st-text-secondary)]">
                        No comment
                      </span>
                    )}
                  </Td>
                  <Td align="right">
                    <RestoreButton versionId={v._id} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
