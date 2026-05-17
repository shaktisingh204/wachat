/**
 * Payslip — Create page.
 *
 * Wraps `<PayslipForm>` in an `<EntityDetailShell>` so the create flow
 * matches the rest of the CRM (breadcrumb-style back link + consistent
 * page chrome).
 */

import { redirect } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { PayslipForm } from '../_components/payslip-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/hr-payroll/payslips';

export default async function NewPayslipPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            title="New payslip"
            eyebrow="PAYSLIP"
            back={{ href: BASE, label: 'All payslips' }}
        >
            <PayslipForm />
        </EntityDetailShell>
    );
}
