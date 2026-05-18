import { redirect } from 'next/navigation';

/**
 * New job page — server wrapper around `<JobForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { JobForm } from '../_components/job-form';

export const dynamic = 'force-dynamic';

export default async function NewJobPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New Job"
            subtitle="Create a job opening for the hiring pipeline."
        >
            <JobForm />
        </EntityListShell>
    );
}
