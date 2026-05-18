import { ZoruButton } from '@/components/zoruui';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock } from 'lucide-react';

/**
 * Timesheet detail — read & edit.
 *
 * Server component: loads the row, hands it to the shared form.
 * Adds approval action bar (submit / approve / reject) gated on status.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

import { getCrmTimesheetById } from '@/app/actions/crm-timesheets.actions';

import { TimesheetForm } from '../_components/timesheet-form';
import { TimesheetStatusBar } from '../_components/timesheet-status-bar';

export const dynamic = 'force-dynamic';

export default async function TimesheetDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const doc = await getCrmTimesheetById(id);
    if (!doc) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Timesheets', href: '/dashboard/hrm/hr/timesheets' },
                    { label: doc.employeeName || 'Timesheet' },
                ]}
                title={`Timesheet — ${doc.employeeName || doc.employeeId}`}
                subtitle={`Week of ${doc.weekStartDate?.slice(0, 10) ?? ''}`}
                icon={Clock}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/hr/timesheets">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <TimesheetStatusBar id={doc._id} status={doc.status} />
            <TimesheetForm initial={doc} />
        </div>
    );
}
