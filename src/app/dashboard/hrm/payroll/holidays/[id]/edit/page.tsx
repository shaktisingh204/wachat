import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
        <EntityListShell title={`Edit ${(holiday as any).name || 'holiday'}`}>
            <HolidayForm holiday={{ ...(holiday as any), _id: String((holiday as any)._id ?? id) }} />
        </EntityListShell>
    );
}
