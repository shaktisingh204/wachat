import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Wallet } from 'lucide-react';

/**
 * New payroll run page — server wrapper around `<PayrollRunForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { PayrollRunForm } from '../_components/payroll-run-form-v2';

export const dynamic = 'force-dynamic';

export default async function NewPayrollRunPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    {
                        label: 'Payroll runs',
                        href: '/dashboard/hrm/payroll/payroll',
                    },
                    { label: 'New' },
                ]}
                title="New payroll run"
                subtitle="Pick a period — payslips are generated and stored immediately."
                icon={Wallet}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/payroll/payroll">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to runs
                        </Link>
                    </ZoruButton>
                }
            />

            <PayrollRunForm />
        </div>
    );
}
