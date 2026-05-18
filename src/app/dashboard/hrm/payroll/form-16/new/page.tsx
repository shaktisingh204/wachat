import { redirect } from 'next/navigation';

/**
 * New Form 16 page — server wrapper around `<Form16Form />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { Form16Form } from '../_components/form-16-form';

export const dynamic = 'force-dynamic';

export default async function NewForm16Page() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New Form 16"
            subtitle="Create a tax certificate record for an employee. Attach the generated PDF after creation."
        >
            <Form16Form />
        </EntityListShell>
    );
}
