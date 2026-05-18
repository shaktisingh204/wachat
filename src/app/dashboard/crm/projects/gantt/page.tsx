'use client';

import { ZoruBadge, ZoruButton, ZoruCard, ZoruSkeleton } from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { GanttChart,
  ArrowLeft,
  Flag } from 'lucide-react';
import {
  getWsProjects,
  getWsProjectMilestones,
  } from '@/app/actions/worksuite/projects.actions';
import type {
  WsProject,
  WsProjectMilestone,
  } from '@/lib/worksuite/project-types';

import { CrmPageHeader } from '../../_components/crm-page-header';

type Project = WsProject & { _id: string };
type Milestone = WsProjectMilestone & { _id: string };

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
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, startLoading] = useTransition();

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [ps, ms] = await Promise.all([
        getWsProjects(),
        getWsProjectMilestones(),
      ]);
      setProjects((ps as Project[]) || []);
      setMilestones((ms as Milestone[]) || []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const months = useMemo(buildMonths, []);
  const rangeStart = months[0].start.getTime();
  const rangeEnd = months[months.length - 1].end.getTime();
  const totalRange = rangeEnd - rangeStart;

  const computeBar = (
    project: Project,
  ): { left: number; width: number } | null => {
    const sRaw = project.startDate as any;
    const eRaw = (project.deadline || project.endDate) as any;
    if (!sRaw || !eRaw) return null;
    const s = new Date(sRaw).getTime();
    const e = new Date(eRaw).getTime();
    if (isNaN(s) || isNaN(e)) return null;
    const clampedStart = Math.max(s, rangeStart);
    const clampedEnd = Math.min(e, rangeEnd);
    if (clampedEnd <= rangeStart || clampedStart >= rangeEnd) return null;
    const left = ((clampedStart - rangeStart) / totalRange) * 100;
    const width = Math.max(1, ((clampedEnd - clampedStart) / totalRange) * 100);
    return { left, width };
  };

  const milestoneMarkers = useCallback(
    (projectId: string): { pos: number; title: string; done: boolean }[] => {
      return milestones
        .filter((m) => String(m.projectId) === projectId)
        .map((m) => {
          const dRaw = (m.endDate || m.startDate) as any;
          if (!dRaw) return null;
          const d = new Date(dRaw).getTime();
          if (isNaN(d) || d < rangeStart || d > rangeEnd) return null;
          return {
            pos: ((d - rangeStart) / totalRange) * 100,
            title: m.milestoneTitle,
            done: m.status === 'complete',
          };
        })
        .filter(
          (
            x,
          ): x is { pos: number; title: string; done: boolean } => x !== null,
        );
    },
    [milestones, rangeEnd, rangeStart, totalRange],
  );

  if (isLoading && projects.length === 0) {
    return (
      <div className="flex w-full flex-col gap-6">
        <ZoruSkeleton className="h-10 w-64" />
        <ZoruSkeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Project Timeline"
        subtitle="Gantt view across 12 months with milestone markers."
        icon={GanttChart}
        actions={
          <Link href="/dashboard/crm/projects">
            <ZoruButton variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Projects
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-[11.5px] text-zoru-ink-muted">Legend:</span>
          <ZoruBadge variant="danger">Scheduled</ZoruBadge>
          <ZoruBadge variant="warning">Milestone pending</ZoruBadge>
          <ZoruBadge variant="success">Milestone complete</ZoruBadge>
          <ZoruBadge variant="ghost">No dates</ZoruBadge>
          <span className="ml-auto text-[11.5px] text-zoru-ink-muted">
            {projects.length} project{projects.length === 1 ? '' : 's'} ·{' '}
            {milestones.length} milestones
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zoru-line p-12 text-center">
            <p className="text-[13px] text-zoru-ink-muted">
              No projects to show.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[220px_1fr] border-b border-zoru-line bg-zoru-surface-2">
                <div className="p-3 text-[11.5px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                  Project
                </div>
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
                  }}
                >
                  {months.map((m) => (
                    <div
                      key={m.label}
                      className="border-l border-zoru-line p-3 text-center text-[11.5px] font-medium text-zoru-ink-muted"
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {projects.map((project) => {
                  const bar = computeBar(project);
                  const startRaw = project.startDate as any;
                  const endRaw = (project.deadline || project.endDate) as any;
                  const dur =
                    startRaw && endRaw
                      ? Math.max(
                          0,
                          Math.round(
                            (new Date(endRaw).getTime() -
                              new Date(startRaw).getTime()) /
                              MS_PER_DAY,
                          ),
                        )
                      : 0;
                  const markers = milestoneMarkers(project._id);
                  return (
                    <div
                      key={project._id}
                      className="grid grid-cols-[220px_1fr] border-b border-zoru-line last:border-b-0"
                    >
                      <div className="flex flex-col justify-center p-3">
                        <Link
                          href={`/dashboard/crm/projects/${project._id}`}
                          className="truncate text-[13px] font-medium text-zoru-ink hover:underline"
                        >
                          {project.name || project.projectName}
                        </Link>
                        <span className="text-[11px] text-zoru-ink-muted">
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
                              className="border-l border-zoru-line"
                            />
                          ))}
                        </div>
                        {bar ? (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 rounded-lg border border-primary bg-accent px-2 py-1 text-[11.5px] text-accent-foreground"
                            style={{
                              left: `${bar.left}%`,
                              width: `${bar.width}%`,
                            }}
                            title={`${project.name || project.projectName} (${dur} days)`}
                          >
                            <span className="block truncate">
                              {project.completionPercent ??
                                project.progress ??
                                0}
                              % · {dur}d
                            </span>
                          </div>
                        ) : (
                          <div className="absolute inset-y-0 left-3 flex items-center text-[11px] text-zoru-ink-muted">
                            No scheduled dates
                          </div>
                        )}
                        {markers.map((mk, i) => (
                          <div
                            key={`${project._id}-m-${i}`}
                            className="absolute top-1 -translate-x-1/2"
                            style={{ left: `${mk.pos}%` }}
                            title={mk.title}
                          >
                            <Flag
                              className={`h-3.5 w-3.5 ${mk.done ? 'text-emerald-500' : 'text-amber-500'}`}
                              strokeWidth={2}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </ZoruCard>
    </div>
  );
}
