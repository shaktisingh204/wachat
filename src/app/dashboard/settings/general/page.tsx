'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LuCircleAlert } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { ProjectSettingsForm } from '@/components/wabasimplify/project-settings-form';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

export const dynamic = 'force-dynamic';

export default function GeneralSettingsPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

  if (isLoadingProject) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        <ClayBreadcrumbs items={[{ label: 'Wachat', href: '/dashboard' }, { label: 'Settings' }, { label: 'General' }]} />
        <div className="h-[420px] animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        <ClayBreadcrumbs items={[{ label: 'Wachat', href: '/dashboard' }, { label: 'Settings' }]} />
        <ClayCard className="p-10 text-center">
          <LuCircleAlert className="mx-auto h-10 w-10 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">Select a project first.</p>
          <ClayButton variant="obsidian" size="md" onClick={() => router.push('/wachat')} className="mt-4">Choose a project</ClayButton>
        </ClayCard>
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/dashboard' },
        { label: activeProject.name, href: '/wachat' },
        { label: 'General Settings' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
          General Settings
        </h1>
        <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
          Project name, WABA ID, tags, and basic configuration.
        </p>
      </div>

      <ClayCard padded={false} className="p-6">
        <ProjectSettingsForm project={activeProject} />
      </ClayCard>
    </div>
  );
}
