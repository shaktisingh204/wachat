'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Skeleton,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import type { WithId } from 'mongodb';

import { getProjectById } from '@/app/actions/project.actions';
import type { Project } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { RazorpaySettingsForm } from '@/components/wabasimplify/razorpay-settings-form';

export default function RazorpayIntegrationPage() {
  const { activeProject } = useProject();
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();

  useEffect(() => {
    const id = activeProject?._id?.toString();
    if (id) {
      startLoadingTransition(async () => {
        const data = await getProjectById(id);
        setProject(data);
      });
    }
  }, [activeProject]);

  return (
    <div className="flex h-full w-full flex-col">
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
            <ZoruBreadcrumbLink href="/wachat/integrations">Integrations</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Razorpay</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="mt-5 flex-1">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !project ? (
          <Alert variant="destructive">
            <ZoruAlertTitle>No project selected</ZoruAlertTitle>
            <ZoruAlertDescription>
              Please select a project from the main dashboard.
            </ZoruAlertDescription>
          </Alert>
        ) : (
          <div className="max-w-2xl">
            <RazorpaySettingsForm project={project} />
          </div>
        )}
      </div>
    </div>
  );
}
