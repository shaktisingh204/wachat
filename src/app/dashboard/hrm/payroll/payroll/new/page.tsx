import { redirect } from 'next/navigation';

/**
 * New payroll run page — server wrapper around `<PayrollRunForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { PayrollRunForm } from '../_components/payroll-run-form-v2';

export const dynamic = 'force-dynamic';

export default async function NewPayrollRunPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New payroll run"
            subtitle="Pick a period — payslips are generated and stored immediately."
        >
            <PayrollRunForm />
        </EntityListShell>
    );
}
