import { redirect } from 'next/navigation';

/**
 * New time-log page — server wrapper around `<TimeLogForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { TimeLogForm } from '../_components/time-log-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/time-tracking/time-logs';

export default async function NewTimeLogPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="TIME LOG"
            title="New Time Log"
            back={{ href: BASE, label: 'Time Logs' }}
        >
            <TimeLogForm />
        </EntityDetailShell>
    );
}
