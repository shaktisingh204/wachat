'use client';

import { Suspense, useEffect, useState } from 'react';
import { AlertCircle, Database, FilePlus2, Boxes, FileText } from 'lucide-react';

import { CreateTemplateForm } from '@/app/wachat/_components/create-template-form';
import { getProjectById } from '@/app/actions/project.actions';
import type { WithId, Project } from '@/lib/definitions';
import { WaPage, PageHeader, EmptyState, Section, MetricTile } from '@/components/wachat-ui';

function compact(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

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
        description="Head back to the dashboard and pick projects before creating a bulk template."
      />
    );
  }

  const phoneCount = projects.reduce(
    (s, p) => s + ((p as any).phoneNumbers?.length || 0),
    0,
  );
  const wabaCount = new Set(projects.map((p) => (p as any).wabaId || (p as any).businessAccountId).filter(Boolean)).size;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Selected projects" value={compact(projects.length)} icon={Boxes} delay={0} />
        <MetricTile label="Phone numbers" value={compact(phoneCount)} icon={Database} delay={0.05} />
        <MetricTile label="WABAs" value={compact(wabaCount)} icon={FileText} delay={0.1} />
        <MetricTile label="Target template" value="1" icon={FilePlus2} delay={0.15} />
      </div>

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
        description="Author one template and ship it to every project selected in the bulk picker."
        kicker="Wachat / campaigns / template"
        eyebrowIcon={FilePlus2}
        backHref="/wachat/broadcasts"
      />

      <Suspense fallback={<BulkTemplatePageSkeleton />}>
        <BulkTemplatePageContent />
      </Suspense>
    </WaPage>
  );
}
