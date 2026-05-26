/**
 * Bug detail page (`/dashboard/sabbugs/[bugId]`).
 *
 * Server-renders the bug + comments + history + related bugs in parallel
 * and hands off to a client wrapper for the inline form edit affordance.
 */
import { notFound } from 'next/navigation';

import {
  getBug,
  listComments,
  listHistory,
  listVersions,
  listBugs,
} from '@/app/actions/bug-tracker.actions';
import { getWsProjects } from '@/app/actions/worksuite/projects.actions';

import { BugDetailClient } from '../_components/bug-detail-client';

export const dynamic = 'force-dynamic';

interface BugDetailPageProps {
  params: Promise<{ bugId: string }>;
}

export default async function BugDetailPage({ params }: BugDetailPageProps) {
  const { bugId } = await params;
  const { bug, error } = await getBug(bugId);
  if (!bug) {
    if (error === 'Bug not found.') notFound();
    throw new Error(error ?? 'Failed to load bug.');
  }

  const [comments, history, projects, versionsRes, relatedRes] =
    await Promise.all([
      listComments({ bugId, limit: 50 }),
      listHistory(bugId),
      getWsProjects(),
      listVersions({ limit: 200 }),
      bug.projectId
        ? listBugs({ projectId: bug.projectId, limit: 10 })
        : Promise.resolve({ bugs: [], page: 0, limit: 10, hasMore: false }),
    ]);

  const projectOptions = (projects ?? []).map((p) => ({
    id: String(p._id),
    name: String(p.projectName ?? p.name ?? 'Untitled'),
  }));

  const relatedBugs = (relatedRes.bugs ?? []).filter((b) => b._id !== bug._id);

  return (
    <BugDetailClient
      bug={bug}
      comments={comments.comments}
      history={history.entries}
      relatedBugs={relatedBugs}
      versions={versionsRes.versions}
      projectOptions={projectOptions}
    />
  );
}
