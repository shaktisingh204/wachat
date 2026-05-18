import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

/**
 * New probation page — server wrapper around `<ProbationForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { ProbationForm } from '../_components/probation-form';

export const dynamic = 'force-dynamic';

export default async function NewProbationPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Probation', href: '/dashboard/hrm/hr/probation' },
                    { label: 'New' },
                ]}
                title="New Probation"
                subtitle="Start a new probation period with structured evaluation criteria."
                icon={ShieldCheck}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/hr/probation">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <ProbationForm />
        </div>
    );
}
