import { redirect } from 'next/navigation';

/**
 * New exit page — server wrapper around `<ExitForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { ExitForm } from '../_components/exit-form';

export const dynamic = 'force-dynamic';

export default async function NewExitPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            title="New Exit"
            eyebrow="EXIT"
            back={{ href: '/dashboard/crm/hr/exits', label: 'Exits' }}
        >
            <ExitForm />
        </EntityDetailShell>
    );
}
