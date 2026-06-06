import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

export default async function NoticeActivityPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return (
        <div className="p-4 md:p-6">
            <h1 className="mb-4 text-xl font-semibold text-[var(--st-text)]">Notice activity</h1>
            <EntityAuditTimeline entityKind="notice" entityId={id} />
        </div>
    );
}
