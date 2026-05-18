/**
 * New weekly timesheet — server wrapper around `<TimesheetForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

import { TimesheetForm } from '../_components/timesheet-form';

export const dynamic = 'force-dynamic';

export default function NewTimesheetPage() {
    return (
        <EntityDetailShell
            title="New weekly timesheet"
            eyebrow="TIMESHEET"
            back={{ href: '/dashboard/crm/hr/timesheets', label: 'Timesheets' }}
        >
            <TimesheetForm />
        </EntityDetailShell>
    );
}
