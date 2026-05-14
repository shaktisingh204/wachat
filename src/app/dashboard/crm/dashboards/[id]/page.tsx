import { notFound } from 'next/navigation';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruButton, ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { getDashboardById } from '@/app/actions/crm-dashboards.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function DashboardDetailPage({ params }: PageProps) {
    const { id } = await params;
    const d = await getDashboardById(id);
    if (!d) notFound();

    return (
        <EntityDetailShell
            title={d.name || 'Dashboard'}
            eyebrow="DASHBOARD"
            back={{ href: '/dashboard/crm/dashboards', label: 'All dashboards' }}
            actions={
                <Link href={`/dashboard/crm/dashboards/${id}/edit`}>
                    <ZoruButton size="sm">Edit</ZoruButton>
                </Link>
            }
            audit={<EntityAuditTimeline entityKind="dashboard" entityId={id} />}
        >
            <ZoruCard>
                <ZoruCardContent className="space-y-3 p-6 text-sm">
                    <Row label="Description" value={d.description} />
                    <Row label="Layout" value={d.layout} />
                    <Row label="Visibility" value={d.visibility} />
                    <Row label="Auto-refresh (s)" value={String(d.autoRefreshSeconds ?? '—')} />
                    <Row label="Widgets" value={String(Array.isArray(d.widgets) ? d.widgets.length : 0)} />
                </ZoruCardContent>
            </ZoruCard>
        </EntityDetailShell>
    );
}

function Row({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex items-baseline gap-3">
            <span className="w-40 shrink-0 text-zoru-ink-muted">{label}</span>
            <span className="text-zoru-ink">{value || '—'}</span>
        </div>
    );
}
