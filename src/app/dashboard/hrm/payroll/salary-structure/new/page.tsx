import { redirect } from 'next/navigation';

/**
 * New salary structure page — server wrapper around `<SalaryStructureForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { SalaryStructureForm } from '../_components/salary-structure-form';

export const dynamic = 'force-dynamic';

export default async function NewSalaryStructurePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New salary structure"
            subtitle="Capture an employee's basic / HRA / DA, plus PF, ESI, professional tax."
        >
            <SalaryStructureForm />
        </EntityListShell>
    );
}
