import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AlertOctagon, ArrowLeft } from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
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

  const statusTone =
    issue.status === 'resolved'
      ? 'green'
      : issue.status === 'in_progress'
        ? 'rose'
        : issue.status === 'closed'
          ? 'neutral'
          : 'amber';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={issue.title}
        subtitle="Issue details"
        icon={AlertOctagon}
        actions={
          <Link href="/dashboard/crm/projects/issues">
            <ClayButton
              variant="pill"
              leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />}
            >
              Back
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-clay-ink-muted">
              Status
            </p>
            <div className="mt-1">
              <ClayBadge tone={statusTone}>{issue.status}</ClayBadge>
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-clay-ink-muted">
              Priority
            </p>
            <div className="mt-1">
              <ClayBadge tone="neutral">{issue.priority || 'medium'}</ClayBadge>
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-clay-ink-muted">
              Reporter
            </p>
            <p className="mt-1 text-[13px] text-clay-ink">
              {issue.reporterName || '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-clay-ink-muted">
              Assignee
            </p>
            <p className="mt-1 text-[13px] text-clay-ink">
              {issue.assigneeName || '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-clay-ink-muted">
              Project
            </p>
            <p className="mt-1 text-[13px] text-clay-ink-muted">
              {issue.projectId ? String(issue.projectId) : 'Unassigned'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-clay-ink-muted">
              Created
            </p>
            <p className="mt-1 text-[13px] text-clay-ink-muted">
              {formatDate(issue.createdAt)}
            </p>
          </div>
        </div>

        {issue.description ? (
          <div className="mt-6">
            <p className="text-[11px] uppercase tracking-wide text-clay-ink-muted">
              Description
            </p>
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-clay-ink">
              {issue.description}
            </p>
          </div>
        ) : null}
      </ClayCard>

      <ClayCard>
        <h2 className="text-[14px] font-semibold text-clay-ink">Comments</h2>
        <p className="mt-2 text-[12.5px] text-clay-ink-muted">
          Lightweight comments are not yet wired up — plug in the shared
          comments subsystem when available.
        </p>
      </ClayCard>
    </div>
  );
}
