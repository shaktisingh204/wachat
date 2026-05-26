/**
 * Active-sprint Kanban board. Stories live in one of four columns:
 * To Do, In Progress, Review, Done. Server pre-fetches the sprint and its
 * stories; client component manages drag-to-column transitions.
 */
import { notFound } from 'next/navigation';

import { getSprint, listStories } from '@/app/actions/agile.actions';

import { SprintBoard } from './_components/sprint-board';

interface PageProps {
  params: Promise<{ projectId: string; sprintId: string }>;
}

export default async function SprintBoardPage({ params }: PageProps) {
  const { projectId, sprintId } = await params;

  const sprintRes = await getSprint(sprintId);
  if (!sprintRes.ok) notFound();

  const storiesRes = await listStories({ projectId, sprintId, limit: 200 });

  return (
    <SprintBoard
      projectId={projectId}
      sprint={sprintRes.data}
      initialStories={storiesRes.ok ? storiesRes.data.items : []}
    />
  );
}
