/**
 * Payroll run — Edit page.
 *
 * Server component: fetches the run and hands it to the existing
 * `<PayrollRunForm initial>` client island. The form posts via
 * `savePayrollRunAction` (Rust BFF), which detects `_id` on the
 * FormData and PATCHes instead of POSTing.
 */

import { notFound, redirect } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getPayrollRun } from '@/app/actions/crm/payroll-runs.actions';
import { PayrollRunForm } from '../../_components/payroll-run-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/hr-payroll/payroll';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PayrollRunEditPage({ params }: PageProps) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const { run } = await getPayrollRun(id);
    if (!run) notFound();

    return (
        <EntityDetailShell
            title="Edit payroll run"
            eyebrow="PAYROLL RUN"
            back={{ href: `${BASE}/${id}`, label: 'Back to run' }}
        >
            <PayrollRunForm initial={run} />
        </EntityDetailShell>
    );
}
