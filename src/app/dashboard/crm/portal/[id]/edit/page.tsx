import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
        <EntityDetailShell
            eyebrow="PORTAL"
            title={`Edit · ${user.name || user.email || 'portal user'}`}
            back={{ href: '/dashboard/crm/portal', label: 'Customer Portal' }}
        >
            <PortalEditForm user={{ ...user, _id: String(user._id ?? id) }} />
        </EntityDetailShell>
    );
}
