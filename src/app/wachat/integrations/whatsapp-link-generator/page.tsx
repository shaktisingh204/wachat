'use client';

import { Alert, Skeleton } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import type { WithId,
  Project } from '@/lib/definitions';

import { getProjectById } from '@/app/actions/project.actions';
import { useProject } from '@/context/project-context';
import { WhatsappLinkGenerator } from '@/components/zoruui-domain/whatsapp-link-generator';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Integrations', href: '/wachat/integrations' },
        { label: 'Link generator' },
      ]}
      title="Link generator"
      description="Create click-to-chat WhatsApp links for this project."
      width="narrow"
    >
      {isLoading ? (
        <Skeleton height={256} className="w-full" />
      ) : !project ? (
        <Alert tone="danger" title="No project selected">
          Please select a project from the main dashboard.
        </Alert>
      ) : (
        <WhatsappLinkGenerator project={project} />
      )}
    </WachatPage>
  );
}
