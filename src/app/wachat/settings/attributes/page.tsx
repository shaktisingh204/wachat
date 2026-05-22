'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
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
import { UserAttributesSettingsTab } from '@/components/wabasimplify/user-attributes-settings-tab';

import * as React from 'react';

export const dynamic = 'force-dynamic';

export default function AttributesSettingsPage() {
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
          <ZoruBreadcrumbPage>User attributes</ZoruBreadcrumbPage>
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
          description="Pick a project from the WaChat home page to manage user attributes."
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
          <ZoruPageTitle>User attributes</ZoruPageTitle>
          <ZoruPageDescription>
            Custom contact fields for segmentation and personalization.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <Card>
        <ZoruCardContent>
          <UserAttributesSettingsTab project={activeProject} />
        </ZoruCardContent>
      </Card>
    </div>
  );
}
