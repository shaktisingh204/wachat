import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Wallet } from 'lucide-react';

/**
 * New salary structure page — server wrapper around `<SalaryStructureForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { SalaryStructureForm } from '../_components/salary-structure-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/salary-structure';

export default async function NewSalaryStructurePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    { label: 'Salary structures', href: BASE },
                    { label: 'New' },
                ]}
                title="New salary structure"
                subtitle="Capture an employee's basic / HRA / DA, plus PF, ESI, professional tax."
                icon={Wallet}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <SalaryStructureForm />
        </div>
    );
}
