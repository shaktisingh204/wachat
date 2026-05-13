import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getHoliday } from '@/app/actions/crm/holidays.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function HolidayActivityPage({ params }: PageProps) {
    const { id } = await params;
    const holiday = await getHoliday(id);
    if (!holiday) notFound();

    return (
        <EntityDetailShell
            title={(holiday as any).name || 'Holiday'}
            eyebrow="HOLIDAY ACTIVITY"
            back={{ href: `/dashboard/hrm/payroll/holidays/${id}`, label: 'Back to holiday' }}
        >
            <EntityAuditTimeline entityKind="holiday" entityId={id} />
        </EntityDetailShell>
    );
}
