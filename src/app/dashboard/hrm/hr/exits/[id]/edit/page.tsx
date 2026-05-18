import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
        <EntityListShell
            title="Edit exit"
        >
            <ExitForm exit={{ ...(exit as any), _id: String((exit as any)._id ?? id) }} />
        </EntityListShell>
    );
}
