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
  useRouter } from 'next/navigation';
import { CircleAlert } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { ProjectSettingsForm } from '@/components/wabasimplify/project-settings-form';

import * as React from 'react';

export default function GeneralSettingsPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

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
          <ZoruBreadcrumbPage>General settings</ZoruBreadcrumbPage>
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
          description="Pick a project from the WaChat home page to manage its settings."
          action={
            <Button onClick={() => router.push('/wachat')}>
              Choose a project
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-6">
      {breadcrumbs}

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>General settings</ZoruPageTitle>
          <ZoruPageDescription>
            Project name, WABA ID, tags, and basic configuration.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <ProjectSettingsForm project={activeProject} />
    </div>
  );
}
