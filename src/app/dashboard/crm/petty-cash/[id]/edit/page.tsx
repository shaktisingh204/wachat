import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../_components/crm-page-header';
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
        <div className="space-y-6">
            <CrmPageHeader title={`Edit ${float.name || 'petty cash float'}`} />
            <PettyCashEditForm float={{ ...float, _id: String(float._id ?? id) }} />
        </div>
    );
}
