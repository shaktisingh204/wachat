/**
 * Public Gantt — `/share/gantt/[hash]`.
 *
 * Read-only timeline view of a project's tasks + milestones. Lookup is
 * keyed on `crm_projects.publicHash` AND `public_gantt_chart === true`
 * (or 1); any other state returns 404 so disabled links 404 cleanly.
 */

import { notFound } from 'next/navigation';
import {
  ZoruBadge,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import { getPublicGantt } from '@/app/actions/public-gantt.actions';
import { PublicGanttChart } from './_components/public-gantt-chart';

type Params = Promise<{ hash: string }>;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
}

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

export default async function PublicGanttPage({ params }: { params: Params }) {
  const { hash } = await params;
  const data = await getPublicGantt(hash);
  if (!data) notFound();

  const { project, tasks, milestones, links } = data;

  return (
    <div className="space-y-6">
      <ZoruCard>
        <ZoruCardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Project timeline
            </p>
            <ZoruCardTitle className="mt-1">{project.name}</ZoruCardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              {formatDate(project.startDate)} &middot;{' '}
              {formatDate(project.deadline)}
            </p>
            {project.description ? (
              <p className="mt-2 max-w-2xl text-sm text-zinc-600">
                {project.description}
              </p>
            ) : null}
          </div>
          <ZoruBadge
            variant={STATUS_VARIANT[project.status.toLowerCase()] || 'outline'}
          >
            {project.status}
          </ZoruBadge>
        </ZoruCardHeader>
        <ZoruCardContent className="grid gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-3">
          <Stat label="Tasks" value={tasks.length} />
          <Stat label="Milestones" value={milestones.length} />
          <Stat label="Dependencies" value={links.length} />
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Gantt</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <PublicGanttChart
            project={project}
            tasks={tasks}
            milestones={milestones}
          />
        </ZoruCardContent>
      </ZoruCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
