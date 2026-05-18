import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Clock } from 'lucide-react';

/**
 * New time-log page — server wrapper around `<TimeLogForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { TimeLogForm } from '../_components/time-log-form';

export const dynamic = 'force-dynamic';

export default async function NewTimeLogPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    {
                        label: 'Time Tracking',
                        href: '/dashboard/crm/time-tracking',
                    },
                    {
                        label: 'Time Logs',
                        href: '/dashboard/crm/time-tracking/time-logs',
                    },
                    { label: 'New' },
                ]}
                title="New Time Log"
                subtitle="Add a manual time entry. Started + Ended drive duration."
                icon={Clock}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/crm/time-tracking/time-logs">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to list
                        </Link>
                    </ZoruButton>
                }
            />
            <TimeLogForm />
        </div>
    );
}
