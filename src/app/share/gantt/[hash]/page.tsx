/**
 * Public Gantt — `/share/gantt/[hash]`.
 *
 * Read-only timeline view of a project's tasks + milestones. Lookup is
 * keyed on `crm_projects.publicHash` AND `public_gantt_chart === true`
 * (or 1); any other state returns 404 so disabled links 404 cleanly.
 */

import * as React from 'react';
import { notFound } from 'next/navigation';
import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import { getPublicGantt } from '@/app/actions/public-gantt.actions';
import { PublicGanttChart } from './_components/public-gantt-chart';
import { PdfExportButton } from './_components/pdf-export-button';
import { fmtDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Params = Promise<{ hash: string }>;

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  active: 'default',
  'in progress': 'default',
  planning: 'secondary',
  completed: 'default',
  finished: 'default',
  'on hold': 'outline',
  cancelled: 'destructive',
  canceled: 'destructive',
};

async function PublicGanttContainer({ hash }: { hash: string }) {
  const data = await getPublicGantt(hash);
  if (!data) notFound();

  const { project, tasks, milestones, links } = data;

  return (
    <div className="space-y-6">
      <Card>
        <ZoruCardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zoru-ink">
              Project timeline
            </p>
            <ZoruCardTitle className="mt-1">{project.name}</ZoruCardTitle>
            <p className="mt-1 text-sm text-zoru-ink">
              {fmtDate(project.startDate)} &middot;{' '}
              {fmtDate(project.deadline)}
            </p>
            {project.description ? (
              <p className="mt-2 max-w-2xl text-sm text-zoru-ink">
                {project.description}
              </p>
            ) : null}
          </div>
          <Badge
            variant={STATUS_VARIANT[project.status.toLowerCase()] || 'outline'}
          >
            {project.status}
          </Badge>
        </ZoruCardHeader>
        <ZoruCardContent className="grid gap-3 border-t border-zoru-line pt-4 sm:grid-cols-3">
          <Stat label="Tasks" value={tasks.length} />
          <Stat label="Milestones" value={milestones.length} />
          <Stat label="Dependencies" value={links.length} />
        </ZoruCardContent>
      </Card>

      <Card id="gantt-chart-container">
        <ZoruCardHeader className="flex flex-row items-center justify-between">
          <ZoruCardTitle>Gantt</ZoruCardTitle>
          <PdfExportButton targetId="gantt-chart-container" filename={`${project.name.replace(/\s+/g, '-').toLowerCase()}-timeline.pdf`} />
        </ZoruCardHeader>
        <ZoruCardContent>
          <PublicGanttChart
            project={project}
            tasks={tasks}
            milestones={milestones}
          />
        </ZoruCardContent>
      </Card>
    </div>
  );
}

export default async function PublicGanttPage({ params }: { params: Params }) {
  const { hash } = await params;
  
  return (
    <React.Suspense fallback={<div>Loading timeline...</div>}>
      <PublicGanttContainer hash={hash} />
    </React.Suspense>
  );
}

function Stat({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="rounded-md border border-zoru-line bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-zoru-ink">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-zoru-ink">{value}</p>
    </div>
  );
}
