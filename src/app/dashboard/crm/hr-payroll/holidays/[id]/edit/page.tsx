import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getHoliday } from '@/app/actions/crm/holidays.actions';
import { HolidayForm } from '../../new/holiday-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function HolidayEditPage({ params }: PageProps) {
    const { id } = await params;
    const holiday = await getHoliday(id);
    if (!holiday) notFound();

    return (
        <EntityDetailShell
            title={`Edit ${(holiday as any).name || 'holiday'}`}
            eyebrow="HOLIDAY"
            back={{ href: '/dashboard/crm/hr-payroll/holidays', label: 'Holidays' }}
        >
            <HolidayForm holiday={{ ...(holiday as any), _id: String((holiday as any)._id ?? id) }} />
        </EntityDetailShell>
    );
}
