import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Briefcase } from 'lucide-react';

/**
 * New job page — server wrapper around `<JobForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { JobForm } from '../_components/job-form';

export const dynamic = 'force-dynamic';

export default async function NewJobPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Jobs', href: '/dashboard/hrm/hr/jobs' },
                    { label: 'New' },
                ]}
                title="New Job"
                subtitle="Create a job opening for the hiring pipeline."
                icon={Briefcase}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/hr/jobs">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <JobForm />
        </div>
    );
}
