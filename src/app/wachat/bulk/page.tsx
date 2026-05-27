'use client';

import { Suspense, useEffect, useState, useTransition, useCallback } from 'react';
import { Boxes } from 'lucide-react';

import { getProjects } from '@/app/actions/project.actions';
import { getTemplates } from '@/app/actions/template.actions';
import type { WithId, Project, Template } from '@/lib/definitions';
import { WaPage, PageHeader } from '@/components/wachat-ui';

import { BulkActionsClient } from '@/app/wachat/_components/bulk-actions-client';

/**
 * Wachat Bulk - root bulk-send page (CSV-driven).
 * Same data layer as before; wachat-ui chrome.
 */

function BulkActionsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="h-9 w-64 rounded-full bg-zinc-100 animate-pulse" />
        <div className="h-9 w-32 rounded-full bg-zinc-100 animate-pulse" />
      </div>
      <div className="h-4 w-96 rounded-full bg-zinc-100 animate-pulse" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 w-full rounded-2xl border border-zinc-200 bg-white animate-pulse" />
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
          const fetchedTemplates = await getTemplates(sourceProject._id.toString());
          setTemplates(fetchedTemplates);
        }
      }
    });
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  if (isLoading) return <BulkActionsSkeleton />;

  return (
    <BulkActionsClient
      sourceProjectName={selectedProjects[0]?.name || ''}
      allProjects={allProjects}
      initialTemplates={templates}
      initialSelectedProjects={selectedProjects}
    />
  );
}

export default function BulkPage() {
  return (
    <WaPage>
      <PageHeader
        title="Bulk actions"
        description="Send WhatsApp messages, run template imports, and orchestrate jobs across multiple projects at once."
        kicker="Wachat / bulk"
        eyebrowIcon={Boxes}
        backHref="/wachat"
      />

      <Suspense fallback={<BulkActionsSkeleton />}>
        <BulkPageContent />
      </Suspense>
    </WaPage>
  );
}
