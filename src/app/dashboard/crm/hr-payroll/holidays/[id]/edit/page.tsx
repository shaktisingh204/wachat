import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../../crm/_components/crm-page-header';
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
        <div className="space-y-6">
            <CrmPageHeader title={`Edit ${(holiday as any).name || 'holiday'}`} />
            <HolidayForm holiday={{ ...(holiday as any), _id: String((holiday as any)._id ?? id) }} />
        </div>
    );
}
