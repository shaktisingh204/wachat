/**
 * Bug Tracker — Kanban board (`/dashboard/sabbugs/board`).
 *
 * Server-renders all non-closed bugs once and groups them by status on
 * the client.
 */
import { listBugs } from '@/app/actions/bug-tracker.actions';
import { BugBoardClient } from '../_components/bug-board-client';

export const dynamic = 'force-dynamic';

export default async function BugBoardPage() {
  const res = await listBugs({ status: 'all', limit: 100 });
  return (
    <BugBoardClient
      initialBugs={res.bugs}
      initialError={res.error}
    />
  );
}
