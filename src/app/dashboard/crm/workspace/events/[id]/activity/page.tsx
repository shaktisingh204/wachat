/**
 * Event activity — server-rendered audit timeline (§1D.2 footer).
 */

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

export default async function EventActivityPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return (
        <div className="p-4 md:p-6">
            <h1 className="mb-4 text-xl font-semibold text-[var(--st-text)]">Event activity</h1>
            <EntityAuditTimeline entityKind="event" entityId={id} />
        </div>
    );
}
