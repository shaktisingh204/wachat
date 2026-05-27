'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Tag } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { UserAttributesSettingsTab } from '@/components/zoruui-domain/user-attributes-settings-tab';
import { WaPage, PageHeader, Section, EmptyState, WaButton } from '@/components/wachat-ui';

export default function AttributesSettingsPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

  if (isLoadingProject) {
    return (
      <WaPage>
        <PageHeader
          title="User attributes"
          description="Custom contact fields for segmentation and personalization."
          kicker="Wachat · settings"
          backHref="/wachat"
          eyebrowIcon={Tag}
        />
        <div className="h-[420px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      </WaPage>
    );
  }

  if (!activeProject) {
    return (
      <WaPage>
        <PageHeader
          title="User attributes"
          description="Custom contact fields for segmentation and personalization."
          kicker="Wachat · settings"
          backHref="/wachat"
          eyebrowIcon={Tag}
        />
        <EmptyState
          icon={CircleAlert}
          title="Select a project first"
          description="Pick a project from the Wachat home page to manage user attributes."
          action={<WaButton onClick={() => router.push('/wachat')}>Choose a project</WaButton>}
        />
      </WaPage>
    );
  }

  return (
    <WaPage>
      <PageHeader
        title="User attributes"
        description="Custom contact fields for segmentation and personalization."
        kicker="Wachat · settings"
        backHref="/wachat"
        eyebrowIcon={Tag}
      />
      <Section>
        <UserAttributesSettingsTab project={activeProject} />
      </Section>
    </WaPage>
  );
}
