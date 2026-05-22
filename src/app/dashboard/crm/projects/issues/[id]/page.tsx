import { Badge, Card } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getIssueById } from '@/app/actions/worksuite/meta.actions';

type RouteParams = { id: string };

/**
 * Issue detail — shows the stored metadata. Comments are intentionally
 * kept lightweight here; real comment threading can be added by
 * reusing the project comments subsystem.
 */
export default async function IssueDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = await params;
  const issue = await getIssueById(id);
  if (!issue) notFound();

  const formatDate = (v: unknown) => {
    if (!v) return '—';
    const d = new Date(v as any);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  const statusVariant: 'success' | 'danger' | 'ghost' | 'warning' =
    issue.status === 'resolved'
      ? 'success'
      : issue.status === 'in_progress'
        ? 'danger'
        : issue.status === 'closed'
          ? 'ghost'
          : 'warning';

  return (
    <EntityDetailShell
      eyebrow="ISSUE"
      title={issue.title}
      back={{ href: '/dashboard/crm/projects/issues', label: 'Issues' }}
    >

      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
              Status
            </p>
            <div className="mt-1">
              <Badge variant={statusVariant}>{issue.status}</Badge>
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
              Priority
            </p>
            <div className="mt-1">
              <Badge variant="ghost">{issue.priority || 'medium'}</Badge>
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
              Reporter
            </p>
            <p className="mt-1 text-[13px] text-zoru-ink">
              {issue.reporterName || '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
              Assignee
            </p>
            <p className="mt-1 text-[13px] text-zoru-ink">
              {issue.assigneeName || '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
              Project
            </p>
            <p className="mt-1 text-[13px] text-zoru-ink-muted">
              {issue.projectId ? String(issue.projectId) : 'Unassigned'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
              Created
            </p>
            <p className="mt-1 text-[13px] text-zoru-ink-muted">
              {formatDate(issue.createdAt)}
            </p>
          </div>
        </div>

        {issue.description ? (
          <div className="mt-6">
            <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
              Description
            </p>
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-zoru-ink">
              {issue.description}
            </p>
          </div>
        ) : null}
      </Card>

      <Card className="p-6">
        <h2 className="text-[14px] font-semibold text-zoru-ink">Comments</h2>
        <p className="mt-2 text-[12.5px] text-zoru-ink-muted">
          Lightweight comments are not yet wired up — plug in the shared
          comments subsystem when available.
        </p>
      </Card>
    </EntityDetailShell>
  );
}
