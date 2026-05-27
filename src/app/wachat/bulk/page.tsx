'use client';

import { Suspense, useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import { Boxes, Database, FileText, BookCopy, FilePlus2 } from 'lucide-react';

import { getProjects } from '@/app/actions/project.actions';
import { getTemplates } from '@/app/actions/template.actions';
import type { WithId, Project, Template } from '@/lib/definitions';
import { WaPage, PageHeader, MetricTile, Section } from '@/components/wachat-ui';

import { BulkActionsClient } from '@/app/wachat/_components/bulk-actions-client';

function compact(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

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

  const approvedCount = useMemo(
    () => templates.filter((t: any) => (t.status || '').toUpperCase() === 'APPROVED').length,
    [templates],
  );

  if (isLoading) return <BulkActionsSkeleton />;

  return (
    <>
      {/* Context KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="WABA projects" value={compact(allProjects.length)} icon={Database} delay={0} />
        <MetricTile label="Selected" value={compact(selectedProjects.length)} icon={Boxes} delay={0.05} />
        <MetricTile label="Source templates" value={compact(templates.length)} icon={FileText} delay={0.1} />
        <MetricTile label="Approved" value={compact(approvedCount)} icon={BookCopy} delay={0.15} />
      </div>

      {selectedProjects.length > 0 && (
        <Section
          title={`Targeting ${selectedProjects.length} project${selectedProjects.length === 1 ? '' : 's'}`}
          description="Bulk actions will run across every selected project."
          padded={false}
        >
          <div className="flex flex-wrap gap-2 p-4">
            {selectedProjects.map((p) => (
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
      )}

      <div className="mt-4">
        <BulkActionsClient
          sourceProjectName={selectedProjects[0]?.name || ''}
          allProjects={allProjects}
          initialTemplates={templates}
          initialSelectedProjects={selectedProjects}
        />
      </div>
    </>
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
