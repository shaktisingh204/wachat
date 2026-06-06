import { Button } from '@/components/sabcrm/20ui/compat';
import { notFound } from 'next/navigation';

/**
 * Timesheet detail — read & edit.
 *
 * Server component: loads the row, hands it to the shared form.
 * Adds approval action bar (submit / approve / reject) gated on status.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';

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
        <EntityListShell
            title={`Timesheet — ${doc.employeeName || doc.employeeId}`}
            subtitle={`Week of ${doc.weekStartDate?.slice(0, 10) ?? ''}`}
        >
            <TimesheetStatusBar id={doc._id} status={doc.status} />
            <TimesheetForm initial={doc} />
        </EntityListShell>
    );
}
