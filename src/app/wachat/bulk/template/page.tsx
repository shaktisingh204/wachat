'use client';

import { Suspense, useEffect, useState } from 'react';
import { AlertCircle, Database, FilePlus2 } from 'lucide-react';

import { CreateTemplateForm } from '@/app/wachat/_components/create-template-form';
import { getProjectById } from '@/app/actions/project.actions';
import type { WithId, Project } from '@/lib/definitions';
import { WaPage, PageHeader, EmptyState, Section } from '@/components/wachat-ui';

/**
 * Wachat Bulk -> Create Template. Same form, wachat-ui chrome.
 */

function BulkTemplatePageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-48 rounded-full bg-zinc-100 animate-pulse" />
      <div className="h-24 w-full rounded-2xl border border-zinc-200 bg-white animate-pulse" />
      <div className="h-96 w-full rounded-2xl border border-zinc-200 bg-white animate-pulse" />
    </div>
  );
}

function BulkTemplatePageContent() {
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<WithId<Project>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('bulkProjectIds') || '[]');
    setProjectIds(stored);

    (async () => {
      if (stored.length > 0) {
        const fetched = await Promise.all(stored.map((id: string) => getProjectById(id)));
        setProjects(fetched.filter(Boolean) as WithId<Project>[]);
      }
      setIsLoading(false);
    })();
  }, []);

  if (isLoading) return <BulkTemplatePageSkeleton />;

  if (projectIds.length === 0) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="No projects selected"
        description="Head back to the dashboard and select projects before creating a bulk template."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Section
        title={`Targeting ${projects.length} project${projects.length === 1 ? '' : 's'}`}
        description="This template will be created across every selected project."
      >
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <span
              key={p._id.toString()}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[12px] text-zinc-700"
            >
              <Database className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              {p.name}
            </span>
          ))}
        </div>
      </Section>
      <CreateTemplateForm isBulkForm bulkProjectIds={projectIds} />
    </div>
  );
}

export default function BulkTemplatePage() {
  return (
    <WaPage>
      <PageHeader
        title="Create a bulk template"
        description="Author one template and ship it to every project you selected in the bulk picker."
        kicker="Wachat / bulk / template"
        eyebrowIcon={FilePlus2}
        backHref="/wachat/bulk"
      />

      <Suspense fallback={<BulkTemplatePageSkeleton />}>
        <BulkTemplatePageContent />
      </Suspense>
    </WaPage>
  );
}
