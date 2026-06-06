import { Badge, Card, Button } from '@/components/sabcrm/20ui/compat';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getIssueById } from '@/app/actions/worksuite/meta.actions';
import { getWsIssueCommentsByIssue } from '@/app/actions/worksuite/projects.actions';
import { marked } from 'marked';
import { IssueComments } from '../_components/issue-comments';

type RouteParams = { id: string };

/**
 * Issue detail page wrapper. Keep EntityDetailShell at the top level
 * so that it loads instantly, while we fetch data inside IssueDetailContainer
 * nested inside a React.Suspense boundary with a clean shimmer skeleton.
 */
export default async function IssueDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = await params;

  return (
    <EntityDetailShell
      eyebrow="ISSUE"
      title="Issue Details"
      back={{ href: '/dashboard/crm/projects/issues', label: 'Issues' }}
    >
      <Suspense fallback={<IssueDetailSkeleton />}>
        <IssueDetailContainer id={id} />
      </Suspense>
    </EntityDetailShell>
  );
}

function IssueDetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded animate-pulse" />
              <div className="h-5 w-32 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-2 border-t border-[var(--st-border)] pt-4">
          <div className="h-3 w-20 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded animate-pulse" />
          <div className="h-4 w-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded animate-pulse" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-36 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded animate-pulse" />
          <div className="h-7 w-20 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded animate-pulse" />
        </div>
        <div className="h-20 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded animate-pulse" />
      </Card>

      <Card className="p-6">
        <div className="h-4 w-24 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded animate-pulse mb-4" />
        <div className="space-y-3">
          <div className="h-10 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded animate-pulse" />
          <div className="h-10 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded animate-pulse" />
        </div>
      </Card>
    </div>
  );
}

interface IssueDetailContainerProps {
  id: string;
}

async function IssueDetailContainer({ id }: IssueDetailContainerProps) {
  const issue = await getIssueById(id);
  if (!issue) notFound();

  const comments = await getWsIssueCommentsByIssue(id);

  const formatDate = (v: unknown) => {
    if (!v) return '—';
    const d = new Date(v as any);
    if (isNaN(d.getTime())) return '—';
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} UTC`;
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
    <>
      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
              Status
            </p>
            <div className="mt-1">
              <Badge variant={statusVariant}>{issue.status}</Badge>
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
              Priority
            </p>
            <div className="mt-1">
              <Badge variant="ghost">{issue.priority || 'medium'}</Badge>
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
              Reporter
            </p>
            <p className="mt-1 text-[13px] text-[var(--st-text)]">
              {issue.reporterName || '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
              Assignee
            </p>
            <p className="mt-1 text-[13px] text-[var(--st-text)]">
              {issue.assigneeName || '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
              Project
            </p>
            <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
              {issue.projectId ? String(issue.projectId) : 'Unassigned'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
              Created
            </p>
            <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
              {formatDate(issue.createdAt)}
            </p>
          </div>
        </div>

        {issue.description ? (
          <div className="mt-6">
            <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)] mb-2">
              Description
            </p>
            <div 
              className="prose prose-sm dark:prose-invert max-w-none text-[13px] text-[var(--st-text)]"
              dangerouslySetInnerHTML={{ __html: marked.parse(issue.description) as string }}
            />
          </div>
        ) : null}
      </Card>

      <Card className="p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold text-[var(--st-text)]">Linked Pull Requests</h2>
          <Button variant="outline" size="sm" className="h-7 text-[12px]">
            Link PR
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <div className="rounded-md border border-dashed border-[var(--st-border)] p-4 text-center">
            <p className="text-[12.5px] text-[var(--st-text-secondary)]">
              Connect your GitHub or GitLab workspace to automatically sync pull request status.
            </p>
            <Button variant="link" className="mt-2 h-auto p-0 text-[12px]">
              Configure Integration
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 mt-4">
        <h2 className="text-[14px] font-semibold text-[var(--st-text)] mb-4">Comments</h2>
        <IssueComments issueId={id} initialComments={comments} />
      </Card>
    </>
  );
}
