'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LuCircleAlert } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { AgentsRolesSettingsTab } from '@/components/wabasimplify/agents-roles-settings-tab';
import { getSession } from '@/app/actions/index.ts';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

export const dynamic = 'force-dynamic';

export default function AgentsSettingsPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    getSession().then((session) => {
      if (session?.user) setUser(session.user);
    });
  }, []);

  if (isLoadingProject) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        <ClayBreadcrumbs items={[{ label: 'Wachat', href: '/dashboard' }, { label: 'Settings' }, { label: 'Agents & Roles' }]} />
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
        { label: 'Agents & Roles' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
          Agents & Roles
        </h1>
        <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
          Invite teammates and configure role-based permissions.
        </p>
      </div>

      <ClayCard padded={false} className="p-6">
        {user ? (
          <AgentsRolesSettingsTab project={activeProject} user={user} />
        ) : (
          <div className="h-40 w-full animate-pulse rounded-[10px] bg-muted" />
        )}
      </ClayCard>
    </div>
  );
}
