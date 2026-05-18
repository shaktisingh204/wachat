import { ZoruButton } from '@/components/zoruui';
import { ArrowLeft, Clock } from 'lucide-react';

/**
 * New weekly timesheet — server wrapper around `<TimesheetForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

import { TimesheetForm } from '../_components/timesheet-form';

export const dynamic = 'force-dynamic';

export default function NewTimesheetPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/crm/hr' },
                    { label: 'Timesheets', href: '/dashboard/crm/hr/timesheets' },
                    { label: 'New' },
                ]}
                title="New weekly timesheet"
                subtitle="Log a week of hours for an employee."
                icon={Clock}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/crm/hr/timesheets">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />
            <TimesheetForm />
        </div>
    );
}
