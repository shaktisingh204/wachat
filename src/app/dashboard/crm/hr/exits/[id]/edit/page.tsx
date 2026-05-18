import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getExitById } from '@/app/actions/crm-exits.actions';
import { ExitForm } from '../../new/exit-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ExitEditPage({ params }: PageProps) {
    const { id } = await params;
    const exit = await getExitById(id);
    if (!exit) notFound();

    return (
        <EntityDetailShell
            title="Edit exit"
            eyebrow="EXIT"
            back={{ href: '/dashboard/crm/hr/exits', label: 'Exits' }}
        >
            <ExitForm exit={{ ...(exit as any), _id: String((exit as any)._id ?? id) }} />
        </EntityDetailShell>
    );
}
