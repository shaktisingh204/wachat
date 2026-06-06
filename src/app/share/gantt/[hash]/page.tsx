/**
 * Public Gantt — `/share/gantt/[hash]`.
 *
 * Read-only timeline view of a project's tasks + milestones. Lookup is
 * keyed on `crm_projects.publicHash` AND `public_gantt_chart === true`
 * (or 1); any other state returns 404 so disabled links 404 cleanly.
 */

import * as React from 'react';
import { notFound } from 'next/navigation';
import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
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
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--st-text)]">
              Project timeline
            </p>
            <CardTitle className="mt-1">{project.name}</CardTitle>
            <p className="mt-1 text-sm text-[var(--st-text)]">
              {fmtDate(project.startDate)} &middot;{' '}
              {fmtDate(project.deadline)}
            </p>
            {project.description ? (
              <p className="mt-2 max-w-2xl text-sm text-[var(--st-text)]">
                {project.description}
              </p>
            ) : null}
          </div>
          <Badge
            variant={STATUS_VARIANT[project.status.toLowerCase()] || 'outline'}
          >
            {project.status}
          </Badge>
        </CardHeader>
        <CardBody className="grid gap-3 border-t border-[var(--st-border)] pt-4 sm:grid-cols-3">
          <Stat label="Tasks" value={tasks.length} />
          <Stat label="Milestones" value={milestones.length} />
          <Stat label="Dependencies" value={links.length} />
        </CardBody>
      </Card>

      <Card id="gantt-chart-container">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Gantt</CardTitle>
          <PdfExportButton targetId="gantt-chart-container" filename={`${project.name.replace(/\s+/g, '-').toLowerCase()}-timeline.pdf`} />
        </CardHeader>
        <CardBody>
          <PublicGanttChart
            project={project}
            tasks={tasks}
            milestones={milestones}
          />
        </CardBody>
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
    <div className="rounded-md border border-[var(--st-border)] bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-[var(--st-text)]">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-[var(--st-text)]">{value}</p>
    </div>
  );
}
