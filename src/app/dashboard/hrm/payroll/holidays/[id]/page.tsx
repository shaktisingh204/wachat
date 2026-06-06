import { Button, Card, CardBody } from '@/components/sabcrm/20ui/compat';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

import { getHoliday } from '@/app/actions/crm/holidays.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function HolidayDetailPage({ params }: PageProps) {
    const { id } = await params;
    const h = await getHoliday(id);
    if (!h) notFound();

    const holiday = h as any;

    return (
        <EntityDetailShell
            title={holiday.name || 'Holiday'}
            eyebrow="HOLIDAY"
            back={{ href: '/dashboard/hrm/payroll/holidays', label: 'All holidays' }}
            actions={
                <Link href={`/dashboard/hrm/payroll/holidays/${id}/edit`}>
                    <Button size="sm">Edit</Button>
                </Link>
            }
            audit={<EntityAuditTimeline entityKind="holiday" entityId={id} />}
        >
            <Card>
                <CardBody className="space-y-3 p-6 text-sm">
                    <Row label="Date" value={holiday.date} />
                    <Row label="Type" value={holiday.type} />
                    <Row label="Recurring" value={holiday.recurring ? 'Yes' : 'No'} />
                    <Row label="Locations" value={Array.isArray(holiday.applicableLocations) ? holiday.applicableLocations.join(', ') : holiday.applicableLocations} />
                    <Row label="Notes" value={holiday.notes} />
                </CardBody>
            </Card>
        </EntityDetailShell>
    );
}

function Row({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex items-baseline gap-3">
            <span className="w-32 shrink-0 text-[var(--st-text-secondary)]">{label}</span>
            <span className="text-[var(--st-text)]">{value || '—'}</span>
        </div>
    );
}
