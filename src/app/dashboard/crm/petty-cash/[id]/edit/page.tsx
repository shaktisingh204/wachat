import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getPettyCashFloatById } from '@/app/actions/crm-petty-cash.actions';
import { PettyCashEditForm } from './edit-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PettyCashEditPage({ params }: PageProps) {
    const { id } = await params;
    const float = await getPettyCashFloatById(id);
    if (!float) notFound();

    return (
        <EntityDetailShell
            eyebrow="PETTY CASH"
            title={`Edit · ${float.name || 'petty cash float'}`}
            back={{ href: '/dashboard/crm/petty-cash', label: 'Petty Cash' }}
        >
            <PettyCashEditForm float={{ ...float, _id: String(float._id ?? id) }} />
        </EntityDetailShell>
    );
}
