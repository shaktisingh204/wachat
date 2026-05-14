import { notFound } from 'next/navigation';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruButton, ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { getCrmVendorById } from '@/app/actions/crm-vendors.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function VendorDetailPage({ params }: PageProps) {
    const { id } = await params;
    const vendor = await getCrmVendorById(id);
    if (!vendor) notFound();

    const v = vendor as any;

    return (
        <EntityDetailShell
            title={v.name || 'Vendor'}
            eyebrow="VENDOR"
            back={{ href: '/dashboard/crm/purchases/vendors', label: 'All vendors' }}
            actions={
                <>
                    <Link href={`/dashboard/crm/purchases/vendors/${id}/activity`}>
                        <ZoruButton variant="outline" size="sm">
                            Activity
                        </ZoruButton>
                    </Link>
                    <Link href={`/dashboard/crm/purchases/vendors/${id}/edit`}>
                        <ZoruButton size="sm">Edit</ZoruButton>
                    </Link>
                </>
            }
            audit={<EntityAuditTimeline entityKind="vendor" entityId={id} />}
        >
            <ZoruCard>
                <ZoruCardContent className="space-y-3 p-6 text-sm">
                    <Row label="Email" value={v.email} />
                    <Row label="Phone" value={v.phone} />
                    <Row label="GSTIN" value={v.gstin} />
                    <Row label="PAN" value={v.pan} />
                    <Row label="Address" value={v.address} />
                    <Row label="Country" value={v.country} />
                    <Row label="State" value={v.state} />
                    <Row label="City" value={v.city} />
                    <Row label="Industry" value={v.industry} />
                    <Row label="Website" value={v.website} />
                    <Row label="MSME no." value={v.msmeNumber} />
                    <Row label="Payment terms" value={v.paymentTerms} />
                    <Row label="Vendor type" value={v.vendorType} />
                    <Row label="Notes" value={v.notes} />
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
