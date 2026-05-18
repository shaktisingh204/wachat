import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { HolidayForm } from './holiday-form';

export default function NewHolidayPage() {
    return (
        <EntityDetailShell
            title="New holiday"
            eyebrow="HOLIDAY"
            back={{ href: '/dashboard/crm/hr-payroll/holidays', label: 'Holidays' }}
        >
            <HolidayForm />
        </EntityDetailShell>
    );
}
