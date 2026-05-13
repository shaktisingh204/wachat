import { notFound } from 'next/navigation';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruButton, ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { getPettyCashFloatById } from '@/app/actions/crm-petty-cash.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PettyCashDetailPage({ params }: PageProps) {
    const { id } = await params;
    const float = await getPettyCashFloatById(id);
    if (!float) notFound();

    return (
        <EntityDetailShell
            title={float.name || float.custodianName || 'Petty Cash Float'}
            eyebrow="PETTY CASH"
            back={{ href: '/dashboard/crm/petty-cash', label: 'All floats' }}
            actions={
                <Link href={`/dashboard/crm/petty-cash/${id}/edit`}>
                    <ZoruButton size="sm">Edit</ZoruButton>
                </Link>
            }
            audit={{ entityKind: 'petty_cash', entityId: id }}
        >
            <ZoruCard>
                <ZoruCardContent className="space-y-3 p-6 text-sm">
                    <Row label="Branch" value={float.branchName ?? float.branchId} />
                    <Row label="Custodian" value={float.custodianName ?? float.custodianId} />
                    <Row label="Opening balance" value={String(float.openingBalance ?? '—')} />
                    <Row label="Current balance" value={String(float.currentBalance ?? '—')} />
                    <Row label="Currency" value={float.currency} />
                    <Row label="Notes" value={float.notes} />
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
