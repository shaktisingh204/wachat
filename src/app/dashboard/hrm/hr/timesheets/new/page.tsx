/**
 * New weekly timesheet — server wrapper around `<TimesheetForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';

import { TimesheetForm } from '../_components/timesheet-form';

export const dynamic = 'force-dynamic';

export default function NewTimesheetPage() {
    return (
        <EntityListShell
            title="New weekly timesheet"
            subtitle="Log a week of hours for an employee."
        >
            <TimesheetForm />
        </EntityListShell>
    );
}
