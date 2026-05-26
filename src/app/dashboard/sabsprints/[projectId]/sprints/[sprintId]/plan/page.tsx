/**
 * Sprint Plan page — two-column workspace where backlog stories flow into
 * the sprint. The right pane shows the sprint's allocated capacity vs the
 * declared capacity from the sprint entity.
 */
import { notFound } from 'next/navigation';

import {
  getSprint,
  listStories,
} from '@/app/actions/agile.actions';

import { SprintPlanBoard } from './_components/sprint-plan-board';

interface PageProps {
  params: Promise<{ projectId: string; sprintId: string }>;
}

export default async function SprintPlanPage({ params }: PageProps) {
  const { projectId, sprintId } = await params;

  const sprintRes = await getSprint(sprintId);
  if (!sprintRes.ok) {
    notFound();
  }

  const [backlogRes, sprintStoriesRes] = await Promise.all([
    listStories({ projectId, sprintFilter: 'null', limit: 100 }),
    listStories({ projectId, sprintId, limit: 100 }),
  ]);

  return (
    <SprintPlanBoard
      projectId={projectId}
      sprint={sprintRes.data}
      initialBacklog={backlogRes.ok ? backlogRes.data.items : []}
      initialSprintStories={
        sprintStoriesRes.ok ? sprintStoriesRes.data.items : []
      }
    />
  );
}
