'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LuCircleAlert } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { UserAttributesSettingsTab } from '@/components/wabasimplify/user-attributes-settings-tab';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

export const dynamic = 'force-dynamic';

export default function AttributesSettingsPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

  if (isLoadingProject) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        <ClayBreadcrumbs items={[{ label: 'Wachat', href: '/home' }, { label: 'Settings' }, { label: 'User Attributes' }]} />
        <div className="h-[420px] animate-pulse rounded-clay-lg bg-clay-bg-2" />
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        <ClayBreadcrumbs items={[{ label: 'Wachat', href: '/home' }, { label: 'Settings' }]} />
        <ClayCard className="p-10 text-center">
          <LuCircleAlert className="mx-auto h-10 w-10 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">Select a project first.</p>
          <ClayButton variant="obsidian" size="md" onClick={() => router.push('/dashboard')} className="mt-4">Choose a project</ClayButton>
        </ClayCard>
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject.name, href: '/dashboard' },
        { label: 'User Attributes' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
          User Attributes
        </h1>
        <p className="mt-1.5 max-w-[720px] text-[13px] text-clay-ink-muted">
          Custom contact fields for segmentation and personalization.
        </p>
      </div>

      <ClayCard padded={false} className="p-6">
        <UserAttributesSettingsTab project={activeProject} />
      </ClayCard>
    </div>
  );
}
