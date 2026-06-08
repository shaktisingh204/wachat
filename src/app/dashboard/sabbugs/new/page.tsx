/**
 * Bug Tracker — new bug page (`/dashboard/sabbugs/new`).
 *
 * Server-renders the project list + version dropdown for the form.
 */
import { listVersions } from '@/app/actions/bug-tracker.actions';
import { getWsProjects } from '@/app/actions/worksuite/projects.actions';
import {
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';

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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Bug tracker</PageEyebrow>
          <PageTitle>Report a bug</PageTitle>
          <PageDescription>
            Capture what went wrong, how to reproduce it, and how badly it hurts
            so the team can triage and fix it.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>
      <BugForm
        bug={null}
        projectOptions={projectOptions}
        versions={versionsRes.versions}
      />
    </div>
  );
}
