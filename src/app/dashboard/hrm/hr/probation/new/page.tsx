import { redirect } from 'next/navigation';

/**
 * New probation page — server wrapper around `<ProbationForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { ProbationForm } from '../_components/probation-form';

export const dynamic = 'force-dynamic';

export default async function NewProbationPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New Probation"
            subtitle="Start a new probation period with structured evaluation criteria."
        >
            <ProbationForm />
        </EntityListShell>
    );
}
