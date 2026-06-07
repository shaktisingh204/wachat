'use client';

import { useRouter } from 'next/navigation';
import { CircleAlert } from 'lucide-react';

import { Button, EmptyState, Skeleton } from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import { ProjectSettingsForm } from '@/components/20ui-domain/project-settings-form';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

import * as React from 'react';

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'General settings' },
];

export default function GeneralSettingsPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

  if (isLoadingProject) {
    return (
      <WachatPage breadcrumb={BREADCRUMB} width="narrow">
        <Skeleton height={420} width="100%" />
      </WachatPage>
    );
  }

  if (!activeProject) {
    return (
      <WachatPage breadcrumb={BREADCRUMB} width="narrow">
        <EmptyState
          icon={CircleAlert}
          title="Select a project first"
          description="Pick a project from the WaChat home page to manage its settings."
          action={
            <Button onClick={() => router.push('/wachat')}>
              Choose a project
            </Button>
          }
        />
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={BREADCRUMB}
      title="General settings"
      description="Project name, WABA ID, tags, and basic configuration."
      width="narrow"
    >
      <ProjectSettingsForm project={activeProject} />
    </WachatPage>
  );
}
