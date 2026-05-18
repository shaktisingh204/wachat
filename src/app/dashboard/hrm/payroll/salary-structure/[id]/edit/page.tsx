import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Wallet } from 'lucide-react';

/**
 * Edit salary structure page — wrap `<SalaryStructureForm initialData=… />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getSalaryStructureDoc } from '@/app/actions/crm-salary-structures.actions';

import { SalaryStructureForm } from '../../_components/salary-structure-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/salary-structure';

export default async function EditSalaryStructurePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const doc = await getSalaryStructureDoc(id);
    if (!doc) notFound();

    const label = doc.employeeName ?? doc.employeeId ?? id;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    { label: 'Salary structures', href: BASE },
                    { label, href: `${BASE}/${id}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${label}`}
                subtitle="Update earnings, deductions, or archive this structure."
                icon={Wallet}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <SalaryStructureForm initialData={doc} />
        </div>
    );
}
