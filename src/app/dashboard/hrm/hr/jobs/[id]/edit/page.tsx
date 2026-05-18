import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Briefcase } from 'lucide-react';

/**
 * Edit job page — server wrapper that loads the job by id and passes it
 * as `initialData` to `<JobForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getJobById } from '@/app/actions/crm-jobs.actions';

import { JobForm } from '../../_components/job-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/jobs';

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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Jobs', href: BASE },
                    { label: job.title, href: `${BASE}/${jobId}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${job.title}`}
                subtitle="Update job fields. Changes are revalidated immediately."
                icon={Briefcase}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${jobId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <JobForm initialData={job} />
        </div>
    );
}
