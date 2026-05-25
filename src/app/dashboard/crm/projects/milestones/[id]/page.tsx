import { Badge, Button, Card, Progress } from '@/components/zoruui';
import { notFound, redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, statusToTone, type StatusTone } from '@/components/crm/status-pill';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getSession } from '@/app/actions/user.actions';
import { canServer } from '@/lib/rbac-server';
import { getWsProjectMilestoneById } from '@/app/actions/worksuite/projects.actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/projects/milestones';

const PRIORITY_TONE: Record<string, StatusTone> = {
  low: 'neutral',
  medium: 'blue',
  high: 'amber',
};

function fmtDateUTC(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | Date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

export default async function MilestoneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) redirect('/login');

  const allowed = await canServer('crm_milestone', 'view');
  if (!allowed) redirect('/dashboard/crm/projects');

  const milestone = await getWsProjectMilestoneById(id);
  if (!milestone) notFound();

  const canEdit = await canServer('crm_milestone', 'edit');
  const progress = Math.max(0, Math.min(100, (milestone.status === 'complete' ? 100 : 0) ?? 0));
  const tags: string[] = [];

  return (
    <EntityDetailShell
      eyebrow="MILESTONE"
      title={milestone.milestoneTitle}
      back={{ href: BASE, label: 'Milestones' }}
      actions={
        canEdit ? (
          <Button asChild>
            <Link href={`${BASE}/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        ) : undefined
      }
    >
      <Card className="p-6 animate-in fade-in-50">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
          <StatusPill
            label={milestone.status.replace(/_/g, ' ')}
            tone={statusToTone(milestone.status)}
          />
          <StatusPill
            label="medium"
            tone={PRIORITY_TONE.medium}
          />
          {tags.map((t) => (
            <Badge key={t} variant="ghost">
              {t}
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
          <div>
            <div className="text-zoru-ink-muted">Project</div>
            <div className="text-zoru-ink font-medium">
              {milestone.projectId ? (
                <EntityPickerChip
                  entity="project"
                  id={String(milestone.projectId)}
                  fallback="—"
                />
              ) : (
                '—'
              )}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Parent milestone</div>
            <div className="font-mono text-[12px] text-zoru-ink font-medium">
              —
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Due date</div>
            <div className="text-zoru-ink font-medium">{fmtDateUTC(milestone.endDate)}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Completed</div>
            <div className="text-zoru-ink font-medium">
              {milestone.status === 'complete' ? fmtDateUTC(milestone.endDate) : '—'}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Owner</div>
            <div className="text-zoru-ink font-medium">
              {milestone.userId ? (
                <EntityPickerChip
                  entity="employee"
                  id={String(milestone.userId)}
                  fallback="—"
                />
              ) : (
                '—'
              )}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Progress</div>
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-1.5 w-[160px]" />
              <span className="font-mono text-[12px] text-zoru-ink font-medium">
                {progress}%
              </span>
            </div>
          </div>
          {milestone.summary ? (
            <div className="sm:col-span-2">
              <div className="text-zoru-ink-muted">Description</div>
              <div className="whitespace-pre-wrap text-zoru-ink mt-1 font-medium bg-zoru-surface p-3 rounded-lg border">
                {milestone.summary}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-[14px] font-semibold text-zoru-ink">Audit</h2>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px]">
          <div className="text-zoru-ink-muted">Created</div>
          <div className="text-zoru-ink font-medium">{fmtDateUTC(milestone.createdAt)}</div>
          <div className="text-zoru-ink-muted">Updated</div>
          <div className="text-zoru-ink font-medium">{fmtDateUTC(milestone.updatedAt)}</div>
        </div>
      </Card>
    </EntityDetailShell>
  );
}
