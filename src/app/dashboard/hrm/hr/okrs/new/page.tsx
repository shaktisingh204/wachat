import { redirect } from 'next/navigation';

/**
 * New OKR page — server wrapper around `<OkrForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { OkrForm } from '../_components/okr-form';

export const dynamic = 'force-dynamic';

export default async function NewOkrPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New OKR"
            subtitle="Define a new objective and its key results."
        >
            <OkrForm />
        </EntityListShell>
    );
}
