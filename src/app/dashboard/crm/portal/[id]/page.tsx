import { notFound } from 'next/navigation';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruButton, ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { getPortalUserById } from '@/app/actions/crm-portal.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PortalDetailPage({ params }: PageProps) {
    const { id } = await params;
    const user = await getPortalUserById(id);
    if (!user) notFound();

    return (
        <EntityDetailShell
            title={user.name || user.email || 'Portal user'}
            eyebrow="PORTAL USER"
            back={{ href: '/dashboard/crm/portal', label: 'All portal users' }}
            actions={
                <Link href={`/dashboard/crm/portal/${id}/edit`}>
                    <ZoruButton size="sm">Edit</ZoruButton>
                </Link>
            }
            audit={{ entityKind: 'portal', entityId: id }}
        >
            <ZoruCard>
                <ZoruCardContent className="space-y-3 p-6 text-sm">
                    <Row label="Email" value={user.email} />
                    <Row label="Phone" value={user.phone} />
                    <Row label="Portal type" value={user.portalType} />
                    <Row label="Capabilities" value={Array.isArray(user.capabilities) ? user.capabilities.join(', ') : user.capabilities} />
                    <Row label="Status" value={user.status} />
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
