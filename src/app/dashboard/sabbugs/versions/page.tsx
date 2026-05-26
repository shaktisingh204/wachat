/**
 * Bug Tracker — versions / releases page
 * (`/dashboard/sabbugs/versions`).
 *
 * Lets developers manage release labels used to mark affected / fixed-in
 * versions on bugs. Project links are reused from the Worksuite Projects
 * list (we do NOT own / mirror the Project entity).
 */
import { listVersions } from '@/app/actions/bug-tracker.actions';
import { getWsProjects } from '@/app/actions/worksuite/projects.actions';

import { BugVersionsClient } from '../_components/bug-versions-client';

export const dynamic = 'force-dynamic';

export default async function BugVersionsPage() {
  const [versionsRes, projects] = await Promise.all([
    listVersions({ limit: 200 }),
    getWsProjects(),
  ]);

  const projectOptions = (projects ?? []).map((p) => ({
    id: String(p._id),
    name: String(p.projectName ?? p.name ?? 'Untitled'),
  }));

  return (
    <BugVersionsClient
      initialVersions={versionsRes.versions}
      initialError={versionsRes.error}
      projectOptions={projectOptions}
    />
  );
}
