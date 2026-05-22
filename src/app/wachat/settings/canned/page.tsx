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
import { CannedMessagesSettingsTab } from '@/components/wabasimplify/canned-messages-settings-tab';

import * as React from 'react';

export const dynamic = 'force-dynamic';

export default function CannedMessagesPage() {
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
          <ZoruBreadcrumbPage>Canned messages</ZoruBreadcrumbPage>
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
          description="Pick a project from the WaChat home page to manage canned messages."
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
          <ZoruPageTitle>Canned messages</ZoruPageTitle>
          <ZoruPageDescription>
            Pre-written message snippets your agents can send instantly.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <Card>
        <ZoruCardContent>
          <CannedMessagesSettingsTab project={activeProject} />
        </ZoruCardContent>
      </Card>
    </div>
  );
}
