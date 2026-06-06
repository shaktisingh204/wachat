/**
 * Bug Tracker — new bug page (`/dashboard/sabbugs/new`).
 *
 * Server-renders the project list + version dropdown for the form.
 */
import { listVersions } from '@/app/actions/bug-tracker.actions';
import { getWsProjects } from '@/app/actions/worksuite/projects.actions';

import { BugForm } from '../_components/bug-form';

export const dynamic = 'force-dynamic';

export default async function NewBugPage() {
  const [projects, versionsRes] = await Promise.all([
    getWsProjects(),
    listVersions({ limit: 100 }),
  ]);
  const projectOptions = (projects ?? []).map((p) => ({
    id: String(p._id),
    name: String(p.projectName ?? p.name ?? 'Untitled'),
  }));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-[var(--st-text)]">Report a bug</h1>
      <BugForm
        bug={null}
        projectOptions={projectOptions}
        versions={versionsRes.versions}
      />
    </div>
  );
}
