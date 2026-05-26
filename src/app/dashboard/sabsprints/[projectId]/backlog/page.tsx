/**
 * Backlog page — prioritized story list for a project. Stories with no
 * sprint are the "backlog". Server-side: pre-fetch the backlog and the
 * available epics/sprints so the client component renders without a
 * blank-load flash.
 */
import {
  listStories,
  listEpics,
  listSprints,
} from '@/app/actions/agile.actions';

import { BacklogBoard } from './_components/backlog-board';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function BacklogPage({ params }: PageProps) {
  const { projectId } = await params;

  const [storiesRes, epicsRes, sprintsRes] = await Promise.all([
    listStories({
      projectId,
      sprintFilter: 'null',
      limit: 100,
    }),
    listEpics({ projectId, limit: 50 }),
    listSprints({ projectId, limit: 50 }),
  ]);

  const stories = storiesRes.ok ? storiesRes.data.items : [];
  const epics = epicsRes.ok ? epicsRes.data.items : [];
  const sprints = sprintsRes.ok ? sprintsRes.data.items : [];

  return (
    <BacklogBoard
      projectId={projectId}
      initialStories={stories}
      epics={epics}
      sprints={sprints}
    />
  );
}
