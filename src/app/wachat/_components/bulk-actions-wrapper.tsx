'use client';

import { Skeleton } from '@/components/sabcrm/20ui';
import { Suspense, useEffect, useState, useTransition, useCallback } from 'react';

import { getProjects } from '@/app/actions/project.actions';
import { getTemplates } from '@/app/actions/template.actions';
import type { WithId, Project, Template } from '@/lib/definitions';

import { BulkActionsClient } from './bulk-actions-client';

function BulkActionsSkeleton() {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );
}

function BulkPageContent() {
  const [allProjects, setAllProjects] = useState<WithId<Project>[]>([]);
  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<WithId<Project>[]>([]);
  const [isLoading, startTransition] = useTransition();

  const fetchInitialData = useCallback(() => {
    startTransition(async () => {
      const storedProjectIds = JSON.parse(
        localStorage.getItem('bulkProjectIds') || '[]',
      );
      const fetchedProjects = await getProjects(undefined, 'whatsapp');
      setAllProjects(fetchedProjects);

      if (storedProjectIds.length > 0) {
        const filteredProjects = fetchedProjects.filter((p) =>
          storedProjectIds.includes(p._id.toString()),
        );
        setSelectedProjects(filteredProjects);

        const sourceProject = filteredProjects[0];
        if (sourceProject) {
          const fetchedTemplates = await getTemplates(
            sourceProject._id.toString(),
          );
          setTemplates(fetchedTemplates);
        }
      }
    });
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  if (isLoading) {
    return <BulkActionsSkeleton />;
  }

  return (
    <div className="w-full">
      <BulkActionsClient
        sourceProjectName={selectedProjects[0]?.name || ''}
        allProjects={allProjects}
        initialTemplates={templates}
        initialSelectedProjects={selectedProjects}
      />
    </div>
  );
}

export function BulkActionsWrapper() {
  return (
    <Suspense fallback={<BulkActionsSkeleton />}>
      <BulkPageContent />
    </Suspense>
  );
}
