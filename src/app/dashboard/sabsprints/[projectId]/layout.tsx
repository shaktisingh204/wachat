/**
 * Layout shell for the Scrum/Agile module. Mounts the section nav and lets
 * each page render its own ZoruUI `PageHeader` + body. Async params are
 * Next 16 — we await before reading `projectId`.
 */
import { PageHeader } from '@/components/sabcrm/20ui';

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
    <div className="zoruui flex flex-col gap-6 p-6">
      <PageHeader bordered={false}>
        <div className="flex flex-col gap-0.5">
          <p className="text-xs uppercase tracking-wider text-[var(--st-text-tertiary)]">
            Project &bull; Agile
          </p>
          <h1 className="text-2xl font-semibold text-[var(--st-text)]">
            Scrum workspace
          </h1>
        </div>
      </PageHeader>
      <AgileNav projectId={projectId} />
      <div>{children}</div>
    </div>
  );
}
