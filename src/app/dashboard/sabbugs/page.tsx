/**
 * Bug Tracker — list page (`/dashboard/sabbugs`).
 *
 * Server-renders the initial list + saved filters in parallel and hands
 * off to the interactive `<BugListClient>`.
 */
import { listBugs, listSavedFilters } from '@/app/actions/bug-tracker.actions';
import { getWsProjects } from '@/app/actions/worksuite/projects.actions';
import { BugListClient } from './_components/bug-list-client';

export const dynamic = 'force-dynamic';

export default async function BugTrackerListPage() {
  const [bugsResult, filtersResult, projects] = await Promise.all([
    listBugs({ page: 0, limit: 20 }),
    listSavedFilters({ limit: 50 }),
    getWsProjects(),
  ]);

  const projectOptions = (projects ?? []).map((p) => ({
    id: String(p._id),
    name: String(p.projectName ?? p.name ?? 'Untitled'),
  }));

  return (
    <BugListClient
      initialBugs={bugsResult.bugs}
      initialError={bugsResult.error}
      initialHasMore={bugsResult.hasMore}
      savedFilters={filtersResult.filters}
      projectOptions={projectOptions}
    />
  );
}
