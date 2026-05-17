/**
 * Payslip — Edit page.
 *
 * Server component: fetches the payslip and hands it to the shared
 * `<PayslipForm initial>` client island. The form posts via
 * `savePayslipAction`, which detects the `_id` field and PATCHes.
 */

import { notFound, redirect } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getPayslipDoc } from '@/app/actions/crm-payslips.actions';
import { PayslipForm } from '../../_components/payslip-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/hr-payroll/payslips';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditPayslipPage({ params }: PageProps) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const payslip = await getPayslipDoc(id);
    if (!payslip) notFound();

    return (
        <EntityDetailShell
            title="Edit payslip"
            eyebrow={`PAYSLIP · ${payslip.employeeName ?? payslip.employeeId ?? id}`}
            back={{ href: `${BASE}/${id}`, label: 'Back to payslip' }}
        >
            <PayslipForm initial={payslip} />
        </EntityDetailShell>
    );
}
