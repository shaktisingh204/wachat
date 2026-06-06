'use client';

import { Button, EmptyState, Skeleton } from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useRouter } from 'next/navigation';
import { CircleAlert } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { UserAttributesSettingsTab } from '@/components/zoruui-domain/user-attributes-settings-tab';

import * as React from 'react';

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'User attributes' },
];

export default function AttributesSettingsPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

  if (isLoadingProject) {
    return (
      <WachatPage
        breadcrumb={BREADCRUMB}
        title="User attributes"
        description="Custom contact fields for segmentation and personalization."
        width="narrow"
      >
        <Skeleton height={420} />
      </WachatPage>
    );
  }

  if (!activeProject) {
    return (
      <WachatPage
        breadcrumb={BREADCRUMB}
        title="User attributes"
        description="Custom contact fields for segmentation and personalization."
        width="narrow"
      >
        <EmptyState
          icon={CircleAlert}
          title="Select a project first"
          description="Pick a project from the WaChat home page to manage user attributes."
          action={<Button onClick={() => router.push('/wachat')}>Choose a project</Button>}
        />
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={BREADCRUMB}
      title="User attributes"
      description="Custom contact fields for segmentation and personalization."
      width="narrow"
    >
      <UserAttributesSettingsTab project={activeProject} />
    </WachatPage>
  );
}
