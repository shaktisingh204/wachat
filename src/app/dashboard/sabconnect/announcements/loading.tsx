import * as React from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function AnnouncementsLoading() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <EntityListShell
                title="Announcements"
                subtitle="Broadcast updates, schedule rollouts, and track who has acknowledged."
                loading={true}
            >
                <div />
            </EntityListShell>
        </div>
    );
}
