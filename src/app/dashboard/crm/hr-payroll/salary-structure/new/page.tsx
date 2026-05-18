import { redirect } from 'next/navigation';

/**
 * New salary structure page — server wrapper around `<SalaryStructureForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { SalaryStructureForm } from '../_components/salary-structure-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/hr-payroll/salary-structure';

export default async function NewSalaryStructurePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            title="New salary structure"
            eyebrow="SALARY STRUCTURE"
            back={{ href: BASE, label: 'Salary structures' }}
        >
            <SalaryStructureForm />
        </EntityDetailShell>
    );
}
