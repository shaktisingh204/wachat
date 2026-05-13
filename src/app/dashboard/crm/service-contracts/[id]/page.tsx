import { notFound } from 'next/navigation';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruButton, ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { getServiceContractById } from '@/app/actions/crm-service-contracts.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ServiceContractDetailPage({ params }: PageProps) {
    const { id } = await params;
    const c = await getServiceContractById(id);
    if (!c) notFound();

    return (
        <EntityDetailShell
            title={c.contractNo || c.title || 'Service Contract'}
            eyebrow="SERVICE CONTRACT"
            back={{ href: '/dashboard/crm/service-contracts', label: 'All service contracts' }}
            actions={
                <Link href={`/dashboard/crm/service-contracts/${id}/edit`}>
                    <ZoruButton size="sm">Edit</ZoruButton>
                </Link>
            }
            audit={{ entityKind: 'service_contract', entityId: id }}
        >
            <ZoruCard>
                <ZoruCardContent className="space-y-3 p-6 text-sm">
                    <Row label="Customer" value={c.customerName ?? c.customerId} />
                    <Row label="Asset" value={Array.isArray(c.assets) ? c.assets.join(', ') : c.asset} />
                    <Row label="Coverage" value={c.coverage} />
                    <Row label="Start" value={c.startDate} />
                    <Row label="End" value={c.endDate} />
                    <Row label="Frequency" value={c.frequency} />
                    <Row label="Technician" value={c.technician} />
                    <Row label="Billing" value={c.billing} />
                    <Row label="Status" value={c.status} />
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
