import { redirect } from 'next/navigation';

/**
 * New exit page — server wrapper around `<ExitForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { ExitForm } from '../_components/exit-form';

export const dynamic = 'force-dynamic';

export default async function NewExitPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New Exit"
            subtitle="Record an offboarding case with clearance and F&F tracking."
        >
            <ExitForm />
        </EntityListShell>
    );
}
