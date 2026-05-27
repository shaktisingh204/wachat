'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Users } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getSession } from '@/app/actions/index.ts';
import {
  WaPage,
  PageHeader,
  WaButton,
  EmptyState,
} from '@/components/wachat-ui';
import { AgentsSettingsClient } from './client-page';

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
      <WaPage>
        <PageHeader
          title="Agents, roles, and routing"
          description="Invite teammates, configure role-based permissions, and manage conversation routing logic."
          kicker="Wachat · settings"
          backHref="/wachat"
          eyebrowIcon={Users}
        />
        <div className="h-[420px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      </WaPage>
    );
  }

  if (!activeProject) {
    return (
      <WaPage>
        <PageHeader
          title="Agents, roles, and routing"
          description="Invite teammates, configure role-based permissions, and manage conversation routing logic."
          kicker="Wachat · settings"
          backHref="/wachat"
          eyebrowIcon={Users}
        />
        <EmptyState
          icon={CircleAlert}
          title="Select a project first"
          description="Pick a project from the Wachat home page to manage agents."
          action={<WaButton onClick={() => router.push('/wachat')}>Choose a project</WaButton>}
        />
      </WaPage>
    );
  }

  return (
    <WaPage>
      <PageHeader
        title="Agents, roles, and routing"
        description="Invite teammates, configure role-based permissions, and manage conversation routing logic."
        kicker="Wachat · settings"
        backHref="/wachat"
        eyebrowIcon={Users}
      />
      {user ? (
        <AgentsSettingsClient project={activeProject} />
      ) : (
        <div className="h-40 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      )}
    </WaPage>
  );
}
