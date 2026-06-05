'use client';

import {
  Button,
  EmptyState,
  Skeleton,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getSession } from '@/app/actions/index.ts';
import { AgentsSettingsClient } from './client-page';

import * as React from 'react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Agents & roles' },
];

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
      <WachatPage breadcrumb={BREADCRUMB} width="narrow">
        <Skeleton width="100%" height={420} />
      </WachatPage>
    );
  }

  if (!activeProject) {
    return (
      <WachatPage breadcrumb={BREADCRUMB} width="narrow">
        <EmptyState
          icon={CircleAlert}
          title="Select a project first"
          description="Pick a project from the WaChat home page to manage agents."
          action={<Button onClick={() => router.push('/wachat')}>Choose a project</Button>}
        />
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={BREADCRUMB}
      title="Agents, Roles & Routing"
      description="Invite teammates, configure role-based permissions, and manage conversation routing logic."
      width="narrow"
    >
      {user ? (
        <AgentsSettingsClient project={activeProject} />
      ) : (
        <Skeleton width="100%" height={160} />
      )}
    </WachatPage>
  );
}
