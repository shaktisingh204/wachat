'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { GanttChart, ArrowLeft } from 'lucide-react';
import { getProjects } from '@/app/actions/crm-services.actions';
import type { HrProject } from '@/lib/hr-types';
import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { Skeleton } from '@/components/ui/skeleton';

type Project = HrProject & { _id: string };

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function buildMonths(): { label: string; start: Date; end: Date }[] {
  const months: { label: string; start: Date; end: Date }[] = [];
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 0; i < 12; i++) {
    const start = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const end = new Date(base.getFullYear(), base.getMonth() + i + 1, 1);
    months.push({
      label: start.toLocaleDateString(undefined, {
        month: 'short',
        year: '2-digit',
      }),
      start,
      end,
    });
  }
  return months;
}

export default function GanttPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, startLoading] = useTransition();

  const refresh = useCallback(() => {
    startLoading(async () => {
      const ps = await getProjects();
      setProjects((ps as Project[]) || []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const months = useMemo(buildMonths, []);
  const rangeStart = months[0].start.getTime();
  const rangeEnd = months[months.length - 1].end.getTime();
  const totalRange = rangeEnd - rangeStart;

  const computeBar = (project: Project): { left: number; width: number } | null => {
    if (!project.startDate || !project.endDate) return null;
    const s = new Date(project.startDate as any).getTime();
    const e = new Date(project.endDate as any).getTime();
    if (isNaN(s) || isNaN(e)) return null;
    const clampedStart = Math.max(s, rangeStart);
    const clampedEnd = Math.min(e, rangeEnd);
    if (clampedEnd <= rangeStart || clampedStart >= rangeEnd) return null;
    const left = ((clampedStart - rangeStart) / totalRange) * 100;
    const width = Math.max(
      1,
      ((clampedEnd - clampedStart) / totalRange) * 100,
    );
    return { left, width };
  };

  if (isLoading && projects.length === 0) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Project Timeline"
        subtitle="Gantt view of all projects over the next 12 months."
        icon={GanttChart}
        actions={
          <Link href="/dashboard/crm/projects">
            <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
              Projects
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-[11.5px] text-clay-ink-muted">Legend:</span>
          <ClayBadge tone="rose-soft" dot>
            Scheduled
          </ClayBadge>
          <ClayBadge tone="neutral">No dates</ClayBadge>
          <span className="ml-auto text-[11.5px] text-clay-ink-muted">
            {projects.length} project{projects.length === 1 ? '' : 's'}
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-clay-md border border-dashed border-clay-border p-12 text-center">
            <p className="text-[13px] text-clay-ink-muted">No projects to show.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-clay-md border border-clay-border">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[220px_1fr] border-b border-clay-border bg-clay-surface-2">
                <div className="p-3 text-[11.5px] font-medium uppercase tracking-wide text-clay-ink-muted">
                  Project
                </div>
                <div className="grid" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
                  {months.map((m) => (
                    <div
                      key={m.label}
                      className="border-l border-clay-border p-3 text-center text-[11.5px] font-medium text-clay-ink-muted"
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {projects.map((project) => {
                  const bar = computeBar(project);
                  const dur =
                    project.startDate && project.endDate
                      ? Math.max(
                          0,
                          Math.round(
                            (new Date(project.endDate as any).getTime() -
                              new Date(project.startDate as any).getTime()) /
                              MS_PER_DAY,
                          ),
                        )
                      : 0;
                  return (
                    <div
                      key={project._id}
                      className="grid grid-cols-[220px_1fr] border-b border-clay-border last:border-b-0"
                    >
                      <div className="flex flex-col justify-center p-3">
                        <Link
                          href={`/dashboard/crm/projects/${project._id}`}
                          className="truncate text-[13px] font-medium text-clay-ink hover:underline"
                        >
                          {project.name}
                        </Link>
                        <span className="text-[11px] text-clay-ink-muted">
                          {project.clientName || '—'}
                        </span>
                      </div>
                      <div className="relative h-14">
                        <div
                          className="absolute inset-0 grid"
                          style={{
                            gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
                          }}
                          aria-hidden
                        >
                          {months.map((m) => (
                            <div
                              key={m.label}
                              className="border-l border-clay-border"
                            />
                          ))}
                        </div>
                        {bar ? (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 rounded-clay-md border border-clay-rose bg-clay-rose-soft px-2 py-1 text-[11.5px] text-clay-rose-ink"
                            style={{
                              left: `${bar.left}%`,
                              width: `${bar.width}%`,
                            }}
                            title={`${project.name} (${dur} days)`}
                          >
                            <span className="block truncate">
                              {project.progress ?? 0}% · {dur}d
                            </span>
                          </div>
                        ) : (
                          <div className="absolute inset-y-0 left-3 flex items-center text-[11px] text-clay-ink-muted">
                            No scheduled dates
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </ClayCard>
    </div>
  );
}
