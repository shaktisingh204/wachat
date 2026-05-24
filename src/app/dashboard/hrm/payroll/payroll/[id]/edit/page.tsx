import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit payroll run page — wrap `<PayrollRunForm initialData=… />`.
 *
 * Editing only updates metadata (status / notes / run_date). The
 * (month, year) and totals are locked because payslips are immutable
 * after generation.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getPayrollRunById } from '@/app/actions/crm-payroll-runs.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { Suspense } from 'react';
import { Skeleton } from '@/components/zoruui';

import { PayrollRunForm } from '../../_components/payroll-run-form-v2';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/payroll';

const MONTH_LABELS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export default async function EditPayrollRunPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: runId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const run = await getPayrollRunById(runId);
    if (!run) notFound();

    const periodLabel = `${MONTH_LABELS[(run.period_month ?? 1) - 1]} ${run.period_year}`;

    return (
        <EntityListShell
            title={`Edit · ${periodLabel}`}
            subtitle="Payslips and totals are locked. You can only update the status, notes, and metadata for this run."
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2">
                    <PayrollRunForm initialData={run} />
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
                        <EntityAuditTimeline entityKind="payroll_run" entityId={runId} title="Audit Log (Status Changes)" />
                    </Suspense>
                </div>
            </div>
        </EntityListShell>
    );
}
