import { Suspense } from 'react';
import { redirect } from 'next/navigation';

/**
 * HR Announcements — new announcement page.
 *
 * Server component that renders the shared <AnnouncementForm /> with no
 * `initialData`, putting it in "create" mode. The form action redirects
 * to the detail page on success.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { AnnouncementForm } from '../_components/announcement-form';

export const dynamic = 'force-dynamic';

async function NewAnnouncementPageContainer() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New Announcement"
            subtitle="Draft a company-wide update or pinned message."
        >
            <AnnouncementForm />
        </EntityListShell>
    );
}

export default function NewAnnouncementPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewAnnouncementPageContainer  />
    </Suspense>
  );
}
