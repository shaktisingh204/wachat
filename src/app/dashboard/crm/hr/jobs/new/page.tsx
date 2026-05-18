import { redirect } from 'next/navigation';

/**
 * New job page — server wrapper around `<JobForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { JobForm } from '../_components/job-form';

export const dynamic = 'force-dynamic';

export default async function NewJobPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            title="New Job"
            eyebrow="JOB"
            back={{ href: '/dashboard/crm/hr/jobs', label: 'Jobs' }}
        >
            <JobForm />
        </EntityDetailShell>
    );
}
