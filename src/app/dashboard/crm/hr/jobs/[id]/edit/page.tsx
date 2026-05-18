import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit job page — server wrapper that loads the job by id and passes it
 * as `initialData` to `<JobForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getJobById } from '@/app/actions/crm-jobs.actions';

import { JobForm } from '../../_components/job-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/hr/jobs';

export default async function EditJobPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: jobId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const job = await getJobById(jobId);
    if (!job) notFound();

    return (
        <EntityDetailShell
            title={`Edit · ${job.title}`}
            eyebrow="JOB"
            back={{ href: `${BASE}/${jobId}`, label: 'Job detail' }}
        >
            <JobForm initialData={job} />
        </EntityDetailShell>
    );
}
