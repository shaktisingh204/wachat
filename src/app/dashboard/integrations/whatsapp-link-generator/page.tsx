'use client';

import { useEffect, useState, useTransition } from 'react';
import { getProjectById } from '@/app/actions/project.actions';
import type { WithId, Project } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { WhatsappLinkGenerator } from '@/components/wabasimplify/whatsapp-link-generator';
import { ClayBreadcrumbs } from '@/components/clay';

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function WhatsappLinkGeneratorPage() {
  const { activeProject } = useProject();
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();

  useEffect(() => {
    const id = activeProject?._id?.toString();
    if (id) {
      startLoadingTransition(async () => {
        const data = await getProjectById(id);
        setProject(data);
      });
    }
  }, [activeProject]);

  return (
    <div className="flex h-full w-full flex-col">
      <ClayBreadcrumbs
        items={[
          { label: 'SabNode', href: '/home' },
          { label: 'Wachat', href: '/dashboard' },
          { label: 'Integrations', href: '/dashboard/integrations' },
          { label: 'Link Generator' },
        ]}
      />

      <div className="mt-5 flex-1">
        {isLoading ? (
          <PageSkeleton />
        ) : !project ? (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-red-50 p-4 text-[13px] text-destructive">
            No project selected. Please select a project from the main
            dashboard.
          </div>
        ) : (
          <WhatsappLinkGenerator project={project} />
        )}
      </div>
    </div>
  );
}
