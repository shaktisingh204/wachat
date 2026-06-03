'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — workspace-wide "Notes" feed (`/sabcrm/notes`).
 *
 * Twenty CRM "Notes" surface parity: a standalone, cross-record activity
 * stream that surfaces every NOTE-type activity logged anywhere in the active
 * project, newest-first. Unlike the per-record activity timeline (which is
 * scoped to a single record's detail panel), this page is intentionally
 * non-record-scoped — it is the workspace's "all notes in one place" feed.
 *
 * Client Component. Auth / onboarding / RBAC / project context are already
 * enforced by `../layout.tsx` (which wraps every `/sabcrm/*` child in
 * `RBACGuard` + `ProjectProvider` inside the `.zoruui` scope). The feed's
 * underlying server action (`getActivityFeedAction`, behind `sabcrm:view`)
 * independently re-runs the full session → project → RBAC → plan pipeline, so
 * the surface fails closed (a calm in-feed error/empty state) for anyone who
 * slips past the layout guard.
 *
 * Scoping
 * -------
 * The {@link ActivityFeed} component is workspace-wide by design — it takes no
 * `recordId`/`objectSlug`; instead it scopes through its optional `projectId`
 * (the tenant boundary, forwarded to the gated action) and an optional
 * `filter`. Here we pass `filter={{ types: ['NOTE'] }}` to narrow the feed to
 * note-type activities only, matching the Twenty "Notes" surface. No separate
 * composer is mounted: `ActivityComposer` requires a concrete
 * `targetObject` + `targetRecordId`, which a global notes feed does not have.
 *
 * The feed owns its own data flow — loading, "Load more" pagination, and the
 * fail-closed error/empty states all live inside {@link ActivityFeed}, so this
 * page only resolves the active project and mounts the feed.
 */

import { useProject } from '@/context/project-context';
import {
  EmptyState,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
} from '@/components/zoruui';
import { ActivityFeed } from '@/components/sabcrm/activity-feed';

export default function NotesPage() {
  const { activeProjectId } = useProject();

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Activity</ZoruPageEyebrow>
          <ZoruPageTitle>Notes</ZoruPageTitle>
          <ZoruPageDescription>
            All notes across your workspace, newest first. Every note logged on
            any record in this project shows up here in one continuous feed.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {!activeProjectId ? (
        <EmptyState
          title="No active project"
          description="Select a project to see the notes logged across its records."
        />
      ) : (
        <ActivityFeed
          mode="cursor"
          filter={{ types: ['NOTE'] }}
          projectId={activeProjectId}
        />
      )}
    </main>
  );
}
