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
import type { WithId,
  Project } from '@/lib/definitions';

import { getProjectById } from '@/app/actions/project.actions';
import { useProject } from '@/context/project-context';
import { WhatsappLinkGenerator } from '@/components/wabasimplify/whatsapp-link-generator';

export default function WhatsappLinkGeneratorPage() {
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
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbPage>Link generator</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="mt-5 flex-1">
        {isLoading ? (
          <ZoruSkeleton className="h-64 w-full" />
        ) : !project ? (
          <ZoruAlert variant="destructive">
            <ZoruAlertTitle>No project selected</ZoruAlertTitle>
            <ZoruAlertDescription>
              Please select a project from the main dashboard.
            </ZoruAlertDescription>
          </ZoruAlert>
        ) : (
          <WhatsappLinkGenerator project={project} />
        )}
      </div>
    </div>
  );
}
