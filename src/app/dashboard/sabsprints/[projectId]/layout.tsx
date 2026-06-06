/**
 * Layout shell for the Scrum/Agile module. Mounts the section nav and lets
 * each page render its own 20ui `PageHeader` + body. Async params are
 * Next 16, so we await before reading `projectId`.
 */
import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
} from '@/components/sabcrm/20ui';

import { AgileNav } from './_components/agile-nav';

interface AgileLayoutProps {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}

export default async function AgileLayout({
  children,
  params,
}: AgileLayoutProps) {
  const { projectId } = await params;
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader bordered={false}>
        <PageHeaderHeading>
          <PageEyebrow>Project - Agile</PageEyebrow>
          <PageTitle>Scrum workspace</PageTitle>
        </PageHeaderHeading>
      </PageHeader>
      <AgileNav projectId={projectId} />
      <div>{children}</div>
    </div>
  );
}
