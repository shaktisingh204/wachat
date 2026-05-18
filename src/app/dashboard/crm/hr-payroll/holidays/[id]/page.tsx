import { ZoruButton, ZoruCard, ZoruCardContent } from '@/components/zoruui';
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
            back={{ href: '/dashboard/crm/hr-payroll/holidays', label: 'All holidays' }}
            actions={
                <Link href={`/dashboard/crm/hr-payroll/holidays/${id}/edit`}>
                    <ZoruButton size="sm">Edit</ZoruButton>
                </Link>
            }
            audit={<EntityAuditTimeline entityKind="holiday" entityId={id} />}
        >
            <ZoruCard>
                <ZoruCardContent className="space-y-3 p-6 text-sm">
                    <Row label="Date" value={holiday.date} />
                    <Row label="Type" value={holiday.type} />
                    <Row label="Recurring" value={holiday.recurring ? 'Yes' : 'No'} />
                    <Row label="Locations" value={Array.isArray(holiday.applicableLocations) ? holiday.applicableLocations.join(', ') : holiday.applicableLocations} />
                    <Row label="Notes" value={holiday.notes} />
                </ZoruCardContent>
            </ZoruCard>
        </EntityDetailShell>
    );
}

function Row({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex items-baseline gap-3">
            <span className="w-32 shrink-0 text-zoru-ink-muted">{label}</span>
            <span className="text-zoru-ink">{value || '—'}</span>
        </div>
    );
}
