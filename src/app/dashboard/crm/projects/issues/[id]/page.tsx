import { Badge, Card, Button } from '@/components/zoruui';
import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getIssueById } from '@/app/actions/worksuite/meta.actions';
import { getWsIssueCommentsByIssue } from '@/app/actions/worksuite/projects.actions';
import { marked } from 'marked';
import { IssueComments } from '../_components/issue-comments';

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

  const comments = await getWsIssueCommentsByIssue(id);

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
            <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted mb-2">
              Description
            </p>
            <div 
              className="prose prose-sm dark:prose-invert max-w-none text-[13px] text-zoru-ink"
              dangerouslySetInnerHTML={{ __html: marked.parse(issue.description) as string }}
            />
          </div>
        ) : null}
      </Card>

      <Card className="p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold text-zoru-ink">Linked Pull Requests</h2>
          <Button variant="outline" size="sm" className="h-7 text-[12px]">
            Link PR
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <div className="rounded-md border border-dashed border-zoru-line p-4 text-center">
            <p className="text-[12.5px] text-zoru-ink-muted">
              Connect your GitHub or GitLab workspace to automatically sync pull request status.
            </p>
            <Button variant="link" className="mt-2 h-auto p-0 text-[12px]">
              Configure Integration
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 mt-4">
        <h2 className="text-[14px] font-semibold text-zoru-ink mb-4">Comments</h2>
        <IssueComments issueId={id} initialComments={comments} />
      </Card>
    </EntityDetailShell>
  );
}
