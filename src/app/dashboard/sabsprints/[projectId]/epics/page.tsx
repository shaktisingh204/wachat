/**
 * Epics page — list + roadmap timeline. Pre-fetches the epics for the
 * project and groups their child stories so the timeline can render
 * stacked bars representing story counts per epic.
 */
import { listEpics, listStories } from '@/app/actions/agile.actions';

import { EpicsBoard } from './_components/epics-board';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function EpicsPage({ params }: PageProps) {
  const { projectId } = await params;
  const [epicsRes, storiesRes] = await Promise.all([
    listEpics({ projectId, limit: 100 }),
    listStories({ projectId, limit: 500 }),
  ]);
  return (
    <EpicsBoard
      projectId={projectId}
      initialEpics={epicsRes.ok ? epicsRes.data.items : []}
      stories={storiesRes.ok ? storiesRes.data.items : []}
    />
  );
}
