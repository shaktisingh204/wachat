'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  EmptyState,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
} from '@/components/zoruui';
import {
  useEffect,
  useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getSession } from '@/app/actions/index.ts';
import { AgentsSettingsClient } from './client-page';

import * as React from 'react';

export default function AgentsSettingsPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    getSession().then((session) => {
      if (session?.user) setUser(session.user);
    });
  }, []);

  const breadcrumbs = (
    <Breadcrumb>
      <ZoruBreadcrumbList>
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbPage>Agents & roles</ZoruBreadcrumbPage>
        </ZoruBreadcrumbItem>
      </ZoruBreadcrumbList>
    </Breadcrumb>
  );

  if (isLoadingProject) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <EmptyState
          icon={<CircleAlert className="h-10 w-10" />}
          title="Select a project first"
          description="Pick a project from the WaChat home page to manage agents."
          action={<Button onClick={() => router.push('/wachat')}>Choose a project</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-6">
      {breadcrumbs}

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Agents, Roles & Routing</ZoruPageTitle>
          <ZoruPageDescription>
            Invite teammates, configure role-based permissions, and manage conversation routing logic.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {user ? (
        <AgentsSettingsClient project={activeProject} />
      ) : (
        <Skeleton className="h-40 w-full" />
      )}
    </div>
  );
}
