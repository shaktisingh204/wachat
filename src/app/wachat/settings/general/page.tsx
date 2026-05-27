'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Settings } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { ProjectSettingsForm } from '@/components/zoruui-domain/project-settings-form';
import { WaPage, PageHeader, Section, EmptyState, WaButton } from '@/components/wachat-ui';

export default function GeneralSettingsPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

  if (isLoadingProject) {
    return (
      <WaPage>
        <PageHeader
          title="General settings"
          description="Project name, WABA ID, tags, and basic configuration."
          kicker="Wachat · settings"
          backHref="/wachat"
          eyebrowIcon={Settings}
        />
        <div className="h-[420px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      </WaPage>
    );
  }

  if (!activeProject) {
    return (
      <WaPage>
        <PageHeader
          title="General settings"
          description="Project name, WABA ID, tags, and basic configuration."
          kicker="Wachat · settings"
          backHref="/wachat"
          eyebrowIcon={Settings}
        />
        <EmptyState
          icon={CircleAlert}
          title="Select a project first"
          description="Pick a project from the Wachat home page to manage its settings."
          action={<WaButton onClick={() => router.push('/wachat')}>Choose a project</WaButton>}
        />
      </WaPage>
    );
  }

  return (
    <WaPage>
      <PageHeader
        title="General settings"
        description="Project name, WABA ID, tags, and basic configuration."
        kicker="Wachat · settings"
        backHref="/wachat"
        eyebrowIcon={Settings}
      />
      <Section>
        <ProjectSettingsForm project={activeProject} />
      </Section>
    </WaPage>
  );
}
