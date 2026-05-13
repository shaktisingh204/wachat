import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getPortalUserById } from '@/app/actions/crm-portal.actions';
import { PortalEditForm } from './edit-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PortalEditPage({ params }: PageProps) {
    const { id } = await params;
    const user = await getPortalUserById(id);
    if (!user) notFound();

    return (
        <div className="space-y-6">
            <CrmPageHeader title={`Edit ${user.name || user.email || 'portal user'}`} />
            <PortalEditForm user={{ ...user, _id: String(user._id ?? id) }} />
        </div>
    );
}
