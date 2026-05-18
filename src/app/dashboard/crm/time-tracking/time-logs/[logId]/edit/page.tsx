import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Clock } from 'lucide-react';

/**
 * Edit time log — server wrapper around `<TimeLogForm initialData={...} />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getTimeLogById } from '@/app/actions/crm-time-logs.actions';

import { TimeLogForm } from '../../_components/time-log-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/time-tracking/time-logs';

interface PageProps {
    params: Promise<{ logId: string }>;
}

export default async function EditTimeLogPage({ params }: PageProps) {
    const { logId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const log = await getTimeLogById(logId);
    if (!log) notFound();

    const title = log.description || 'Untitled session';

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    {
                        label: 'Time Tracking',
                        href: '/dashboard/crm/time-tracking',
                    },
                    { label: 'Time Logs', href: BASE },
                    { label: title, href: `${BASE}/${logId}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${title}`}
                subtitle="Update entry details, billable flag or duration."
                icon={Clock}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${logId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to detail
                        </Link>
                    </ZoruButton>
                }
            />
            <TimeLogForm initialData={log} />
        </div>
    );
}
