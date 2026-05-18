import { redirect } from 'next/navigation';

/**
 * New payroll run page — server wrapper around `<PayrollRunForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { PayrollRunForm } from '../_components/payroll-run-form-v2';

export const dynamic = 'force-dynamic';

export default async function NewPayrollRunPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            title="New payroll run"
            eyebrow="PAYROLL"
            back={{ href: '/dashboard/crm/hr-payroll/payroll', label: 'Payroll runs' }}
        >
            <PayrollRunForm />
        </EntityDetailShell>
    );
}
