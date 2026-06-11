/**
 * Layout shell for the Scrum/Agile module. Section navigation lives in the
 * 20ui app sidebar (module-sidebars/sabsprints.tsx); each page renders its
 * own body inside a width-capped column. Async params are Next 16, so we
 * await before reading `projectId`.
 */
import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
} from '@/components/sabcrm/20ui';
import Link from 'next/link';
import { Plus } from 'lucide-react';

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
    <div className="20ui mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <PageHeader bordered={false}>
        <PageHeaderHeading>
          <PageEyebrow>SabSprints</PageEyebrow>
          <PageTitle>Scrum workspace</PageTitle>
          <PageDescription>
            Groom the backlog, plan sprints, and track delivery for this project.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" asChild>
            <Link href={`/dashboard/sabsprints/${projectId}/sprints/new`}>
              <Plus size={16} aria-hidden="true" />
              New sprint
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <main>{children}</main>
    </div>
  );
}
