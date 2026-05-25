import { Button, Card } from '@/components/zoruui';
import { notFound, redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { canServer } from '@/lib/rbac-server';
import { getWsSubTaskById } from '@/app/actions/worksuite/projects.actions';
import { EntityPickerChip } from '@/components/crm/entity-picker';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/projects/subtasks';

function fmtDateUTC(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | Date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

export default async function SubtaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) redirect('/login');

  const allowed = await canServer('crm_subtask', 'view');
  if (!allowed) redirect('/dashboard/crm/projects');

  const subtask = await getWsSubTaskById(id);
  if (!subtask) notFound();

  const canEdit = await canServer('crm_subtask', 'update');

  return (
    <EntityDetailShell
      eyebrow="SUBTASK"
      title={subtask.title || 'Untitled subtask'}
      back={{ href: BASE, label: 'Subtasks' }}
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
          <div className="text-[14px] font-medium text-zoru-ink">
            Overview
          </div>
          <StatusPill
            label={subtask.status.replace(/_/g, ' ')}
            tone={statusToTone(subtask.status)}
          />
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
          {subtask.projectId ? (
            <div>
              <div className="text-zoru-ink-muted">Project</div>
              <div className="text-zoru-ink font-medium">
                <EntityPickerChip entity="project" id={String(subtask.projectId)} fallback="—" />
              </div>
            </div>
          ) : (
            <div>
              <div className="text-zoru-ink-muted">Parent kind</div>
              <div className="text-zoru-ink font-medium">CRM task</div>
            </div>
          )}
          <div>
            <div className="text-zoru-ink-muted">Parent task</div>
            <div className="font-mono text-[12px] text-zoru-ink font-medium">
              {subtask.taskId ? (
                <EntityPickerChip entity="task" id={String(subtask.taskId)} fallback={String(subtask.taskId)} />
              ) : (
                '—'
              )}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Assignee</div>
            <div className="text-zoru-ink font-medium">
              {subtask.assignedTo ? (
                <EntityPickerChip entity="employee" id={String(subtask.assignedTo)} fallback={subtask.assignedToName || '—'} />
              ) : (
                subtask.assignedToName || 'Unassigned'
              )}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Due date</div>
            <div className="text-zoru-ink font-medium">{fmtDateUTC(subtask.dueDate)}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Predecessor / Dependency</div>
            <div className="text-zoru-ink font-medium">
              {subtask.dependencyId ? (
                <EntityPickerChip entity="subtask" id={String(subtask.dependencyId)} fallback="Predecessor Subtask" />
              ) : (
                '—'
              )}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Completed date</div>
            <div className="text-zoru-ink font-medium">
              {subtask.status === 'completed' || subtask.status === 'done' ? fmtDateUTC(subtask.dueDate) : '—'}
            </div>
          </div>
          {subtask.description ? (
            <div className="sm:col-span-2">
              <div className="text-zoru-ink-muted">Description</div>
              <div className="whitespace-pre-wrap text-zoru-ink mt-1 font-medium bg-zoru-surface p-3 rounded-lg border">
                {subtask.description}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-[14px] font-semibold text-zoru-ink">Audit</h2>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px]">
          <div className="text-zoru-ink-muted">Created</div>
          <div className="text-zoru-ink font-medium">{fmtDateUTC(subtask.createdAt)}</div>
          <div className="text-zoru-ink-muted">Updated</div>
          <div className="text-zoru-ink font-medium">{fmtDateUTC(subtask.updatedAt)}</div>
        </div>
      </Card>
    </EntityDetailShell>
  );
}
