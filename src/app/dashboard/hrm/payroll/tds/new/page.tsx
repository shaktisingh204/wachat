import { redirect } from 'next/navigation';

/**
 * New TDS record page — server wrapper around `<TdsForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { TdsForm } from '../_components/tds-form';

export const dynamic = 'force-dynamic';

export default async function NewTdsPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New TDS record"
            subtitle="Record TDS for an employee for a specific FY + quarter."
        >
            <TdsForm />
        </EntityListShell>
    );
}
